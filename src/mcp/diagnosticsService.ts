import * as path from "node:path";
import * as vscode from "vscode";

/**
 * Severity values accepted by the `get_problems` MCP method.
 */
export type ProblemSeverity = "error" | "warning" | "information" | "hint";

export interface GetProblemsParams {
  /**
   * Workspace-relative file or directory within the selected workspace folder.
   * When omitted, the whole selected workspace folder is scanned.
   */
  path?: string;
  /**
   * Canonical workspace folder identifier (the folder's name). Required when
   * multiple workspace roots are open; omitted when a single root is open.
   */
  workspaceFolder?: string;
  /**
   * Optional severity filter. Omitted = no severity filtering. An empty array
   * matches no diagnostics.
   */
  severity?: ProblemSeverity[];
  /**
   * Max diagnostics to return. Default 100, clamped to 1..500.
   */
  limit?: number;
}

export interface ProblemRange {
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export interface ProblemDiagnostic {
  /**
   * Workspace-relative path with `/` separators, relative to the selected
   * workspace folder.
   */
  path: string;
  message: string;
  severity: ProblemSeverity;
  source?: string;
  code?: string | number;
  range: ProblemRange;
}

export interface GetProblemsResult {
  /** Canonical workspace folder identifier used for the query. */
  workspaceFolder: string;
  /** ISO-8601 timestamp when the snapshot was taken. */
  capturedAt: string;
  /** Total diagnostics matching the filters (before truncation). */
  total: number;
  truncated: boolean;
  diagnostics: ProblemDiagnostic[];
}

export interface McpProblemsError {
  code: string;
  message: string;
}

export const ProblemErrorCode = {
  INVALID_PARAMS: "INVALID_PARAMS",
  PATH_TRAVERSAL: "PATH_TRAVERSAL",
  WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND",
  MULTIPLE_ROOTS_REQUIRED: "MULTIPLE_ROOTS_REQUIRED",
  UNSUPPORTED_HOST: "UNSUPPORTED_HOST",
  DISABLED: "DISABLED",
  INTERNAL: "INTERNAL",
} as const;

/** Stability-coded error surfaced through the IPC wire. */
export class McpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = code;
  }
}

const SeverityToVsCode: Record<ProblemSeverity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
  hint: vscode.DiagnosticSeverity.Hint,
};

function vsCodeSeverityToString(severity: vscode.DiagnosticSeverity): ProblemSeverity {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    case vscode.DiagnosticSeverity.Information:
      return "information";
    case vscode.DiagnosticSeverity.Hint:
      return "hint";
    default:
      return "information";
  }
}

/** Only the local desktop extension host can access VS Code APIs directly. */
function isLocalDesktopHost(): boolean {
  return vscode.env.uiKind === vscode.UIKind.Desktop && vscode.env.remoteName === undefined;
}

function isWithin(uri: vscode.Uri, base: vscode.Uri): boolean {
  if (uri.scheme !== "file" || base.scheme !== "file") {
    return false;
  }
  const basePath = base.fsPath;
  const uriPath = uri.fsPath;
  if (!basePath || !uriPath) {
    return false;
  }
  const baseNorm = basePath.replace(/\\/g, "/");
  const uriNorm = uriPath.replace(/\\/g, "/");
  return uriNorm === baseNorm || uriNorm.startsWith(`${baseNorm}/`);
}

function hasTraversalSegments(relPath: string): boolean {
  return relPath.split(/[\\/]/).includes("..");
}

/**
 * Resolve a relative or absolute path to a URI inside the workspace folder.
 * Absolute paths are accepted only when their normalized location is contained
 * by the selected folder. Returns undefined when the path escapes the folder.
 */
function resolveSafePath(baseUri: vscode.Uri, requestedPath: string): vscode.Uri | undefined {
  if (!path.isAbsolute(requestedPath) && hasTraversalSegments(requestedPath)) {
    return undefined;
  }
  let joined: vscode.Uri;
  try {
    joined = path.isAbsolute(requestedPath)
      ? vscode.Uri.file(path.resolve(requestedPath))
      : vscode.Uri.joinPath(baseUri, requestedPath);
  } catch {
    return undefined;
  }
  if (!isWithin(joined, baseUri)) {
    return undefined;
  }
  return joined;
}

