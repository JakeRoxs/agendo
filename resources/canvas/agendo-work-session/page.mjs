import { escapeHtml, inlineMarkdown, renderMarkdown } from './markdown.mjs';

const VISIBLE_LOG_ENTRIES = 3;

// What matters depends on where the todo is in its lifecycle: a todo being triaged is about
// understanding the problem, active work is about the next step, and a finished todo is a record.
// `order` is the render order; only the sections in `open` start expanded.
const PROFILES = {
  pending: { order: ['description', 'triage', 'deps', 'criteria', 'resume', 'work-log'], open: ['description', 'triage', 'deps'] },
  'in-progress': { order: ['resume', 'criteria', 'deps', 'work-log', 'description', 'triage'], open: ['resume', 'criteria', 'work-log'] },
  ready: { order: ['criteria', 'resume', 'work-log', 'deps', 'description', 'triage'], open: ['criteria', 'resume', 'work-log'] },
  backlogged: { order: ['description', 'triage', 'deps', 'criteria', 'resume', 'work-log'], open: ['description', 'triage'] },
  complete: { order: ['description', 'work-log', 'criteria', 'triage', 'deps', 'resume'], open: ['description', 'work-log'] },
  cancelled: { order: ['description', 'work-log', 'deps', 'criteria', 'triage', 'resume'], open: ['description', 'work-log'] }
};
export const STATUS_OPTIONS = ['pending', 'in-progress', 'ready', 'backlogged', 'complete', 'cancelled'];

function todoSource(id) {
  if (id.startsWith('cql-')) return { key: 'codeql', label: 'cql' };
  if (id.startsWith('sq-')) return { key: 'sonarqube', label: 'sq' };
  return { key: 'todo', label: 'todo' };
}

function sourceBadge(id) {
  const source = todoSource(id);
  return `<span class="badge badge-source source-${source.key}" aria-label="Source: ${source.label}">${source.label}</span>`;
}

// Every section is collapsible; the page script remembers the choice per todo.
function collapsible(id, title, content, { open = true, hint = '', auto = false } = {}) {
  return `<section aria-labelledby="${id}-heading"><details class="collapsible" id="${id}" data-section="${id}"${open ? ' open' : ''} data-auto-open="${auto}"><summary><h2 id="${id}-heading">${title}${hint ? ` <span class="hint">${escapeHtml(hint)}</span>` : ''}</h2></summary>${content}</details></section>`;
}

