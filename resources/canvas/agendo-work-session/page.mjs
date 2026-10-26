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
  completed: { order: ['description', 'scanner', 'work-log', 'criteria', 'triage', 'deps', 'resume'], open: ['description', 'work-log'] },
  cancelled: { order: ['description', 'scanner', 'work-log', 'deps', 'criteria', 'triage', 'resume'], open: ['description', 'work-log'] }
};
export const STATUS_OPTIONS = ['pending', 'in-progress', 'ready', 'backlogged', 'completed', 'cancelled'];

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

function scanTooltip(todo) {
  const scan = todo.scan;
  const parts = [];
  if (scan?.scope) parts.push(`scope: ${scan.scope}`);
  if (scan?.target) parts.push(`target: ${scan.target}`);
  if (scan?.refreshedAt) parts.push(`refreshed: ${scan.refreshedAt}`);
  if (scan?.reviewRequired) parts.push('review required');
  return parts.length ? parts.join(' · ') : 'Scanner import';
}

const LIFECYCLE_HELP = {
  pending: { meaning: 'Not started', next: 'Review the scope and evidence; move to in-progress when beginning investigation or implementation.' },
  'in-progress': { meaning: 'Investigation or implementation is underway', next: 'Work through findings and additional criteria; record relevant decisions and verification needs.' },
  ready: { meaning: 'Implementation is believed finished and needs verification', next: 'Check criteria, tests, and a fresh analysis where applicable; complete only when verified.' },
  completed: { meaning: 'Work is recorded as finished and verified', next: 'Review its evidence; explicitly reopen if further work is needed.' },
  backlogged: { meaning: 'Work is deferred', next: 'Revisit priority and scope before returning it to active work.' },
  cancelled: { meaning: 'Work is no longer being pursued', next: 'Review the reason and effects on related work before explicitly reopening.' }
};