/** Workspace-relative path with `/` separators, relative to the selected workspace folder. */
function relativePath(folderUri: vscode.Uri, uri: vscode.Uri): string {
  return path.relative(folderUri.fsPath, uri.fsPath).replace(/\\/g, "/");
}

/** Reject params that are not a plain JSON object. */
function requireObjectParams(params: unknown): void {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new McpError(ProblemErrorCode.INVALID_PARAMS, "params must be a JSON object.");
  }
}

/** Reject a param that is present but not a string. */
function requireStringParam(value: unknown, message: string): void {
  if (value !== undefined && typeof value !== "string") {
    throw new McpError(ProblemErrorCode.INVALID_PARAMS, message);
  }
}

/** Validate the optional severity array. */
function validateSeverity(value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    throw new McpError(ProblemErrorCode.INVALID_PARAMS, "severity must be an array.");
  }
  const valid = new Set(["error", "warning", "information", "hint"]);
  for (const severity of value) {
    if (typeof severity !== "string" || !valid.has(severity)) {
      throw new McpError(ProblemErrorCode.INVALID_PARAMS, `Invalid severity: ${String(severity)}.`);
    }
  }
}

/** Validate the optional limit. */
function validateLimit(value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new McpError(ProblemErrorCode.INVALID_PARAMS, "limit must be an integer.");
  }
  if (value < 1 || value > 500) {
    throw new McpError(ProblemErrorCode.INVALID_PARAMS, "limit must be between 1 and 500.");
  }
}

export class DiagnosticsService {
  /**
   * Snapshot the current diagnostics for the selected workspace folder, apply
   * filters, and return a bounded result. Diagnostics are read at request time
   * (snapshot on request).
   */
  async getProblems(params: GetProblemsParams): Promise<GetProblemsResult> {
    if (!isLocalDesktopHost()) {
      throw new McpError(
        ProblemErrorCode.UNSUPPORTED_HOST,
        "Diagnostics are only supported in a local desktop host.",
      );
    }

    this.validateParams(params);

    const folders = vscode.workspace.workspaceFolders ?? [];
    const folder = this.resolveWorkspaceFolder(params.workspaceFolder, folders);

    let targetUri: vscode.Uri | undefined;
    if (params.path !== undefined) {
      targetUri = resolveSafePath(folder.uri, params.path);
      if (!targetUri) {
        throw new McpError(
          ProblemErrorCode.PATH_TRAVERSAL,
          "The requested path escapes the selected workspace folder.",
        );
      }
    }

    const limit = this.normalizeLimit(params.limit);

    // Snapshot on request: all current diagnostics in the workspace.
    const all = vscode.languages.getDiagnostics();

    const severitySet = params.severity
      ? new Set(params.severity.map((severity) => SeverityToVsCode[severity]))
      : undefined;

    const matched = this.collectMatching(folder.uri, targetUri, severitySet, all);

    const { total, truncated, diagnostics: limited } = this.limitDiagnostics(matched, limit);

    const diagnostics = this.buildDiagnostics(folder.uri, limited);

    return {
      workspaceFolder: folder.name,
      capturedAt: new Date().toISOString(),
      total,
      truncated,
      diagnostics,
    };
  }

  private limitDiagnostics<T>(matched: T[], limit: number): {
    total: number;
    truncated: boolean;
    diagnostics: T[];
  } {
    const total = matched.length;
    return {
      total,
      truncated: total > limit,
      diagnostics: total > limit ? matched.slice(0, limit) : matched,
    };
  }

