import { CanvasError } from './errors.mjs';
import { createHash } from 'node:crypto';
import { assertTodoId } from './todos.mjs';

const MAX_REQUEST_ID = 128;
const MAX_INDEX_SIZE = 256;
const MANUAL = 'manual';
const AUTO = 'auto';
const SCOPE_TODO = 'todo';
const SCOPE_WORKSPACE = 'workspace';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalPayload(todoId, changes) {
  return createHash('sha256').update(JSON.stringify({ todoId, changes }), 'utf8').digest('hex');
}

function makeOutcome(mode, outcome, scope, reason, message, manualAction) {
  const meta = { mode, outcome, scope };
  if (reason !== undefined) meta.reason = reason;
  if (message !== undefined) meta.message = message;
  if (manualAction !== undefined) meta.manualAction = manualAction;
  return meta;
}

export function createApprovalController({ proposals, workspaceRoot, getView, assertWritable }) {
  if (!proposals || typeof proposals.create !== 'function' ||
      typeof proposals.list !== 'function' || typeof proposals.apply !== 'function') {
    throw new CanvasError('invalid_input', 'proposals store is required');
  }
  if (typeof getView !== 'function') {
    throw new CanvasError('invalid_input', 'getView is required');
  }

  let mode = MANUAL;
  let scope = null;
  let policyTodoId = null;
  let generation = 0;
  let disposed = false;

  // requestId -> { payloadKey, proposalId, promise }
  const requestIndex = new Map();
  // proposalId -> approval metadata
  const outcomeIndex = new Map();

  function currentView() {
    return getView();
  }

  function isSupported() {
    return !disposed && typeof assertWritable === 'function';
  }

  function effectiveMode() {
    if (mode !== AUTO) return MANUAL;
    const view = currentView();
    if (view?.kind !== 'todo') return MANUAL;
    if (scope === SCOPE_WORKSPACE) return AUTO;
    if (view?.kind === 'todo' && view.todoId === policyTodoId) return AUTO;
    return MANUAL;
  }

  function getPolicy() {
    return {
      mode,
      scope,
      todoId: policyTodoId,
      workspaceRoot,
      supported: isSupported(),
      sessionOnly: true,
      generation,
      effectiveMode: effectiveMode()
    };
  }

  function setPolicy(input) {
    if (disposed) {
      throw new CanvasError('disposed', 'Approval controller is disposed');
    }
    if (!isPlainObject(input)) {
      throw new CanvasError('invalid_input', 'input must be an object');
    }

    const allowedKeys = new Set(['mode', 'scope']);
    for (const key of Object.keys(input)) {
      if (!allowedKeys.has(key)) {
        throw new CanvasError('invalid_input', `unknown field "${key}"`);
      }
    }

    const requestedMode = input.mode;
    if (requestedMode !== MANUAL && requestedMode !== AUTO) {
      throw new CanvasError('invalid_input', 'mode must be "manual" or "auto"');
    }

    if (requestedMode === AUTO) {
      if (input.scope !== SCOPE_TODO && input.scope !== SCOPE_WORKSPACE) {
        throw new CanvasError('invalid_input', 'auto mode requires scope "todo" or "workspace"');
      }
      if (!isSupported()) {
        throw new CanvasError('unsupported', 'auto approval requires native assertWritable');
      }
      const view = currentView();
      if (view?.kind !== 'todo') {
        throw new CanvasError('invalid_input', 'auto approval requires current todo selection');
      }
      assertTodoId(view.todoId);
    } else if (input.scope !== undefined) {
      throw new CanvasError('invalid_input', 'manual mode has no automatic scope');
    }

    let requestedTodoId = null;
    if (requestedMode === AUTO && input.scope === SCOPE_TODO) {
      requestedTodoId = currentView().todoId;
    }

    mode = requestedMode;
    scope = requestedMode === AUTO ? input.scope : null;
    policyTodoId = requestedTodoId;
    generation++;
    return getPolicy();
  }

  function recordOutcome(proposalId, metadata) {
    const live = new Set(proposals.list().map(proposal => proposal.id));
    for (const id of outcomeIndex.keys()) if (!live.has(id)) outcomeIndex.delete(id);
    if (live.has(proposalId)) outcomeIndex.set(proposalId, { ...metadata });
  }

  function deriveOutcome(proposal) {
    const stored = outcomeIndex.get(proposal.id);
    if (stored) return { ...stored };
    const changeStates = proposal.changes.map(c => c.state);
    const hasPending = changeStates.some(s => s === 'pending');
    const allApplied = changeStates.every(s => s === 'applied');
    const allRejected = changeStates.every(s => s === 'rejected');
    let outcome;
    if (hasPending) outcome = 'pending';
    else if (allApplied) outcome = 'applied';
    else if (allRejected) outcome = 'rejected';
    else outcome = 'resolved';
    return makeOutcome(MANUAL, outcome, null, 'manual_record', `Manual review record: ${outcome}`);
  }

  async function create(input) {
    if (disposed) {
      throw new CanvasError('disposed', 'Approval controller is disposed');
    }
    if (!isPlainObject(input)) {
      throw new CanvasError('invalid_input', 'input must be an object');
    }

    const allowedKeys = new Set(['todoId', 'changes', 'requestId']);
    for (const key of Object.keys(input)) {
      if (!allowedKeys.has(key)) {
        throw new CanvasError('invalid_input', `unknown field "${key}"`);
      }
    }

    const todoId = assertTodoId(input.todoId);
    const requestId = input.requestId;

    if (!Array.isArray(input.changes) || input.changes.length === 0 || input.changes.length > 20) {
      throw new CanvasError('invalid_input', 'changes must be a non-empty array of at most 20 items');
    }
    // Copy the submission before asynchronous admission, preserving canonical field order.
    const keys = ['criterionIndex', 'met', 'rationale', 'evidence'];
    const changes = Array.from(input.changes, change => {
      if (!isPlainObject(change) || Object.keys(change).length !== keys.length || Object.keys(change).some(key => !keys.includes(key))) {
        throw new CanvasError('invalid_input', 'Each change requires only criterionIndex, met, rationale, and evidence');
      }
      return Object.fromEntries(keys.map(key => [key, change[key]]));
    });

    if (requestId !== undefined && (typeof requestId !== 'string' || !requestId.trim() || requestId.length > MAX_REQUEST_ID)) {
      throw new CanvasError('invalid_input', `requestId must be a non-empty string of at most ${MAX_REQUEST_ID} characters`);
    }
    const payloadKey = canonicalPayload(todoId, changes);
    const previous = requestId === undefined ? undefined : requestIndex.get(requestId);
    if (previous) {
      if (previous.payloadKey !== payloadKey) throw new CanvasError('duplicate_request', 'requestId already used for a different payload');
      if (previous.promise) await previous.promise;
      if (previous.error) throw previous.error;
      const found = proposals.list(todoId).find(proposal => proposal.id === previous.proposalId);
      if (found) return { ...found, approval: deriveOutcome(found) };
      throw new CanvasError('duplicate_request', 'Request already processed; its proposal history was evicted. It will not be repeated.');
    }
    if (requestId !== undefined && requestIndex.size >= MAX_INDEX_SIZE) {
      throw new CanvasError('capacity_reached', 'This canvas service reached its replay-protection capacity. Reload the extension/window to start a new service before new submissions; closing the panel only revokes authorization.');
    }
    const admission = { ...getPolicy(), effectiveMode: effectiveMode() };
    const record = { payloadKey, proposalId: null, promise: null, error: null };
    if (requestId !== undefined) requestIndex.set(requestId, record);
    // Register replay protection before the operation can enter a native asynchronous guard.
    record.promise = Promise.resolve().then(() => executeCreate(todoId, changes, requestId, record, admission));
    try {
      const result = await record.promise;
      const current = proposals.list(todoId).find(proposal => proposal.id === record.proposalId);
      return current ? { ...current, approval: deriveOutcome(current) } : structuredClone(result);
    } catch (err) {
      record.error = err;
      throw err;
    } finally {
      record.promise = null;
    }
  }

  async function executeCreate(todoId, changes, requestId, record, admission) {
    if (disposed) throw new CanvasError('disposed', 'Approval controller is disposed');
    const proposal = proposals.create({ todoId, changes });
    record.proposalId = proposal.id;

    if (admission.mode === MANUAL) {
      const metadata = makeOutcome(MANUAL, 'pending', null, 'manual_mode', 'Requires manual approval');
      recordOutcome(proposal.id, metadata);
      return { ...proposal, approval: metadata };
    }
    const defer = (reason, message) => {
      const metadata = makeOutcome(AUTO, 'deferred', admission.scope, reason, message);
      recordOutcome(proposal.id, metadata);
      return { ...proposal, approval: metadata };
    };
    if (admission.effectiveMode === MANUAL) return defer('scope_mismatch', 'Current selection is outside the automatic approval scope; manual review is required.');

    // Auto mode requires requestId for safe replay
    if (!requestId) {
      return defer('missing_request_id', 'Automatic approval requires a requestId for safe replay; manual review is required.');
    }

    // Validate native guard is available
    if (!isSupported()) {
      return defer('unsupported', 'Native write guard unavailable; manual review is required.');
    }

    // Validate current selection matches
    const view = currentView();
    if (view?.kind !== 'todo' || view.todoId !== todoId) {
      return defer('selection_mismatch', 'Current selection does not match the request; manual review is required.');
    }

    // Validate policy todo scope if applicable
    if (admission.scope === SCOPE_TODO && admission.todoId !== todoId) return defer('scope_mismatch', 'Todo is outside the approved scope; manual review is required.');
    if (generation !== admission.generation) return defer('stale_policy', 'Approval mode changed after submission; manual review is required.');
    if (proposal.workspaceRoot !== workspaceRoot) return defer('scope_mismatch', 'Proposal belongs to another workspace; automatic application is blocked.');

    const changeIds = proposal.changes.map(c => c.id);
    let applyResult;
    try {
      applyResult = await proposals.apply(proposal.id, changeIds, {
        assertWritable: async id => {
          await assertWritable(id);
          if (disposed) {
            throw new CanvasError('disposed', 'Approval controller was disposed during guard check');
          }
          if (generation !== admission.generation) {
            throw new CanvasError('stale_policy', 'Approval policy changed during guard check');
          }
          const cv = currentView();
          if (cv?.kind !== 'todo' || cv.todoId !== id) {
            throw new CanvasError('stale_selection', 'Selection changed during guard check');
          }
        }
      });
    } catch (err) {
      const reason = typeof err?.code === 'string' ? err.code : 'apply_failed';
      return defer(reason, 'Automatic application was blocked or failed. Changes remain pending; inspect the evidence and native permissions before manual review.');
    }

    const metadata = makeOutcome(AUTO, 'applied', admission.scope, 'native_guard_passed', 'Supported checkbox changes were applied automatically through the native write guard. This is local progress, not remote scanner verification.');
    recordOutcome(applyResult.id, metadata);
    return { ...applyResult, approval: metadata };
  }

  function list(todoId) {
    const proposalsList = proposals.list(todoId);
    return proposalsList.map(p => {
      return { ...p, approval: deriveOutcome(p) };
    });
  }

  function noteManual(proposalId, action) {
    if (typeof proposalId !== 'string' || !proposalId.trim()) {
      throw new CanvasError('invalid_input', 'proposalId is required');
    }
    if (action !== 'applied' && action !== 'rejected') {
      throw new CanvasError('invalid_input', 'action must be applied or rejected');
    }

    const all = proposals.list();
    const proposal = all.find(p => p.id === proposalId);
    if (!proposal) return;

    const previous = outcomeIndex.get(proposal.id);
    const metadata = previous?.mode === AUTO ? { ...previous, manualAction: action }
      : makeOutcome(MANUAL, proposal.state, null, 'manual_action', `Manually ${action}`, action);
    recordOutcome(proposal.id, metadata);
    return { ...proposal, approval: metadata };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    mode = MANUAL;
    scope = null;
    policyTodoId = null;
    generation++;
    requestIndex.clear();
  }

  return {
    getPolicy,
    setPolicy,
    create,
    list,
    noteManual,
    dispose
  };
}