export function renderCanvas(todo, relations, nav, actions = {}) {
  if (!todo) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Agendo Work Session</title>
    <link rel="stylesheet" href="/page.css"></head>
    <body><main class="empty"><h1>Agendo Work Session</h1><p>No todo selected. Ask the agent to open a todo in this canvas.</p></main></body></html>`;
  }

  const profile = PROFILES[todo.status] ?? PROFILES.pending;
  const isOpen = id => profile.open.includes(id);

  const done = todo.criteria.filter(c => c.met).length;
  const total = todo.criteria.length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  const criteriaHtml = total > 0 ? collapsible('criteria', 'Acceptance Criteria', `
      <div class="progress-bar" role="progressbar" aria-label="Acceptance criteria progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><div class="progress-fill" style="width:${percent}%"></div></div>
      <p class="progress-text">${done}/${total} complete</p>
      <ul class="criteria-list">
        ${todo.criteria.map((c, i) => `<li class="${c.met ? 'met' : ''}"><label><input type="checkbox" ${c.met ? 'checked' : ''} data-index="${i}"><span>${inlineMarkdown(c.text)}</span></label></li>`).join('')}
      </ul>`, { open: isOpen('criteria'), hint: `${done}/${total}` }) : '';

  const descriptionHtml = todo.description
    ? collapsible('description', 'Description', `<div class="box">${renderMarkdown(todo.description)}</div>`, { open: isOpen('description') })
    : '';

  const terminal = todo.status === 'complete' || todo.status === 'cancelled';
  const depsHtml = relations ? renderRelations(relations, terminal, isOpen('deps')) : '';

  const triageHtml = todo.triage.length > 0
    ? collapsible('triage', 'Triage', todo.triage.map(t => `<h3>${escapeHtml(t.heading)}</h3><div class="box">${renderMarkdown(t.text)}</div>`).join(''), { open: isOpen('triage'), hint: todo.triage.map(t => t.heading).join(' · ') })
    : '';

  const resumeHtml = todo.resumeContext
    ? collapsible('resume', 'Resume Context', `<div class="box">${renderMarkdown(todo.resumeContext)}</div>`, { open: isOpen('resume') })
    : '';

  const hasExtra = todo.workLog.length > VISIBLE_LOG_ENTRIES;
  const workLogHtml = todo.workLog.length > 0 ? collapsible('work-log', 'Work Log', `
      <div id="work-log-entries">
      ${todo.workLog.map((e, i) => `<article class="log-entry box${i >= VISIBLE_LOG_ENTRIES ? ' extra' : ''}"><h3>${escapeHtml(e.date)}</h3>${renderMarkdown(e.content)}</article>`).join('')}
      ${hasExtra ? `<button type="button" id="toggle-log" aria-expanded="false" data-label="Show all ${todo.workLog.length} entries">Show all ${todo.workLog.length} entries</button>` : ''}
      </div>`, { open: isOpen('work-log'), hint: String(todo.workLog.length) }) : '';

  const byId = { criteria: criteriaHtml, description: descriptionHtml, triage: triageHtml, deps: depsHtml, resume: resumeHtml, 'work-log': workLogHtml };
  const sections = profile.order.map(id => byId[id]).join('');

  const statusPill = `<label class="badge-select"><span class="visually-hidden">Change status</span><select data-status-select class="badge status-${escapeHtml(todo.status)}" aria-label="Change status">${STATUS_OPTIONS.map(s => `<option value="${s}"${s === todo.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label>`;
  const editButton = actions.edit ? '<button type="button" class="edit-button" data-edit title="Edit todo file" aria-label="Edit todo file"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m16 3 5 5-12 12H4v-5Z"/><path d="m13 6 5 5"/></svg><span>Edit</span></button>' : '';
  const navigation = renderNav(nav);

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(todo.title)}</title>
  <link rel="stylesheet" href="/page.css"></head>
  <body data-todo-id="${escapeHtml(todo.id)}" data-status="${escapeHtml(todo.status)}" data-percent="${percent}">
    <main>
      ${navigation || editButton ? `<div class="canvas-toolbar">${navigation}${editButton}</div>` : ''}
      <h1><span class="todo-id">#${escapeHtml(todo.id)}</span>${escapeHtml(todo.title)}</h1>
      <div class="meta">
        ${sourceBadge(todo.id)}
        ${statusPill}
        <span class="badge badge-priority">${escapeHtml(todo.priority)}</span>
      </div>
      ${sections}
      <p class="error" id="status-message" role="status" aria-live="polite"></p>
    </main>
    <script src="/page.js"></script>
  </body></html>`;
}

function todoItem(item, note) {
  const badges = `${sourceBadge(item.id)}<span class="badge status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span><span class="badge badge-priority">${escapeHtml(item.priority)}</span>`;
  return `<li class="${item.satisfied || item.active === false ? 'settled' : ''}"><button type="button" class="todo-link" data-open="${escapeHtml(item.id)}"><span class="todo-id">#${escapeHtml(item.id)}</span>${escapeHtml(item.title)}</button>${badges}${note ? `<span class="note">${note}</span>` : ''}</li>`;
}

function renderRelations({ blocked, dependencies, dependents }, terminal, profileOpen) {
  // A finished todo no longer blocks anything, so only its own blockers are worth showing.
  const shownDependents = terminal ? [] : dependents;
  if (dependencies.length === 0 && shownDependents.length === 0) return '';

  const open = dependencies.filter(d => !d.satisfied).length;
  const waiting = shownDependents.filter(d => d.active).length;
  const needsAttention = !terminal && (blocked || waiting > 0);

  const depItems = dependencies.map(d => {
    if (d.missing) return `<li class="unresolved"><span class="todo-id">#${escapeHtml(d.id)}</span>${sourceBadge(d.id)}Not found<span class="note">unresolved dependency</span></li>`;
    const notes = [];
    if (d.status === 'cancelled') notes.push('cancelled, reassess this todo');
    if (d.circular) notes.push('circular dependency');
    return todoItem(d, notes.join(' · '));
  }).join('');

  const blockedBy = dependencies.length === 0 ? '' : `
      <h3>Blocked by</h3>
      <p class="summary ${blocked && !terminal ? 'warn' : 'ok'}" role="status">${blocked ? `${open} of ${dependencies.length} still open` : 'All dependencies satisfied'}</p>
      <ul class="relations">${depItems}</ul>`;

  const blocks = shownDependents.length === 0 ? '' : `
      <h3>Blocks</h3>
      <p class="summary">${waiting > 0 ? `${waiting} active ${waiting === 1 ? 'todo is' : 'todos are'} waiting on this` : 'Nothing active is waiting on this'}</p>
      <ul class="relations">${shownDependents.map(d => todoItem(d)).join('')}</ul>`;

  const parts = [];
  if (blocked && !terminal) parts.push(`${open} open ${open === 1 ? 'blocker' : 'blockers'}`);
  if (waiting > 0) parts.push(`${waiting} waiting`);
  const hint = parts.length > 0 ? parts.join(' · ') : 'nothing open';

  return collapsible('deps', 'Dependencies', `<div class="box">${blockedBy}${blocks}</div>`, { open: needsAttention || profileOpen, hint, auto: true });
}

// The current todo is already the dropdown's selection, so chips only show the others.
const VISIBLE_CHIPS = 4;

function renderNav(nav) {
  if (!nav) return '';
  const multiple = nav.recent.length > 1;
  const chips = multiple ? `<ul class="recent" aria-label="Recent todos">${nav.recent.filter(r => !r.current).slice(0, VISIBLE_CHIPS).map(r => `<li><button type="button" class="chip status-border-${escapeHtml(r.status)}" data-open="${escapeHtml(r.id)}" title="${todoSource(r.id).label}: ${escapeHtml(r.title)} (${escapeHtml(r.status)})">${sourceBadge(r.id)} #${escapeHtml(r.id)}</button></li>`).join('')}</ul>` : '';
  const current = nav.recent.find(r => r.current);
  const select = multiple ? `<label class="recent-select"><span class="visually-hidden">Jump to a recent todo</span><select data-open-select class="status-border-${escapeHtml(current?.status ?? 'missing')}">${nav.recent.map(r => `<option class="status-border-${escapeHtml(r.status)}" value="${escapeHtml(r.id)}"${r.current ? ' selected' : ''}>${todoSource(r.id).label} · #${escapeHtml(r.id)} ${escapeHtml(r.title)} (${escapeHtml(r.status)})</option>`).join('')}</select></label>` : '';
  return `<nav class="history" aria-label="Todo history">
        <button type="button" data-nav="back" aria-label="Back"${nav.canBack ? '' : ' disabled'}>&larr;</button>
        <button type="button" data-nav="forward" aria-label="Forward"${nav.canForward ? '' : ' disabled'}>&rarr;</button>
        ${select}
        ${chips}
      </nav>`;
}
