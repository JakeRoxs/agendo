#!/usr/bin/env node
/**
 * Agendo MCP IPC client for the diagnostics endpoint.
 *
 * Connects to the diagnostics IPC endpoint exposed by the Agendo extension
 * bridge and sends a single `get_problems` request per connection.
 *
 * Wire protocol (newline-delimited JSON, one request / one response per
 * connection):
 *   request:  { id, method: "get_problems", params }
 *   response: { id, ok: true, result }  or  { id, ok: false, error: { code, message } }
 *
 * The endpoint is a generic string (Unix socket path or Windows named pipe)
 * passed straight to Node's `net`. The client performs no platform-specific
 * logic; the default endpoint constant below is platform-appropriate.
 */
import { z } from 'zod';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';

/** Maximum outbound request bytes (UTF-8). */
export const MAX_REQUEST_BYTES = 64 * 1024;
/** Maximum inbound response bytes (UTF-8). */
export const MAX_RESPONSE_BYTES = 1 * 1024 * 1024;
/** Maximum time to wait for a single IPC response. */
export const REQUEST_TIMEOUT_MS = 5000;
/** Error code reported when the diagnostics endpoint cannot be reached. */
export const EDITOR_UNAVAILABLE_CODE = 'editor_unavailable';
/** Newline byte (0x0a) used to frame JSONL records. */
const NEWLINE_BYTE = 0x0a;

/** Default IPC endpoint used when --endpoint is not supplied. */
export const IPC_ENDPOINT = process.platform === 'win32'
  ? String.raw`\\.\pipe\agendo-problems.sock`
  : path.join(os.tmpdir(), 'agendo-problems.sock');

export function getIpcEndpoint() {
  return IPC_ENDPOINT;
}

/**
 * Connection function used to reach the diagnostics endpoint. Defaults to
 * Node's `net.createConnection`; tests can override it via setCreateConnection.
 */
let createConnection = net.createConnection;

/** Test hook: override the connection function. */
export function setCreateConnection(fn) {
  createConnection = fn;
}

function isValidEndpoint(endpoint) {
  return typeof endpoint === 'string' && endpoint.length > 0;
}

/**
 * Build the `get_problems` params object, applying safe defaults and omitting
 * undefined fields when serializing.
 *
 * Contract: path optional, workspaceFolder optional, severity optional,
 * limit default 100 and capped at 500. Invalid negative/fractional limits are
 * rejected by the caller (schema + handler).
 */
export function buildProblemsParams(params) {
  const limit = params.limit === undefined ? 100 : params.limit;
  const result = { limit };
  if (params.path !== undefined) result.path = params.path;
  if (params.workspaceFolder !== undefined) result.workspaceFolder = params.workspaceFolder;
  if (params.severity !== undefined) result.severity = params.severity;
  return result;
}

/**
 * Send one `get_problems` request to the IPC endpoint and return the result.
 *
 * Rejects with an Error whose message begins with `editor_unavailable:` when
 * the endpoint is unavailable, the request times out, the connection fails, the
 * request/response exceeds byte bounds, or the response is malformed. The MCP
 * tool handler turns this into a clear MCP error result.
 */
