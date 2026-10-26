(() => {
  const message = document.getElementById('status-message');
  const post = (path, payload) => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
    body: JSON.stringify(payload)
  });

  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[target="_blank"]') : null;
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (url.protocol !== 'https:') return;
    event.preventDefault();
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'agendo:openExternal', url: url.href }, '*');
    } else {
      window.open(url.href, '_blank', 'noopener,noreferrer');
    }
  });

  for (const box of document.querySelectorAll('input[data-index]')) {
    box.addEventListener('change', async () => {
      box.disabled = true;
      try {
        const res = await post('/toggle', { index: Number(box.dataset.index), met: box.checked });
        if (!res.ok) throw new Error(await res.text());
        location.reload();
      } catch (err) {
        box.checked = !box.checked;
        box.disabled = false;
        message.textContent = 'Could not update: ' + err.message;
      }
    });
  }

  for (const link of document.querySelectorAll('[data-open]')) {
    link.addEventListener('click', async () => {
      try {
        const res = await post('/open', { todoId: link.dataset.open });
        if (!res.ok) throw new Error(await res.text());
        location.reload();
      } catch (err) {
        message.textContent = 'Could not open todo: ' + err.message;
      }
    });
  }

  document.querySelector('[data-open-select]')?.addEventListener('change', async e => {
    try {
      const groupName = e.target.selectedOptions[0]?.dataset.groupName;
      const scope = e.target.selectedOptions[0]?.dataset.boardScope;
      const res = await post('/open', scope ? { view: { kind: 'board', scope } } : groupName !== undefined ? { view: { kind: 'group', groupName } } : { todoId: e.target.value });
      if (!res.ok) throw new Error(await res.text());
      location.reload();
    } catch (err) {
      message.textContent = 'Could not open todo: ' + err.message;
    }
  });

  for (const button of document.querySelectorAll('[data-open-group]')) {
    button.addEventListener('click', async () => {
      try {
        const res = await post('/open', { view: { kind: 'group', groupName: button.dataset.openGroup } });
        if (!res.ok) throw new Error(await res.text());
        location.reload();
      } catch (err) {
        message.textContent = 'Could not open group: ' + err.message;
      }
    });
  }

  for (const button of document.querySelectorAll('[data-open-board]')) {
    button.addEventListener('click', async () => {
      try {
        const res = await post('/open', { view: { kind: 'board', scope: button.dataset.openBoard } });
        if (!res.ok) throw new Error(await res.text());
        location.reload();
      } catch (err) {
        message.textContent = 'Could not open board: ' + err.message;
      }
    });
  }

  document.querySelector('[data-return-board]')?.addEventListener('click', async e => {
    const button = e.currentTarget;
    button.disabled = true;
    try {
      const res = await post('/return-board', {});
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      if (result.view?.kind === 'board') location.reload();
    } catch (err) {
      message.textContent = 'Could not return to board: ' + err.message;
    } finally {
      button.disabled = false;
    }
  });

  for (const btn of document.querySelectorAll('[data-nav]')) {
    btn.addEventListener('click', async () => {
      try {
        const res = await post('/nav', { direction: btn.dataset.nav });
        if (!res.ok) throw new Error(await res.text());
        location.reload();
      } catch (err) {
        message.textContent = 'Could not navigate: ' + err.message;
      }
    });
  }

  document.querySelector('[data-status-select]')?.addEventListener('change', async e => {
    const select = e.target;
    select.disabled = true;
    try {
      const res = await post('/status', { status: select.value });
      if (!res.ok) throw new Error(await res.text());
      location.reload();
    } catch (err) {
      select.disabled = false;
      message.textContent = 'Could not change status: ' + err.message;
    }
  });

  document.querySelector('[data-priority-select]')?.addEventListener('change', async e => {
    const select = e.target;
    select.disabled = true;
    try {
      const res = await post('/priority', { priority: select.value });
      if (!res.ok) throw new Error(await res.text());
      location.reload();
    } catch (err) {
      select.disabled = false;
      message.textContent = 'Could not change priority: ' + err.message;
    }
  });

  document.querySelector('[data-group-select]')?.addEventListener('change', async e => {
    const select = e.target;
    select.disabled = true;
    try {
      const res = await post('/group', { group: select.value });
      if (!res.ok) throw new Error(await res.text());
      location.reload();
    } catch (err) {
      select.disabled = false;
      message.textContent = 'Could not change group: ' + err.message;
    }
  });

  document.querySelector('[data-edit]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    message.textContent = '';
    try {
      const res = await post('/edit', {});
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      message.textContent = 'Could not open editor: ' + err.message;
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector('[data-settings]')?.addEventListener('click', () => {
    location.href = '/settings';
  });

  let clipboardResolve = null;
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'clipboardResult') {
        clipboardResolve?.(event.data.success);
        clipboardResolve = null;
      }
    });
  }

  async function copyText(text) {
    // Try VS Code extension host clipboard first (reliable in webviews)
    if (typeof window !== 'undefined' && window.parent) {
      try {
        const success = await new Promise((resolve) => {
          clipboardResolve = resolve;
          window.parent.postMessage({ type: 'agendo:copyToClipboard', text }, '*');
          // Fallback timer: if no response in 500ms, assume unsupported
          setTimeout(() => { resolve(false); }, 500);
        });
        if (success) return true;
      } catch { /* fall through to browser APIs */ }
    }

    // Browser clipboard API
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Webviews can deny the async clipboard API; try the legacy path next.
    }

    // Legacy execCommand fallback
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }

  function showManualCopy(text) {
    message.textContent = 'Clipboard unavailable. Select the text below and copy it manually:';
    let area = document.querySelector('[data-manual-copy]');
    if (!area) {
      area = document.createElement('textarea');
      area.setAttribute('data-manual-copy', '');
      area.setAttribute('readonly', '');
      area.setAttribute('aria-label', 'Context to copy');
      area.rows = 12;
      area.style.width = '100%';
      message.after(area);
    }
    area.value = text;
    area.focus();
    area.select();
  }

  document.querySelector('[data-copy-context]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    message.textContent = '';
    try {
      const res = await post('/context', {});
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const text = [
        `# ${data.id}: ${data.title}`,
        `Status: ${data.status} | Priority: ${data.priority}${data.group ? ` | Group: ${data.group}` : ''}`,
        '',
        data.description ? `## Description\n${data.description}` : '',
        '',
        data.criteria?.length ? `## Acceptance Criteria (${data.criteria.filter(c => c.met).length}/${data.criteria.length} met)` : '',
        ...(data.criteria || []).map((c, i) => `- [${c.met ? 'x' : ' '}] ${c.text}`),
        '',
        data.dependencies?.length ? `## Dependencies\n${data.dependencies.map(d => `- ${d.id}: ${d.title} (${d.status})`).join('\n')}` : '',
        '',
        data.resumeContext ? `## Resume Context\n${data.resumeContext}` : '',
        '',
        data.scannerEvidence ? `## Scanner Evidence\n${data.scannerEvidence}` : ''
      ].filter(Boolean).join('\n');
      if (await copyText(text)) {
        message.textContent = 'Context copied to clipboard';
        setTimeout(() => { message.textContent = ''; }, 3000);
      } else {
        showManualCopy(text);
      }
    } catch (err) {
      message.textContent = 'Could not copy context: ' + err.message;
    } finally {
      button.disabled = false;
    }
  });

  const agentDialog = document.querySelector('[data-agent-dialog]');
  const agentMessage = document.querySelector('[data-agent-message]');
  const agentPrompt = document.querySelector('[data-agent-prompt]');
  const agentSend = document.querySelector('[data-agent-send]');
  const agentSession = document.querySelector('[data-agent-session]');
  let agentRequestId;
  let agentSubmitted = false;
  let agentSending = false;
  let agentStale = false;
  const requestJson = async (path, payload) => {
    const res = await post(path, payload);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };
  const showAgentState = state => {
    agentSend.disabled = agentStale || agentSubmitted || agentSending || !state.supported || ['busy', 'sending', 'queued', 'closed'].includes(state.status);
    agentSession.textContent = !state.supported
      ? 'Direct sending is unavailable in this host. Use Copy Request with your preferred agent.'
      : state.message || `Owning session: ${state.status}. Sending admits a request, not proof that work started or finished.`;
  };
  document.querySelector('[data-agent-preview]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const view = document.body.dataset.todoId
        ? { kind: 'todo', todoId: document.body.dataset.todoId }
        : { kind: 'group', groupName: document.body.dataset.group };
      const preview = await requestJson('/agent/preview', { view, intent: document.querySelector('[data-agent-intent]').value });
      agentRequestId = preview.requestId;
      agentSubmitted = false;
      agentStale = false;
      agentMessage.textContent = '';
      agentPrompt.value = preview.prompt;
      showAgentState(preview.state);
      agentDialog.showModal();
    } catch (err) {
      message.textContent = 'Could not preview request: ' + err.message;
    } finally {
      button.disabled = false;
    }
  });
  agentSend?.addEventListener('click', async () => {
    if (!agentRequestId || agentSending || agentSubmitted) return;
    agentSending = true;
    agentSend.disabled = true;
    agentMessage.textContent = 'Submitting request. Agent work has not been confirmed.';
    try {
      const result = await requestJson('/agent/send', { requestId: agentRequestId });
      agentSubmitted = result.success === true;
      agentMessage.textContent = result.message;
    } catch (err) {
      agentMessage.textContent = 'Could not submit request: ' + err.message + '. Preview again if the selection changed.';
    } finally {
      agentSending = false;
      agentSend.disabled = agentStale || agentSubmitted;
    }
  });
  document.querySelector('[data-agent-copy]')?.addEventListener('click', async () => {
    agentMessage.textContent = await copyText(agentPrompt.value)
      ? 'Request copied. Paste it into your chosen agent session.'
      : 'Clipboard unavailable. Select the request text above and copy it manually.';
    if (agentMessage.textContent.startsWith('Clipboard')) {
      agentPrompt.focus();
      agentPrompt.select();
    }
  });
  document.querySelector('[data-agent-close]')?.addEventListener('click', () => agentDialog.close());

  const reportDialog = document.querySelector('[data-report-dialog]');
  const reportPrompt = document.querySelector('[data-report-prompt]');
  const reportSummary = document.querySelector('[data-report-summary]');
  const reportMessage = document.querySelector('[data-report-message]');
  const reportGenerate = document.querySelector('[data-report-generate]');
  let reportPreviewData = null;
  let reportGenerating = false;

  document.querySelector('[data-report-preview]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const view = document.body.dataset.todoId
        ? { kind: 'todo', todoId: document.body.dataset.todoId }
        : { kind: 'group', groupName: document.body.dataset.group };
      const preview = await requestJson('/report/preview', { view });
      reportPreviewData = preview;
      reportSummary.textContent = `Matched: ${preview.matched} completed todo(s) | Included: ${preview.included} | Omitted: ${preview.omitted}`;
      reportPrompt.value = preview.prompt;
      reportMessage.textContent = '';
      reportGenerate.disabled = !preview.matched;
      reportDialog.showModal();
    } catch (err) {
      message.textContent = 'Could not preview report: ' + err.message;
    } finally {
      button.disabled = false;
    }
  });

  reportGenerate?.addEventListener('click', async () => {
    if (!reportPreviewData || reportGenerating) return;
    reportGenerating = true;
    reportGenerate.disabled = true;
    reportMessage.textContent = 'Generating report. The agent will respond in the owning session.';
    try {
      const result = await requestJson('/report/generate', { prompt: reportPreviewData.prompt });
      reportMessage.textContent = result.message;
    } catch (err) {
      reportMessage.textContent = 'Could not generate report: ' + err.message;
    } finally {
      reportGenerating = false;
      reportGenerate.disabled = true;
    }
  });

  document.querySelector('[data-report-copy]')?.addEventListener('click', async () => {
    if (!reportPreviewData) return;
    const ok = await copyText(reportPreviewData.prompt);
    reportMessage.textContent = ok
      ? 'Report request copied. Paste it into your chosen agent session.'
      : 'Clipboard unavailable. Select the request text above and copy it manually.';
    if (!ok) { reportPrompt.focus(); reportPrompt.select(); }
  });

  document.querySelector('[data-report-close]')?.addEventListener('click', () => reportDialog?.close());

  const proposalView = () => ({ kind: 'todo', todoId: document.body.dataset.todoId });
  const setApproval = async policy => {
    await requestJson('/proposals/policy', { view: proposalView(), policy });
    location.reload();
  };
  for (const button of document.querySelectorAll('[data-approval-set], [data-approval-pause]')) {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const choice = button.hasAttribute('data-approval-pause') ? 'manual' : document.querySelector('[data-approval-choice]').value;
        await setApproval(choice === 'manual' ? { mode: 'manual' } : { mode: 'auto', scope: choice === 'auto-todo' ? 'todo' : 'workspace' });
      } catch (err) {
        message.textContent = 'Could not change approval mode: ' + err.message;
      } finally {
        button.disabled = false;
      }
    });
  }
  let proposalSubmission;
  document.querySelector('[data-proposal-import]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const text = document.querySelector('[data-proposal-input]').value;
      const input = JSON.parse(text);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Expected an object containing changes');
      if (!proposalSubmission || proposalSubmission.text !== text) {
        proposalSubmission = { text, requestId: [...crypto.getRandomValues(new Uint8Array(16))].map(byte => byte.toString(16).padStart(2, '0')).join('') };
        try {
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
          const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
          const key = 'agendo-proposal-retry-' + document.body.dataset.todoId;
          const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
          if (cached?.fingerprint === fingerprint && /^[a-f0-9]{32}$/.test(cached.requestId)) proposalSubmission.requestId = cached.requestId;
          // Cache only a digest and replay ID, never proposal evidence or approval authority.
          sessionStorage.setItem(key, JSON.stringify({ fingerprint, requestId: proposalSubmission.requestId }));
          proposalSubmission.retryKey = key;
        } catch { /* In-memory retry protection still works when browser storage is unavailable. */ }
      }
      await requestJson('/proposals/create', { view: proposalView(), changes: input.changes, requestId: proposalSubmission.requestId });
      try { if (proposalSubmission.retryKey) sessionStorage.removeItem(proposalSubmission.retryKey); } catch { /* ignore unavailable storage */ }
      location.reload();
    } catch (err) {
      message.textContent = 'Could not submit proposal: ' + err.message + '. Check the change record before retrying.';
    } finally {
      button.disabled = false;
    }
  });
  for (const card of document.querySelectorAll('[data-proposal-id]')) {
    const panel = card.closest('[data-proposals]');
    const apply = card.querySelector('[data-proposal-apply]');
    const reject = card.querySelector('[data-proposal-reject]');
    const confirmation = card.querySelector('[data-proposal-confirm]');
    const status = card.querySelector('[data-proposal-message]');
    const selected = () => [...card.querySelectorAll('[data-proposal-change]:checked:not(:disabled)')].map(box => box.dataset.proposalChange);
    let pending = false;
    const updateButtons = () => {
      apply.disabled = pending || panel.dataset.canApply !== 'true' || !confirmation?.checked || !selected().length;
      reject.disabled = pending || !selected().length;
    };
    card.addEventListener('change', updateButtons);
    updateButtons();
    for (const [button, path] of [[apply, '/proposals/apply'], [reject, '/proposals/reject']]) {
      button.addEventListener('click', async () => {
        if (pending || button.disabled) return;
        const changeIds = selected();
        pending = true;
        updateButtons();
        status.textContent = path.endsWith('apply') ? 'Applying only the selected checkbox changes...' : 'Rejecting only the selected changes...';
        try {
          await requestJson(path, { view: proposalView(), proposalId: card.dataset.proposalId, changeIds });
          location.reload();
        } catch (err) {
          status.textContent = 'Could not process proposal: ' + err.message + '. Inspect the current todo before retrying.';
          if (confirmation) confirmation.checked = false;
        } finally {
          pending = false;
          updateButtons();
        }
      });
    }
    card.querySelector('[data-proposal-copy]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await requestJson('/proposals/list', { view: proposalView() });
        const proposal = result.proposals.find(item => item.id === card.dataset.proposalId);
        if (!proposal) throw new Error('Proposal is no longer available');
        const text = [
          `Proposal for ${proposal.todoId}: ${proposal.title} (${proposal.state})`,
          `Workspace: ${proposal.workspaceRoot}`, `File: ${proposal.revision.path}`, `Revision: ${proposal.revision.content}`,
          `Approval: ${proposal.approval?.mode ?? 'manual'} / ${proposal.approval?.outcome ?? proposal.state}`,
          proposal.approval?.message ?? '',
          proposal.approval?.manualAction ? `Later manual decision: ${proposal.approval.manualAction}` : '',
          'This record is not authorization to reapply changes. Applied entries are history. Local progress does not establish remote verification.',
          ...proposal.changes.map(change => `\nCriterion ${change.criterionIndex + 1}: ${change.text}\n${change.before ? 'Met' : 'Not met'} -> ${change.after ? 'Met' : 'Not met'} (${change.state})\nRationale: ${change.rationale}\nEvidence: ${change.evidence}`)
        ].join('\n');
        if (await copyText(text)) status.textContent = 'Change record copied. Applied entries should not be repeated.';
        else showManualCopy(text);
      } catch (err) {
        status.textContent = 'Could not copy proposal: ' + err.message;
      } finally {
        button.disabled = false;
      }
    });
  }

  // Recent views dropdown
  const titleButton = document.querySelector('[data-toggle-recent]');
  const recentDropdown = document.querySelector('[data-recent-dropdown]');
  if (titleButton && recentDropdown) {
    titleButton.addEventListener('click', () => {
      const expanded = titleButton.getAttribute('aria-expanded') === 'true';
      titleButton.setAttribute('aria-expanded', String(!expanded));
      recentDropdown.hidden = expanded;
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
      if (!titleButton.contains(event.target) && !recentDropdown.contains(event.target)) {
        titleButton.setAttribute('aria-expanded', 'false');
        recentDropdown.hidden = true;
      }
    });
    
    // Handle recent item clicks
    recentDropdown.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', async () => {
        recentDropdown.hidden = true;
        titleButton.setAttribute('aria-expanded', 'false');
        try {
          if (item.dataset.openBoard) {
            await post('/open', { view: { kind: 'board', scope: item.dataset.openBoard } });
          } else if (item.dataset.openGroup) {
            await post('/open', { view: { kind: 'group', groupName: item.dataset.openGroup } });
          } else if (item.dataset.open) {
            await post('/open', { todoId: item.dataset.open });
          }
          location.reload();
        } catch (err) {
          message.textContent = 'Could not open: ' + err.message;
        }
      });
    });
  }

  // Sections start open (dependencies open only when something needs attention); a manual
  // toggle is remembered per todo, so each todo keeps its own layout when you come back to it.
  const currentTodo = document.body.dataset.todoId;
  for (const section of document.querySelectorAll('details.collapsible')) {
    const key = 'agendo-section-' + currentTodo + '-' + document.body.dataset.status + '-' + section.dataset.section;
    const saved = sessionStorage.getItem(key);
    if (saved !== null) section.open = saved === '1';
    section.addEventListener('toggle', () => sessionStorage.setItem(key, section.open ? '1' : '0'));
  }

  for (const link of document.querySelectorAll('[data-section-link]')) {
    link.addEventListener('click', event => {
      const target = document.getElementById(link.dataset.sectionLink);
      if (!target) return;
      event.preventDefault();
      for (let section = target; section; section = section.parentElement?.closest('details')) {
        section.open = true;
      }
      target.querySelector('summary')?.focus();
      target.scrollIntoView({ block: 'start' });
    });
  }

  const logs = document.getElementById('work-log-entries');
  const toggle = document.getElementById('toggle-log');
  const logKey = 'agendo-log-expanded-' + currentTodo;
  const applyLog = expanded => {
    logs?.classList.toggle('show-all', expanded);
    if (toggle) {
      toggle.textContent = expanded ? 'Show fewer' : toggle.dataset.label;
      toggle.setAttribute('aria-expanded', String(expanded));
    }
  };
  applyLog(sessionStorage.getItem(logKey) === '1');
  toggle?.addEventListener('click', () => {
    const expanded = !logs.classList.contains('show-all');
    sessionStorage.setItem(logKey, expanded ? '1' : '0');
    applyLog(expanded);
  });

  // Status lifecycle help: click/tap/keyboard opens, Escape or outside click closes.
  const statusHelp = document.getElementById('status-help');
  statusHelp?.addEventListener('toggle', () => {
    if (!statusHelp.open) return;
    const close = event => {
      if (!statusHelp.contains(event.target)) {
        statusHelp.open = false;
        document.removeEventListener('click', close);
        document.removeEventListener('keydown', onKey);
      }
    };
    const onKey = event => {
      if (event.key === 'Escape') {
        statusHelp.open = false;
        document.removeEventListener('click', close);
        document.removeEventListener('keydown', onKey);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', close);
      document.addEventListener('keydown', onKey);
    }, 0);
  });

  function celebrate(text) {
    message.textContent = text;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'celebration';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const banner = document.createElement('div');
    banner.className = 'celebration-banner';
    banner.setAttribute('aria-hidden', 'true');
    banner.textContent = text;
    document.body.append(canvas, banner);
    const ctx = canvas.getContext('2d');
    const colors = ['#4caf50', '#ffbf7f', '#4da3ff', '#ff7fbf', '#ffff7f'];
    const pieces = Array.from({ length: 160 }, () => ({
      x: canvas.width / 2, y: canvas.height * 0.4,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4,
      size: 5 + Math.random() * 6, rot: Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    const start = performance.now();
    (function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.rot += 0.15;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (t > 3500) banner.style.opacity = '0';
      if (t < 4500) requestAnimationFrame(frame);
      else { canvas.remove(); banner.remove(); }
    })(start);
  }

  // Celebrate only on a transition, so reopening an already-finished todo stays quiet.
  const { todoId, status, percent } = document.body.dataset;
  const key = 'agendo-last-' + todoId;
  const last = JSON.parse(sessionStorage.getItem(key) || 'null');
  if (last) {
    if (status === 'completed' && last.status !== 'completed') {
      // Only celebrate completion if criteria haven't already hit 100 (which would
      // have fired its own celebration on the previous load).
      if (last.percent < 100) celebrate('Todo complete! 🎉');
    } else if (Number(percent) === 100 && last.percent < 100 && status !== 'completed') {
      celebrate('All criteria met! ✅');
    }
  }
  sessionStorage.setItem(key, JSON.stringify({ status, percent: Number(percent) }));

  const activityEl = document.querySelector('[data-agent-activity]');
  const activityDot = document.querySelector('[data-agent-dot]');
  const activityText = document.querySelector('[data-agent-status-text]');

  function updateActivityIndicator(state) {
    if (!activityEl || !activityDot || !activityText) return;
    const statusMap = {
      'unknown': { text: 'Session status unknown', class: '' },
      'queued': { text: 'Request admitted, awaiting agent', class: 'queued' },
      'busy': { text: 'Agent is working', class: 'busy' },
      'idle': { text: 'Agent is idle', class: 'idle' },
      'sending': { text: 'Sending request', class: 'sending' },
      'failed': { text: 'Session error occurred', class: 'failed' },
      'closed': { text: 'Session closed', class: 'closed' },
      'disconnected': { text: 'Disconnected from session', class: 'disconnected' },
      'no-response': { text: 'No response since request; check owning chat', class: 'no-response' }
    };
    const info = statusMap[state.status] ?? statusMap['unknown'];
    activityText.textContent = !state.supported ? 'Agent unavailable on this host' : info.text;
    activityDot.className = 'agent-activity-dot' + (info.class ? ' ' + info.class : '');
  }

  let version = null;
  setInterval(async () => {
    try {
      const next = await (await fetch('/version')).text();
      if (version !== null && next !== version) {
        // Keep the inspected packet visible; the server rejects stale submissions.
        if (agentDialog?.open) {
          agentStale = true;
          agentSend.disabled = true;
          agentMessage.textContent = 'The selection or workspace changed. Close and preview again before sending.';
          return;
        }
        location.reload();
      }
      version = next;
      const state = await requestJson('/agent/state', {});
      updateActivityIndicator(state);
      if (agentDialog?.open && !agentStale) showAgentState(state);
    } catch {
      // Server is gone; the host will reopen the canvas
    }
  }, 3000);
})();