function statusHelp(status) {
  const help = LIFECYCLE_HELP[status];
  if (!help) return '';
  return `<details class="status-help" id="status-help"><summary aria-label="Lifecycle help for ${escapeHtml(status)}" tabindex="0">?</summary><div class="box"><p><strong>${escapeHtml(status)}:</strong> ${escapeHtml(help.meaning)}</p><p>${escapeHtml(help.next)}</p></div></details>`;
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

function renderAgentControls() {
  return `<section class="agent-controls" aria-label="Ask agent">
    <label>Ask agent <select data-agent-intent aria-label="Request intent">
      <option value="explain">Explain Finding</option><option value="investigate">Investigate Selection</option>
      <option value="suggest-fix">Suggest Fix Plan</option><option value="verify">Help Verify</option>
    </select></label>
    <button type="button" data-agent-preview>Preview Request</button>
    <span class="agent-activity" data-agent-activity aria-live="polite"><span class="agent-activity-dot" data-agent-dot></span><span data-agent-status-text>Session status unknown</span></span>
    <span class="hint">Read-only help. Nothing is sent until you confirm.</span>
    <dialog class="agent-dialog" data-agent-dialog aria-labelledby="agent-preview-title">
      <h2 id="agent-preview-title">Review Agent Request</h2>
      <p>Review for sensitive information before sending or copying. This request does not authorize implementation or bypass approvals.</p>
      <textarea data-agent-prompt readonly aria-label="Exact agent request" rows="14"></textarea>
      <p data-agent-session role="status" aria-live="polite"></p>
      <p data-agent-message role="status" aria-live="polite"></p>
      <div class="agent-buttons"><button type="button" data-agent-send disabled>Send to Owning Copilot Session</button>
      <button type="button" data-agent-copy>Copy Request</button><button type="button" data-agent-close>Close</button></div>
    </dialog>
  </section>`;
}

function renderReportControls(todoStatus) {
  const isComplete = todoStatus === 'completed';
  return `<section class="report-controls" aria-label="Generate report">
    <button type="button" data-report-preview${isComplete ? '' : ' disabled'} title="${isComplete ? '' : 'Only completed todos generate reports'}">Generate Accomplishments Report</button>
    <span class="hint">Synthesizes completed work into a readable report. Nothing changes without your confirmation.</span>
    <dialog class="agent-dialog" data-report-dialog aria-labelledby="report-preview-title">
      <h2 id="report-preview-title">Preview Report Request</h2>
      <p>Review the selection and coverage before generating. The report links back to source todos and does not change todo state.</p>
      <div data-report-summary role="status"></div>
      <textarea data-report-prompt readonly aria-label="Exact report request" rows="14"></textarea>
      <p data-report-message role="status" aria-live="polite"></p>
      <div class="agent-buttons"><button type="button" data-report-generate disabled>Generate Report</button>
      <button type="button" data-report-copy>Copy Request</button><button type="button" data-report-close>Close</button></div>
    </dialog>
  </section>`;
}

export function renderProposalPanel(proposals = [], canApply = false, policy = {}) {
  const choice = policy.mode === 'auto' ? `auto-${policy.scope}` : 'manual';
  const effectiveAuto = policy.effectiveMode === 'auto';
  const scope = policy.scope === 'workspace' ? policy.workspaceRoot : policy.todoId;
  const cards = proposals.map(proposal => {
    const pending = proposal.changes.some(change => change.state === 'pending');
    return `<article class="proposal-card" data-proposal-id="${escapeHtml(proposal.id)}">
      <h3>${escapeHtml(proposal.title)} <span class="badge">${escapeHtml(proposal.state)}</span></h3>
      ${proposal.approval ? `<p class="approval-result"><strong>${proposal.approval.mode === 'auto' ? 'Auto-approval' : 'Manual review'}: ${escapeHtml(proposal.approval.outcome)}</strong> ${escapeHtml(proposal.approval.message)}${proposal.approval.manualAction ? `<br>Later manual decision: ${escapeHtml(proposal.approval.manualAction)}` : ''}</p>` : ''}
      <p class="hint">Target: ${escapeHtml(proposal.todoId)} | Workspace: ${escapeHtml(proposal.workspaceRoot)}<br>File: ${escapeHtml(proposal.revision.path)}<br>Revision: <code>${escapeHtml(proposal.revision.content)}</code></p>
      <ul class="proposal-changes">${proposal.changes.map(change => `<li>
        <label><input type="checkbox" data-proposal-change="${escapeHtml(change.id)}"${change.state !== 'pending' ? ' disabled' : ''}>
        <span>Criterion ${change.criterionIndex + 1}: ${escapeHtml(change.text)}</span></label>
        <p><strong>${change.before ? 'Met' : 'Not met'} -&gt; ${change.after ? 'Met' : 'Not met'}</strong> <span class="badge">${escapeHtml(change.state)}</span></p>
        <p><strong>Rationale:</strong> ${escapeHtml(change.rationale)}</p>
        <details><summary>Supporting Evidence</summary><pre>${escapeHtml(change.evidence)}</pre></details>
      </li>`).join('')}</ul>
      ${pending ? `<label class="proposal-confirm"><input type="checkbox" data-proposal-confirm> I reviewed the selected changes and authorize only those checkbox updates.</label>` : ''}
      <div class="proposal-buttons">
        <button type="button" data-proposal-apply disabled${!canApply ? ' title="Application requires a host with a native permission guard"' : ''}>Apply Selected Changes</button>
        <button type="button" data-proposal-reject${pending ? '' : ' disabled'}>Reject Selected Changes</button>
        <button type="button" data-proposal-copy>Copy Proposal</button>
      </div>
      <p data-proposal-message role="status" aria-live="polite"></p>
    </article>`;
  }).join('');
  return `<section class="proposal-panel" data-proposals data-can-apply="${canApply}" aria-labelledby="proposals-heading">
    <h2 id="proposals-heading" class="sr-only">Proposed Criteria Changes</h2>
    <div class="approval-policy" data-approval-policy>
      <p role="status"><strong>Effective mode here: ${effectiveAuto ? 'Auto-approve new criteria proposals' : 'Manual review'}</strong></p>
      <p class="hint">${policy.mode === 'auto' ? `Authorized scope: ${escapeHtml(scope)} (${escapeHtml(policy.scope)}).` : 'No automatic changes are authorized.'} Authorization lasts only for this canvas session and is cleared when it closes. It grants no shell, generic patch, or lifecycle permissions.</p>
      <label>Approval mode <select data-approval-choice aria-label="Approval mode">
        <option value="manual"${choice === 'manual' ? ' selected' : ''}>Manual review</option>
        <option value="auto-todo"${choice === 'auto-todo' ? ' selected' : ''}${!canApply ? ' disabled' : ''}>Auto-approve this todo</option>
        <option value="auto-workspace"${choice === 'auto-workspace' ? ' selected' : ''}${!canApply ? ' disabled' : ''}>Auto-approve workspace (this session)</option>
      </select></label>
      <div class="proposal-buttons"><button type="button" data-approval-set>Use Approval Mode</button>
      <button type="button" data-approval-pause${policy.mode === 'auto' ? '' : ' disabled'}>Pause Auto-Approval</button></div>
      <p class="hint">Mode changes affect only new submissions. Existing pending or rejected suggestions are never automatically applied. Switch to manual review for focused work.</p>
    </div>
    <p>Proposals are not applied work until their result says applied. In manual mode, select only the changes you accept. Local checkbox completion does not verify scanner clearance or change todo status.</p>
    <p class="hint">Proposals and review decisions are temporary in this canvas session. Only explicitly applied checkbox updates are saved to the todo file.</p>
    ${!canApply ? '<p class="hint">This host cannot apply proposals through a native permission guard. Inspect or copy a proposal, then make reviewed changes manually in your normal editor.</p>' : ''}
    ${cards || '<p class="hint">No proposals for this todo. An agent can propose criteria changes, or you can import a proposal below.</p>'}
    <details class="proposal-import"><summary>Import Agent Proposal</summary>
      <p>Paste a JSON object with a <code>changes</code> array. Each change requires <code>criterionIndex</code> (zero-based), <code>met</code>, <code>rationale</code>, and <code>evidence</code>. Only this todo is targeted. ${effectiveAuto ? 'New submissions will be automatically applied through the active guarded policy.' : 'Importing creates a read-only preview, not a file change.'}</p>
      <textarea data-proposal-input rows="6" aria-label="Proposal changes (JSON)" placeholder='{"changes":[{"criterionIndex":0,"met":true,"rationale":"Reason for this change","evidence":"Verification evidence"}]}'></textarea>
      <button type="button" data-proposal-import>${effectiveAuto ? 'Submit Using Auto-Approval' : 'Preview Imported Changes'}</button>
    </details>
  </section>`;
}

export function renderCanvas(todo, relations, nav, actions = {}, groups = [], proposals = [], policy = {}) {
  if (!todo) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Agendo Work Session</title>
    <link rel="stylesheet" href="/page.css"></head>
    <body><main class="empty">${renderNavigation(nav)}<h1>Agendo Work Session</h1><p>No todo selected. Choose a todo from the board or history.</p><p class="error" id="status-message" role="status" aria-live="polite"></p></main><script src="/page.js"></script></body></html>`;
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

  const terminal = todo.status === 'completed' || todo.status === 'cancelled';
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

  const byId = { criteria: criteriaHtml, description: descriptionHtml, scanner: scannerHtml, triage: triageHtml, deps: depsHtml, resume: resumeHtml, 'work-log': workLogHtml };
  const sections = profile.order.map(id => byId[id]).join('');

  const statusPill = `<label class="badge-select"><span class="visually-hidden">Change status</span><select data-status-select class="badge status-${escapeHtml(todo.status)}" aria-label="Change status">${STATUS_OPTIONS.map(s => `<option value="${s}"${s === todo.status ? ' selected' : ''}>${s}</option>`).join('')}</select></label>`;

  const priorityPill = `<label class="badge-select"><span class="visually-hidden">Change priority</span><select data-priority-select class="badge badge-priority" aria-label="Change priority">${['p1', 'p2', 'p3'].map(p => `<option value="${p}"${p === todo.priority ? ' selected' : ''}>${p}</option>`).join('')}</select></label>`;

  const groupPill = `<label class="badge-select"><span class="visually-hidden">Change group</span><select data-group-select class="badge badge-group" aria-label="Change group"><option value=""${!todo.group ? ' selected' : ''}>no group</option>${groups.map(g => `<option value="${escapeHtml(g)}"${todo.group === g ? ' selected' : ''}>${escapeHtml(g)}</option>`).join('')}</select></label>`;
  const editButton = actions.edit ? '<button type="button" class="edit-button" data-edit title="Edit todo file" aria-label="Edit todo file"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m16 3 5 5-12 12H4v-5Z"/><path d="m13 6 5 5"/></svg><span>Edit</span></button>' : '';
  const copyContextButton = '<button type="button" class="edit-button" data-copy-context title="Copy context to clipboard" aria-label="Copy context to clipboard"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy Context</span></button>';
  const settingsButton = '<button type="button" class="edit-button" data-settings title="Settings and About" aria-label="Settings and About"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.68 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg><span>Settings</span></button>';
  const navigation = renderNavigation(nav, todo);

  const importGrouping = { file: 'File import', rule: 'Rule import', finding: 'Issue import' }[todo.scan?.grouping];
  const importPill = importGrouping
    ? `<span class="badge badge-import" title="${escapeHtml(scanTooltip(todo))}" aria-label="${escapeHtml(importGrouping)}">${escapeHtml(importGrouping)}</span>`
    : '';

  const validationBanner = todo.validation && todo.validation.length > 0
    ? `<div class="validation-warning" role="alert"><strong>⚠ File structure issues:</strong><ul>${todo.validation.map(msg => `<li>${escapeHtml(msg)}</li>`).join('')}</ul></div>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(displayTitle(todo))}</title>
  <link rel="stylesheet" href="/page.css"></head>
  <body data-todo-id="${escapeHtml(todo.id)}" data-status="${escapeHtml(todo.status)}" data-percent="${percent}">
    <main>
      ${navigation || editButton || settingsButton || copyContextButton ? `<div class="canvas-toolbar">${navigation}${editButton}${copyContextButton}${settingsButton}</div>` : ''}
      ${validationBanner}
      <h1><span class="todo-id">#${escapeHtml(displayId(todo.id))}</span>${escapeHtml(displayTitle(todo))}</h1>
      <div class="meta">
        ${sourceBadge(todo.id)}
        ${statusPill}
        ${statusHelp(todo.status)}
        ${priorityPill}
        ${groupPill}
        ${todo.group ? `<button type="button" data-open-group="${escapeHtml(todo.group)}" title="Open group overview">Group overview</button>` : ''}
        ${importPill}
      </div>
      ${renderAgentControls()}
      ${proposals.length > 0 ? `<details class="proposal-details"><summary>Proposed Criteria Changes (${proposals.length})</summary>${renderProposalPanel(proposals, typeof actions.assertWritable === 'function', policy)}</details>` : ''}
      ${sections}
      <p class="error" id="status-message" role="status" aria-live="polite"></p>
    </main>
    <script src="/page.js"></script>
  </body></html>`;
}

export function renderGroupCanvas(groupName, members, nav, actions = {}, filters = {}) {
  const navigation = renderNavigation(nav, { id: `group:${groupName}`, title: `Group: ${groupName}`, status: 'pending', group: groupName });
  const settingsButton = '<button type="button" class="edit-button" data-settings title="Settings and About" aria-label="Settings and About"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.68 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg><span>Settings</span></button>';

  const filterBadges = [];
  if (filters?.status) filterBadges.push(`status: ${filters.status}`);
  if (filters?.priority) filterBadges.push(`priority: ${filters.priority}`);
  const filterBanner = filterBadges.length > 0
    ? `<div class="filter-banner" role="status">Filters active: ${filterBadges.join(' · ')}</div>`
    : '';

  // Count by status
  const statusCounts = {};
  const activeMembers = [];
  const terminalMembers = [];
  for (const todo of members) {
    statusCounts[todo.status] = (statusCounts[todo.status] ?? 0) + 1;
    if (todo.status === 'completed' || todo.status === 'cancelled' || todo.status === 'backlogged') {
      terminalMembers.push(todo);
    } else {
      activeMembers.push(todo);
    }
  }

  const summaryParts = [];
  if (statusCounts['in-progress']) summaryParts.push(`${statusCounts['in-progress']} in-progress`);
  if (statusCounts['pending']) summaryParts.push(`${statusCounts['pending']} pending`);
  if (statusCounts['ready']) summaryParts.push(`${statusCounts['ready']} ready`);
  if (statusCounts['completed']) summaryParts.push(`${statusCounts['completed']} completed`);
  if (statusCounts['cancelled']) summaryParts.push(`${statusCounts['cancelled']} cancelled`);
  if (statusCounts['backlogged']) summaryParts.push(`${statusCounts['backlogged']} backlogged`);
  const summary = summaryParts.join(' · ') || 'empty';

  const renderTodoRow = (todo) => {
    const done = todo.criteria.filter(c => c.met).length;
    const total = todo.criteria.length;
    const progress = total > 0 ? `${done}/${total}` : '';
    const blockedBy = (todo.dependencies && todo.dependencies.length > 0) ? `blocked by ${todo.dependencies.join(', ')}` : '';
    return `<li class="group-member">
      <button type="button" class="todo-link" data-open="${escapeHtml(todo.id)}"><span class="todo-id">#${escapeHtml(displayId(todo.id))}</span>${escapeHtml(displayTitle(todo))}</button>
      ${sourceBadge(todo.id)}
      <span class="badge status-${escapeHtml(todo.status)}">${escapeHtml(todo.status)}</span>
      <span class="badge badge-priority">${escapeHtml(todo.priority)}</span>
      ${progress ? `<span class="badge badge-progress">${escapeHtml(progress)}</span>` : ''}
      ${blockedBy ? `<span class="note">${escapeHtml(blockedBy)}</span>` : ''}
    </li>`;
  };

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Group: ${escapeHtml(groupName)}</title>
  <link rel="stylesheet" href="/page.css"></head>
  <body data-group="${escapeHtml(groupName)}">
    <main>
      ${navigation || settingsButton ? `<div class="canvas-toolbar">${navigation}${settingsButton}</div>` : ''}
      ${filterBanner}
      <h1><span class="group-id">Group:</span> ${escapeHtml(groupName)}</h1>
      <div class="meta">
        <span class="badge badge-group">Group: ${escapeHtml(groupName)}</span>
        <span class="badge">${members.length} todos</span>
      </div>
      <p class="group-summary">${escapeHtml(summary)}</p>
      ${renderAgentControls()}
      ${activeMembers.length > 0 ? `
        <h2>Active</h2>
        <ul class="group-members">${activeMembers.map(renderTodoRow).join('')}</ul>` : ''}
      ${terminalMembers.length > 0 ? `
        <h2>Terminal</h2>
        <ul class="group-members">${terminalMembers.map(renderTodoRow).join('')}</ul>` : ''}
      ${members.length === 0 ? '<p class="empty">No todos in this group.</p>' : ''}
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

export function renderNavigation(nav, currentTodo) {
  if (!nav) return '';
  const multiple = nav.recent.length > 1;
  const current = nav.recent.find(r => r.current);
  const currentTitle = currentTodo ? `#${displayId(currentTodo.id)} ${displayTitle(currentTodo)}` : (current?.kind === 'board' ? (current.scope === 'code-scanning' ? 'Code Scanning Board' : 'Todos Board') : current?.kind === 'group' ? `Group: ${current.groupName}` : 'No todo');
  
  const dropdownItems = nav.recent.map(r => r.kind === 'board'
    ? `<button type="button" class="recent-item${r.current ? ' recent-current' : ''}" data-open-board="${escapeHtml(r.scope)}">${r.current ? '— ' : ''}${r.scope === 'code-scanning' ? 'Code Scanning Board' : 'Todos Board'}${r.current ? ' —' : ''}</button>`
    : r.kind === 'group' ? `<button type="button" class="recent-item${r.current ? ' recent-current' : ''}" data-open-group="${escapeHtml(r.groupName)}">${r.current ? '— ' : ''}Group: ${escapeHtml(r.groupName)}${r.current ? ' —' : ''}</button>`
    : `<button type="button" class="recent-item status-border-${escapeHtml(r.status)}${r.current ? ' recent-current' : ''}" data-open="${escapeHtml(r.id)}">${r.current ? '— ' : ''}${todoSource(r.id).label} · #${escapeHtml(displayId(r.id))} ${escapeHtml(displayTitle(r))} (${escapeHtml(r.status)})${r.current ? ' —' : ''}</button>`).join('');
  
  const chips = multiple ? `<ul class="recent" aria-label="Recent views">${nav.recent.filter(r => !r.current).slice(0, VISIBLE_CHIPS).map(r => r.kind === 'board'
    ? `<li><button type="button" class="chip" data-open-board="${escapeHtml(r.scope)}">${r.scope === 'code-scanning' ? 'Code Scanning Board' : 'Todos Board'}</button></li>`
    : r.kind === 'group' ? `<li><button type="button" class="chip" data-open-group="${escapeHtml(r.groupName)}">Group: ${escapeHtml(r.groupName)}</button></li>`
    : `<li><button type="button" class="chip source-${todoSource(r.id).key} ${escapeHtml(r.priority)} status-border-${escapeHtml(r.status)}" data-open="${escapeHtml(r.id)}" title="${todoSource(r.id).label}: ${escapeHtml(displayTitle(r))} (${escapeHtml(r.status)})">${sourceBadge(r.id)} #${escapeHtml(displayId(r.id))}</button></li>`).join('')}</ul>` : '';
  
  const titleButton = `<button type="button" class="current-todo-title status-border-${escapeHtml(current?.status ?? 'missing')}" data-toggle-recent aria-expanded="false" title="Click to see recent views">${escapeHtml(currentTitle)}</button>`;
  const recentDropdown = multiple ? `<div class="recent-dropdown" data-recent-dropdown hidden>${dropdownItems}</div>` : '';
  
  return `<nav class="history" aria-label="Workspace history">
        ${nav.returnTo ? `<button type="button" data-return-board>Return to ${nav.returnTo.scope === 'code-scanning' ? 'Code Scanning Board' : 'Todos Board'}</button>` : ''}
        <button type="button" data-nav="back" aria-label="Back"${nav.canBack ? '' : ' disabled'}>&larr;</button>
        <button type="button" data-nav="forward" aria-label="Forward"${nav.canForward ? '' : ' disabled'}>&rarr;</button>
        <div class="todo-title-area">${titleButton}${chips}${recentDropdown}</div>
      </nav>`;
}