  private resolveWorkspaceFolder(
    workspaceFolder: string | undefined,
    folders: readonly vscode.WorkspaceFolder[],
  ): vscode.WorkspaceFolder {
    if (folders.length === 1) {
      return folders[0];
    }
    if (!workspaceFolder) {
      throw new McpError(
        ProblemErrorCode.MULTIPLE_ROOTS_REQUIRED,
        "Multiple workspace folders are open; specify workspaceFolder.",
      );
    }
    const match = folders.find((folder) => folder.name === workspaceFolder);
    if (!match) {
      throw new McpError(
        ProblemErrorCode.WORKSPACE_NOT_FOUND,
        `Workspace folder "${workspaceFolder}" not found.`,
      );
    }
    return match;
  }

  private normalizeLimit(limit: number | undefined): number {
    const value = limit === undefined ? 100 : Number(limit);
    if (!Number.isFinite(value) || value < 1 || value > 500) {
      throw new McpError(
        ProblemErrorCode.INVALID_PARAMS,
        "limit must be a number between 1 and 500.",
      );
    }
    return value;
  }

  /** Validate IPC params before using them, so malformed caller input yields a
   * stable INVALID_PARAMS wire error instead of an INTERNAL TypeError. */
  private validateParams(params: unknown): void {
    requireObjectParams(params);
    const p = params as {
      path?: unknown;
      workspaceFolder?: unknown;
      severity?: unknown;
      limit?: unknown;
    };
    requireStringParam(p.path, "path must be a string.");
    requireStringParam(p.workspaceFolder, "workspaceFolder must be a string.");
    validateSeverity(p.severity);
    validateLimit(p.limit);
  }

  private toProblemDiagnostic(
    folderUri: vscode.Uri,
    uri: vscode.Uri,
    diagnostic: vscode.Diagnostic,
  ): ProblemDiagnostic {
    return {
      path: relativePath(folderUri, uri),
      message: diagnostic.message,
      severity: vsCodeSeverityToString(diagnostic.severity),
      source: diagnostic.source ?? undefined,
      code: diagnosticCodeValue(diagnostic.code),
      range: {
        start: {
          line: diagnostic.range.start.line + 1,
          character: diagnostic.range.start.character + 1,
        },
        end: {
          line: diagnostic.range.end.line + 1,
          character: diagnostic.range.end.character + 1,
        },
      },
    };
  }

  /** Collect (uri, diagnostic) records within the folder, optionally bounded by
   * targetUri, and filtered per diagnostic by severity. */
  private collectMatching(
    folderUri: vscode.Uri,
    targetUri: vscode.Uri | undefined,
    severitySet: Set<vscode.DiagnosticSeverity> | undefined,
    all: Iterable<readonly [vscode.Uri, vscode.Diagnostic[]]>,
  ): Array<{ uri: vscode.Uri; diagnostic: vscode.Diagnostic }> {
    const matched: Array<{ uri: vscode.Uri; diagnostic: vscode.Diagnostic }> = [];
    for (const [uri, diagnostics] of all) {
      // Workspace docs only: within the selected workspace folder.
      if (!isWithin(uri, folderUri)) {
        continue;
      }
      // Path containment (file or directory).
      if (targetUri && !isWithin(uri, targetUri)) {
        continue;
      }
      for (const diagnostic of diagnostics) {
        if (severitySet && !severitySet.has(diagnostic.severity)) {
          continue;
        }
        matched.push({ uri, diagnostic });
      }
    }
    return matched;
  }

  /** Convert matched records to wire diagnostics with one-based ranges. */
  private buildDiagnostics(
    folderUri: vscode.Uri,
    limited: Array<{ uri: vscode.Uri; diagnostic: vscode.Diagnostic }>,
  ): ProblemDiagnostic[] {
    const diagnostics: ProblemDiagnostic[] = [];
    for (const { uri, diagnostic } of limited) {
      diagnostics.push(this.toProblemDiagnostic(folderUri, uri, diagnostic));
    }
    return diagnostics;
  }
}

/** Normalize a diagnostic code (which may be a string, number, or
 * `{ value, target }` object) to a string-or-number wire value. */
function diagnosticCodeValue(code: vscode.Diagnostic["code"]): string | number | undefined {
  if (code === undefined || code === null) {
    return undefined;
  }
  if (typeof code === "string" || typeof code === "number") {
    return code;
  }
  return code.value;
}
