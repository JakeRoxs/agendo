(() => {
  const message = document.getElementById('status-message');
  const post = (path, payload) => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
    body: JSON.stringify(payload)
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
      const res = await post('/open', { todoId: e.target.value });
      if (!res.ok) throw new Error(await res.text());
      location.reload();
    } catch (err) {
      message.textContent = 'Could not open todo: ' + err.message;
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

  document.querySelector('[data-edit]')?.addEventListener('click', async () => {
    try {
      const res = await post('/edit', {});
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      message.textContent = 'Could not open editor: ' + err.message;
    }
  });

  // Sections start open (dependencies open only when something needs attention); a manual
  // toggle is remembered per todo, so each todo keeps its own layout when you come back to it.
  const currentTodo = document.body.dataset.todoId;
  for (const section of document.querySelectorAll('details.collapsible')) {
    const key = 'agendo-section-' + currentTodo + '-' + section.dataset.section;
    const saved = sessionStorage.getItem(key);
    if (saved !== null) section.open = saved === '1';
    section.addEventListener('toggle', () => sessionStorage.setItem(key, section.open ? '1' : '0'));
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
    if (status === 'complete' && last.status !== 'complete') celebrate('Todo complete! 🎉');
    else if (Number(percent) === 100 && last.percent < 100) celebrate('All criteria met! ✅');
  }
  sessionStorage.setItem(key, JSON.stringify({ status, percent: Number(percent) }));

  let version = null;
  setInterval(async () => {
    try {
      const next = await (await fetch('/version')).text();
      if (version !== null && next !== version) location.reload();
      version = next;
    } catch {
      // Server is gone; the host will reopen the canvas
    }
  }, 3000);
})();
