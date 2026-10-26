import { CanvasError } from './errors.mjs';
import { assertTodoId, findTodoFile, loadTodo, applyCriteriaChanges } from './todos.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const MAX_CHANGES = 20;
const MAX_PROPOSALS_PER_STORE = 20;
const RATIONALE_MAX = 1000;
const EVIDENCE_MAX = 1000;
const CHANGE_ID_PREFIX = 'ch-';
const PROPOSAL_ID_PREFIX = 'prop-';
let counter = 0;

function sha256(text) {
  return createHash('sha256').update(text, 'utf-8').digest('hex');
}

function nextId(prefix) {
  counter = (counter + 1) % 100000;
  return `${prefix}${Date.now().toString(36)}-${counter}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function defensiveCopyProposal(p) {
  return {
    id: p.id,
    todoId: p.todoId,
    title: p.title,
    workspaceRoot: p.workspaceRoot,
    revision: { ...p.revision },
    state: p.state,
    createdAt: p.createdAt,
    changes: p.changes.map(c => ({ ...c }))
  };
}

export function createProposalStore(workspaceRoot) {
  const proposals = new Map();
  let locked = false;

  function withLock(fn) {
    if (locked) throw new CanvasError('busy', 'Another proposal operation is in progress');
    locked = true;
    let asynchronous = false;
    try {
      const result = fn();
      if (result instanceof Promise) {
        asynchronous = true;
        return result.finally(() => { locked = false; });
      }
      return result;
    } finally {
      if (!asynchronous) locked = false;
    }
  }

  function updateState(proposal) {
    const states = new Set(proposal.changes.map(change => change.state));
    proposal.state = states.has('pending') ? 'pending' : states.size > 1 ? 'resolved' : [...states][0];
  }

  function getProposal(id) {
    const p = proposals.get(id);
    if (!p) {
      throw new CanvasError('proposal_not_found', `Proposal ${id} not found`);
    }
    return p;
  }

  function findPendingChanges(proposal, changeIds) {
    if (!Array.isArray(changeIds) || changeIds.length === 0) {
      throw new CanvasError('invalid_input', 'changeIds must be a non-empty array');
    }
    const ids = new Set(changeIds);
    if (ids.size !== changeIds.length) {
      throw new CanvasError('invalid_input', 'changeIds contains duplicates');
    }
    const found = [];
    for (const id of changeIds) {
      const c = proposal.changes.find(ch => ch.id === id);
      if (!c) {
        throw new CanvasError('change_not_found', `Change ${id} not found in proposal`);
      }
      if (c.state !== 'pending') {
        throw new CanvasError('change_not_pending', `Change ${id} is not pending`);
      }
      found.push(c);
    }
    return found;
  }

  return {
    create(input) {
      return withLock(() => {
        if (!isPlainObject(input)) {
          throw new CanvasError('invalid_input', 'input must be an object');
        }

        // Strict key validation: only todoId and changes allowed
        const allowedKeys = new Set(['todoId', 'changes']);
        for (const key of Object.keys(input)) {
          if (!allowedKeys.has(key)) {
            throw new CanvasError('invalid_input', `unknown field "${key}"`);
          }
        }

        const todoId = assertTodoId(input.todoId);
        if (!Array.isArray(input.changes)) {
          throw new CanvasError('invalid_input', 'changes must be an array');
        }
        if (input.changes.length === 0) {
          throw new CanvasError('invalid_input', 'changes must not be empty');
        }
        if (input.changes.length > MAX_CHANGES) {
          throw new CanvasError('invalid_input', `changes must be at most ${MAX_CHANGES}`);
        }

        // Capacity check: if store is full and all pending, reject
        const pendingCount = [...proposals.values()].filter(p => p.state === 'pending').length;
        if (pendingCount >= MAX_PROPOSALS_PER_STORE) {
          throw new CanvasError('capacity_reached', 'Proposal store has reached maximum pending capacity');
        }

        // Consistent snapshot: hash file, load todo, hash again
        const filePath = findTodoFile(todoId, workspaceRoot);
        if (!filePath) {
          throw new CanvasError('todo_not_found', `Todo ${todoId} not found`);
        }

        const beforeContent = readFileSync(filePath, 'utf-8');
        const beforeHash = sha256(beforeContent);
        const todo = loadTodo(todoId, workspaceRoot);
        const afterContent = readFileSync(filePath, 'utf-8');
        const afterHash = sha256(afterContent);
        if (beforeHash !== afterHash || findTodoFile(todoId, workspaceRoot) !== filePath) {
          throw new CanvasError('stale_revision', `Todo ${todoId} changed during proposal creation`);
        }

        const revision = { content: beforeHash, path: filePath };

        // Validate changes against todo criteria
        const seenCriteria = new Set();
        const changes = input.changes.map((raw, i) => {
          if (!isPlainObject(raw)) {
            throw new CanvasError('invalid_input', `change[${i}] must be an object`);
          }

          // Strict key validation for each change
          const changeKeys = new Set(['criterionIndex', 'met', 'rationale', 'evidence']);
          for (const key of Object.keys(raw)) {
            if (!changeKeys.has(key)) {
              throw new CanvasError('invalid_input', `change[${i}] has unknown field "${key}"`);
            }
          }

          const criterionIndex = raw.criterionIndex;
          if (!Number.isInteger(criterionIndex) || criterionIndex < 0) {
            throw new CanvasError('invalid_input', `change[${i}].criterionIndex must be a non-negative integer`);
          }
          if (criterionIndex >= todo.criteria.length) {
            throw new CanvasError('invalid_input', `change[${i}].criterionIndex ${criterionIndex} out of range`);
          }
          if (seenCriteria.has(criterionIndex)) {
            throw new CanvasError('invalid_input', `duplicate criterion index ${criterionIndex}`);
          }
          seenCriteria.add(criterionIndex);

          const after = raw.met;
          if (typeof after !== 'boolean') {
            throw new CanvasError('invalid_input', `change[${i}].met must be a boolean`);
          }
          const before = todo.criteria[criterionIndex].met;
          if (before === after) {
            throw new CanvasError('invalid_input', `change[${i}] is a no-op (criterion ${criterionIndex} already ${after ? 'met' : 'not met'})`);
          }

          // rationale and evidence: required, nonempty after trim, bounded
          if (typeof raw.rationale !== 'string' || raw.rationale.trim().length === 0) {
            throw new CanvasError('invalid_input', `change[${i}].rationale must be a non-empty string`);
          }
          if (typeof raw.evidence !== 'string' || raw.evidence.trim().length === 0) {
            throw new CanvasError('invalid_input', `change[${i}].evidence must be a non-empty string`);
          }
          if (raw.rationale.length > RATIONALE_MAX) {
            throw new CanvasError('invalid_input', `change[${i}].rationale must be at most ${RATIONALE_MAX} characters`);
          }
          if (raw.evidence.length > EVIDENCE_MAX) {
            throw new CanvasError('invalid_input', `change[${i}].evidence must be at most ${EVIDENCE_MAX} characters`);
          }

          return {
            id: nextId(CHANGE_ID_PREFIX),
            field: 'criterion.met',
            criterionIndex,
            text: todo.criteria[criterionIndex].text,
            before,
            after,
            rationale: raw.rationale,
            evidence: raw.evidence,
            state: 'pending'
          };
        });

        // Title captured from todo, not caller
        const proposal = {
          id: nextId(PROPOSAL_ID_PREFIX),
          todoId,
          title: `Proposed changes for ${todo.title}`,
          workspaceRoot,
          revision: { ...revision },
          state: 'pending',
          createdAt: new Date().toISOString(),
          changes
        };

        // Keep both pending work and resolved history bounded, without silently dropping pending work.
        if (proposals.size >= MAX_PROPOSALS_PER_STORE) {
          const resolved = [...proposals.values()].find(item => item.state !== 'pending');
          if (!resolved) throw new CanvasError('capacity_reached', 'Review an existing proposal before creating another');
          proposals.delete(resolved.id);
        }
        proposals.set(proposal.id, proposal);
        return defensiveCopyProposal(proposal);
      });
    },

    list(todoId) {
      const id = typeof todoId === 'string' ? assertTodoId(todoId) : null;
      return [...proposals.values()]
        .filter(p => !id || p.todoId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, MAX_PROPOSALS_PER_STORE)
        .map(defensiveCopyProposal);
    },

    async apply(proposalId, changeIds, options = {}) {
      return withLock(async () => {
        const proposal = getProposal(proposalId);
        if (proposal.state !== 'pending') {
          throw new CanvasError('proposal_not_pending', `Proposal ${proposalId} is not pending`);
        }
        const selected = findPendingChanges(proposal, changeIds);

        const { assertWritable } = options;
        if (typeof assertWritable !== 'function') {
          throw new CanvasError('unsupported', 'apply requires an assertWritable callback');
        }

        // Guard check first; no direct-write fallback
        await assertWritable(proposal.todoId);

        // Map selected changes to the format expected by shared applyCriteriaChanges
        const todoChanges = selected.map(c => ({
          criterionIndex: c.criterionIndex,
          met: c.after
        }));

        // Call shared validated operation with expected revision
        const result = applyCriteriaChanges(proposal.todoId, todoChanges, workspaceRoot, proposal.revision);

        // Mark selected changes as applied only after successful file commit
        for (const c of selected) {
          c.state = 'applied';
        }

        // Rebase revision to post-write state for remaining pending changes
        proposal.revision = result.revision;
        updateState(proposal);

        return defensiveCopyProposal(proposal);
      });
    },

    reject(proposalId, changeIds) {
      return withLock(() => {
        const proposal = getProposal(proposalId);
        if (proposal.state !== 'pending') {
          throw new CanvasError('proposal_not_pending', `Proposal ${proposalId} is not pending`);
        }
        const selected = findPendingChanges(proposal, changeIds);
        for (const c of selected) {
          c.state = 'rejected';
        }
        updateState(proposal);
        return defensiveCopyProposal(proposal);
      });
    }
  };
}