async function sendIpcRequest(endpoint, method, params) {
  if (!isValidEndpoint(endpoint)) {
    throw new Error(`${EDITOR_UNAVAILABLE_CODE}: no IPC endpoint configured`);
  }

  const requestParams = method === 'get_problems' ? buildProblemsParams(params) : params;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const requestObject = { id, method, params: requestParams };
  const requestBytes = Buffer.from(`${JSON.stringify(requestObject)}\n`, 'utf8');
  if (requestBytes.length > MAX_REQUEST_BYTES) {
    throw new Error(
      `${EDITOR_UNAVAILABLE_CODE}: request exceeds ${MAX_REQUEST_BYTES} bytes`
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = createConnection(endpoint);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(
        new Error(`${EDITOR_UNAVAILABLE_CODE}: request timed out after ${REQUEST_TIMEOUT_MS}ms`)
      );
    }, REQUEST_TIMEOUT_MS);

    // Accumulate raw bytes so multibyte UTF-8 characters are never split
    // across chunk boundaries when searching for the line delimiter.
    let buffer = Buffer.alloc(0);
    let responseBytes = 0;

    socket.on('data', (chunk) => {
      if (settled) return;
      buffer = Buffer.concat([buffer, chunk]);
      responseBytes += chunk.length;
      if (responseBytes > MAX_RESPONSE_BYTES) {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(
          new Error(`${EDITOR_UNAVAILABLE_CODE}: response exceeds ${MAX_RESPONSE_BYTES} bytes`)
        );
        return;
      }
      const idx = buffer.indexOf(NEWLINE_BYTE);
      if (idx === -1) return;
      const line = buffer.subarray(0, idx).toString('utf8');
      buffer = buffer.subarray(idx + 1);
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      try {
        if (line.trim() === '') {
          reject(new Error(`${EDITOR_UNAVAILABLE_CODE}: empty IPC response`));
          return;
        }
        let parsed;
        try {
          parsed = JSON.parse(line);
        } catch {
          reject(new Error(`${EDITOR_UNAVAILABLE_CODE}: invalid IPC response`));
          return;
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error(`${EDITOR_UNAVAILABLE_CODE}: invalid IPC response envelope`));
          return;
        }
        if (parsed.id !== id) {
          reject(new Error(`${EDITOR_UNAVAILABLE_CODE}: response id mismatch`));
          return;
        }
        if (parsed.ok === true) {
          resolve(parsed.result);
        } else if (parsed.ok === false) {
          const error = parsed.error;
          reject(
            new Error(
              `${EDITOR_UNAVAILABLE_CODE}: ${error?.message ?? error?.code ?? 'diagnostics request failed'}`
            )
          );
        } else {
          reject(new Error(`${EDITOR_UNAVAILABLE_CODE}: invalid IPC response envelope`));
        }
      } catch {
        reject(new Error(`${EDITOR_UNAVAILABLE_CODE}: invalid IPC response`));
      }
    });

    socket.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      reject(new Error(`${EDITOR_UNAVAILABLE_CODE}: ${err.message}`));
    });

    socket.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`${EDITOR_UNAVAILABLE_CODE}: connection closed without response`));
    });

    socket.write(requestBytes);
  });
}

export function sendGetProblemsRequest(endpoint, params) {
  return sendIpcRequest(endpoint, 'get_problems', params);
}

export function sendListWorkspaceFoldersRequest(endpoint) {
  return sendIpcRequest(endpoint, 'list_workspace_folders', {});
}

/**
 * Input schema for the `get_problems` MCP tool. Read-only diagnostics query.
 * Returned as a raw Zod shape (plain object) so it can be passed directly to
 * `server.tool(name, description, shape, cb)`.
 *
 * Contract: path optional, workspaceFolder optional, severity optional,
 * limit default 100 and capped at 500 (range validation performed by the
 * handler).
 */
export function getProblemsInputSchema() {
  return {
    path: z.string().optional().describe('File or workspace path to diagnose'),
    workspaceFolder: z.string().optional().describe('Workspace folder path or URI'),
    severity: z.array(z.enum(['error', 'warning', 'information', 'hint'])).optional().describe(
      'Severity levels to include'
    ),
    limit: z.number().int().optional().describe('Maximum number of problems to return (default 100, capped at 500)'),
    bridgeId: z.string().optional().describe('Opaque registration-scoped ID of a specific diagnostics bridge to use (from list_diagnostic_bridges). Mutually exclusive with --endpoint.'),
  };
}

/**
 * Handler for the `get_problems` MCP tool. Applies safe defaults, validates
 * present values, omits undefined fields when serializing, and forwards the
 * request to the diagnostics IPC endpoint.
 */
export async function getProblemsHandler(endpoint, { path, workspaceFolder, severity, limit }) {
  let effectiveLimit = 100;
  if (limit !== undefined) {
    if (!Number.isInteger(limit)) {
      throw new TypeError('invalid_input: limit must be an integer');
    }
    if (limit < 1) {
      throw new Error('invalid_input: limit must be a positive integer');
    }
    effectiveLimit = Math.min(limit, 500);
  }
  const params = buildProblemsParams({ path, workspaceFolder, severity, limit: effectiveLimit });
  return sendGetProblemsRequest(endpoint, params);
}
