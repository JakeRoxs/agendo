import { escapeHtml, inlineMarkdown, renderMarkdown } from './markdown.mjs';

const VISIBLE_LOG_ENTRIES = 3;

// What matters depends on where the todo is in its lifecycle: a todo being triaged is about
// understanding the problem, active work is about the next step, and a finished todo is a record.
// `order` is the render order; only the sections in `open` start expanded.
const PROFILES = {
  pending: { order: ['scanner', 'description', 'triage', 'deps', 'criteria', 'resume', 'work-log'], open: ['scanner', 'description', 'triage', 'deps'] },
  'in-progress': { order: ['resume', 'criteria', 'deps', 'work-log', 'scanner', 'description', 'triage'], open: ['resume', 'criteria', 'work-log'] },
  ready: { order: ['criteria', 'resume', 'work-log', 'deps', 'scanner', 'description', 'triage'], open: ['criteria', 'resume', 'work-log'] },
  backlogged: { order: ['scanner', 'description', 'triage', 'deps', 'criteria', 'resume', 'work-log'], open: ['scanner', 'description', 'triage'] },
  complete: { order: ['description', 'scanner', 'work-log', 'criteria', 'triage', 'deps', 'resume'], open: ['description', 'work-log'] },
  cancelled: { order: ['description', 'scanner', 'work-log', 'deps', 'criteria', 'triage', 'resume'], open: ['description', 'work-log'] }
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

function displayId(id) {
  return id.replace(/^(?:sq|cql)-/, '');
}

function scannerText(text) {
  return text.replace(/\\([\\`*_{}[\]<>#|!])/g, '$1');
}

function displayTitle(todo) {
  return todoSource(todo.id).key === 'todo'
    ? todo.title
    : scannerText(todo.title.replace(/^(?:SonarQube|CodeQL):\s*/i, ''));
}

// Every section is collapsible; the page script remembers the choice per todo.
function collapsible(id, title, content, { open = true, hint = '', auto = false, level = 2 } = {}) {
  return `<section aria-labelledby="${id}-heading"><details class="collapsible" id="${id}" data-section="${id}"${open ? ' open' : ''} data-auto-open="${auto}"><summary><h${level} id="${id}-heading">${title}${hint ? ` <span class="hint">${escapeHtml(hint)}</span>` : ''}</h${level}></summary>${content}</details></section>`;
}

// Only structural headings split the evidence; headings inside examples stay in the example.
function scannerSections(markdown) {
  const sections = [];
  let section = { title: '', level: 0, lines: [] };
  let fence = null;
  for (const line of markdown.split(/\r?\n/)) {
    const marker = line.trim().match(/^(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      section.lines.push(line);
      continue;
    }
    const heading = !fence && line.match(/^(#{3,4})\s+(.+)$/);
    if (heading) {
      sections.push(section);
      section = { title: heading[2], level: heading[1].length, lines: [] };
    } else section.lines.push(line);
  }
  sections.push(section);
  return sections.map(({ title, level, lines }) => ({ title, level, body: lines.join('\n').trim() }));
}

function renderScannerEvidence(markdown, expanded) {
  const files = new Map();
  const context = [];
  const rules = [];
  const ruleIds = new Set();
  const severities = new Set();
  let activeRule = null;
  let count = 0;
  for (const section of scannerSections(markdown)) {
    if (section.level === 3 && section.title.startsWith('Rule: ')) {
      const key = section.body.match(/^\*\*Rule ID:\*\*\s*(.+)$/m)?.[1];
      activeRule = { title: scannerText(section.title.slice(6)), key: key ? scannerText(key) : '', sections: [] };
      rules.push(activeRule);
      const body = section.body.replace(/^\*\*Rule ID:\*\*[^\r\n]*(?:\r?\n|$)/m, '').trim();
      if (body) activeRule.sections.push({ title: 'Rule Overview', body });
      continue;
    }
    const location = !activeRule && section.title.match(/^File: (.+) \| Line: (.+)$/);
    if (location) {
      const path = scannerText(location[1]);
      const findings = files.get(path) ?? [];
      findings.push({ line: scannerText(location[2]), body: section.body });
      files.set(path, findings);
      const severity = section.body.match(/^\*\*Severity:\*\*\s*(.+)$/m)?.[1];
      if (severity) severities.add(scannerText(severity));
      const rule = section.body.match(/^\*\*Rule:\*\*\s*(.+)$/m)?.[1];
      if (rule) ruleIds.add(scannerText(rule));
      count++;
    } else if (section.body) {
      (activeRule?.sections ?? context).push({ title: scannerText(section.title || 'Additional Evidence'), body: section.body });
    }
  }
  if (!files.size) return renderMarkdown(markdown);

  const fileSections = [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, findings]) => {
    const id = `scanner-file-${encodeURIComponent(path)}`;
    const label = `${findings.length} ${findings.length === 1 ? 'finding' : 'findings'}`;
    const content = findings.sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true })).map(finding => `<article class="scanner-finding"><h4>Line ${escapeHtml(finding.line)}</h4><div class="box">${renderMarkdown(finding.body)}</div></article>`).join('');
    return { id, title: path, label, html: collapsible(id, escapeHtml(path), content, { open: expanded, level: 3, hint: label }) };
  });
  const jumpLinks = sections => sections.map(section => `<li><a href="#${encodeURIComponent(section.id)}" data-section-link="${section.id}">${escapeHtml(section.title)}${section.label ? ` <span class="hint">${escapeHtml(section.label)}</span>` : ''}</a>${section.children?.length ? `<ul>${jumpLinks(section.children)}</ul>` : ''}</li>`).join('');
  const multipleRules = ruleIds.size > 1 || rules.length > 1;
  const contextGroup = (sections, prefix, level) => sections.map((section, index) => {
    const id = `${prefix}${index}`;
    return { id, title: section.title, html: collapsible(id, escapeHtml(section.title), `<div class="box">${renderMarkdown(section.body)}</div>`, { open: false, level }) };
  });
  let contextHtml;
  let contextLinks;
  if (multipleRules) {
    const groups = rules.map((rule, index) => {
      const id = `scanner-rule-${index}`;
      const title = rule.key && rule.key !== rule.title ? `${rule.key} · ${rule.title}` : rule.title;
      const children = contextGroup(rule.sections, `scanner-context-${index}-`, 4);
      return {
        id, title, children,
        html: collapsible(id, escapeHtml(title), children.map(section => section.html).join(''), { open: false, level: 3 }),
      };
    });
    const extra = contextGroup(context, 'scanner-context-extra-', 3);
    contextHtml = groups.map(group => group.html).join('') + extra.map(section => section.html).join('');
    contextLinks = jumpLinks(groups) + jumpLinks(extra);
  } else {
    const sections = contextGroup([...context, ...rules.flatMap(rule => rule.sections)], 'scanner-context-', 3);
    contextHtml = sections.map(section => section.html).join('');
    contextLinks = jumpLinks(sections);
  }
  const ruleTitle = !multipleRules && rules[0]?.title;
  const ruleCount = ruleIds.size || rules.length;
  return `<div class="scanner-overview"><h3>${escapeHtml(ruleTitle || 'Scanner findings')}</h3><p>${count} ${count === 1 ? 'finding' : 'findings'} across ${files.size} ${files.size === 1 ? 'file' : 'files'}${ruleCount ? ` · ${ruleCount} ${ruleCount === 1 ? 'rule type' : 'rule types'}` : ''}${severities.size ? ` · ${escapeHtml([...severities].join(' · '))}` : ''}</p></div>
    <nav class="scanner-toc" aria-label="Scanner contents"><div><p class="toc-label">Affected Files</p><ul>${jumpLinks(fileSections)}</ul></div>${contextLinks ? `<div><p class="toc-label">Rule Context</p><ul>${contextLinks}</ul></div>` : ''}</nav>
    <div class="scanner-files" aria-label="Affected files">${fileSections.map(section => section.html).join('')}</div>
    ${contextHtml ? `<div class="scanner-context" aria-label="Rule context">${contextHtml}</div>` : ''}`;
}

export function renderCanvas(todo, relations, nav, actions = {}) {
  if (!todo) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Agendo Work Session</title>
    <link rel="stylesheet" href="/page.css"></head>
    <body><main class="empty"><h1>Agendo Work Session</h1><p>No todo selected. Ask the agent to open a todo in this canvas.</p></main></body></html>`;
  }

  const profile = PROFILES[todo.status] ?? PROFILES.pending;
  const isOpen = id => profile.open.includes(id);
  const pending = todo.status === 'pending';

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

  const scannerHtml = todo.scannerEvidence
    ? collapsible('scanner', 'Scanner Problem & Evidence', `<div class="scanner-evidence">${renderScannerEvidence(todo.scannerEvidence, isOpen('scanner'))}</div>`, { open: isOpen('scanner') })
    : '';

  const terminal = todo.status === 'complete' || todo.status === 'cancelled';
  const depsHtml = relations ? renderRelations(relations, terminal, isOpen('deps')) : '';

  const triageHtml = todo.triage.length > 0
    ? collapsible('triage', 'Triage', todo.triage.map(t => `<h3>${escapeHtml(t.heading)}</h3><div class="box">${renderMarkdown(t.text)}</div>`).join(''), { open: isOpen('triage'), hint: todo.triage.map(t => t.heading).join(' · ') })
    : pending ? collapsible('triage', 'Triage', '<div class="box"><p>No triage notes yet. Record findings, compare proposed solutions, and write a recommended action in the todo file before marking it ready.</p></div>', { open: true, hint: 'not recorded' }) : '';

  const resumeHtml = todo.resumeContext
    ? collapsible('resume', 'Resume Context', `<div class="box">${renderMarkdown(todo.resumeContext)}</div>`, { open: isOpen('resume') })
    : '';

  const hasExtra = todo.workLog.length > VISIBLE_LOG_ENTRIES;
  const workLogHtml = todo.workLog.length > 0 ? collapsible('work-log', 'Work Log', `
      <div id="work-log-entries">
      ${todo.workLog.map((e, i) => `<article class="log-entry box${i >= VISIBLE_LOG_ENTRIES ? ' extra' : ''}"><h3>${escapeHtml(e.date)}</h3>${renderMarkdown(e.content)}</article>`).join('')}
      ${hasExtra ? `<button type="button" id="toggle-log" aria-expanded="false" data-label="Show all ${todo.workLog.length} entries">Show all ${todo.workLog.length} entries</button>` : ''}
      </div>`, { open: isOpen('work-log'), hint: String(todo.workLog.length) }) : '';

  const byId = { criteria: criteriaHtml, description: descriptionHtml, scanner: scannerHtml, triage: triageHtml, deps: depsHtml, resume: resumeHtml, 'work-log': workLogHtml };
  const sections = profile.order.map(id => byId[id]).join('');

  const statusPill = `<label class="badge-select"><span class="visually-hidden">Change status</span><select data-status-select class="badge status-${escapeHtml(todo.status)}" aria-label="Change status">${STATUS_OPTIONS.map(s => `<option value="${s}"${s === todo.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label>`;
  const editButton = actions.edit ? '<button type="button" class="edit-button" data-edit title="Edit todo file" aria-label="Edit todo file"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m16 3 5 5-12 12H4v-5Z"/><path d="m13 6 5 5"/></svg><span>Edit</span></button>' : '';
  const navigation = renderNav(nav);

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(displayTitle(todo))}</title>
  <link rel="stylesheet" href="/page.css"></head>
  <body data-todo-id="${escapeHtml(todo.id)}" data-status="${escapeHtml(todo.status)}" data-percent="${percent}">
    <main>
      ${navigation || editButton ? `<div class="canvas-toolbar">${navigation}${editButton}</div>` : ''}
      <h1><span class="todo-id">#${escapeHtml(displayId(todo.id))}</span>${escapeHtml(displayTitle(todo))}</h1>
      <div class="meta">
        ${sourceBadge(todo.id)}
        ${statusPill}
        <span class="badge badge-priority">${escapeHtml(todo.priority)}</span>
      </div>
      ${pending ? '<aside class="triage-guide" aria-label="Pending todo guidance"><h2>Needs triage</h2><p>Understand the problem before starting implementation. Review the evidence, record your findings and recommendation, then choose ready, backlogged, or cancelled using the status selector.</p></aside>' : ''}
      ${sections}
      <p class="error" id="status-message" role="status" aria-live="polite"></p>
    </main>
    <script src="/page.js"></script>
  </body></html>`;
}

function todoItem(item, note) {
  const badges = `${sourceBadge(item.id)}<span class="badge status-${escapeHtml(item.status)}">${escapeHtml(item.status)}</span><span class="badge badge-priority">${escapeHtml(item.priority)}</span>`;
  return `<li class="${item.satisfied || item.active === false ? 'settled' : ''}"><button type="button" class="todo-link" data-open="${escapeHtml(item.id)}"><span class="todo-id">#${escapeHtml(displayId(item.id))}</span>${escapeHtml(displayTitle(item))}</button>${badges}${note ? `<span class="note">${note}</span>` : ''}</li>`;
}

function renderRelations({ blocked, dependencies, dependents }, terminal, profileOpen) {
  // A finished todo no longer blocks anything, so only its own blockers are worth showing.
  const shownDependents = terminal ? [] : dependents;
  if (dependencies.length === 0 && shownDependents.length === 0) return '';

  const open = dependencies.filter(d => !d.satisfied).length;
  const waiting = shownDependents.filter(d => d.active).length;
  const needsAttention = !terminal && (blocked || waiting > 0);

  const depItems = dependencies.map(d => {
    if (d.missing) return `<li class="unresolved"><span class="todo-id">#${escapeHtml(displayId(d.id))}</span>${sourceBadge(d.id)}Not found<span class="note">unresolved dependency</span></li>`;
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
  const chips = multiple ? `<ul class="recent" aria-label="Recent todos">${nav.recent.filter(r => !r.current).slice(0, VISIBLE_CHIPS).map(r => `<li><button type="button" class="chip status-border-${escapeHtml(r.status)}" data-open="${escapeHtml(r.id)}" title="${todoSource(r.id).label}: ${escapeHtml(displayTitle(r))} (${escapeHtml(r.status)})">${sourceBadge(r.id)} #${escapeHtml(displayId(r.id))}</button></li>`).join('')}</ul>` : '';
  const current = nav.recent.find(r => r.current);
  const select = multiple ? `<label class="recent-select"><span class="visually-hidden">Jump to a recent todo</span><select data-open-select class="status-border-${escapeHtml(current?.status ?? 'missing')}">${nav.recent.map(r => `<option class="status-border-${escapeHtml(r.status)}" value="${escapeHtml(r.id)}"${r.current ? ' selected' : ''}>${todoSource(r.id).label} · ${escapeHtml(displayId(r.id))} ${escapeHtml(displayTitle(r))} (${escapeHtml(r.status)})</option>`).join('')}</select></label>` : '';
  return `<nav class="history" aria-label="Todo history">
        <button type="button" data-nav="back" aria-label="Back"${nav.canBack ? '' : ' disabled'}>&larr;</button>
        <button type="button" data-nav="forward" aria-label="Forward"${nav.canForward ? '' : ' disabled'}>&rarr;</button>
        ${select}
        ${chips}
      </nav>`;
}
