(() => {
  const message = document.getElementById('status-message');
  const post = (path, payload) => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
    body: JSON.stringify(payload)
  });

  document.querySelectorAll('[data-action]').forEach(link => {
    link.addEventListener('click', async e => {
      e.preventDefault();
      const action = link.dataset.action;
      const component = link.dataset.component;
      const scope = link.dataset.scope;
      try {
        const res = await post('/settings/action', { action, component, scope });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (data.reload !== false) location.reload();
      } catch (err) {
        message.textContent = 'Could not complete action: ' + err.message;
      }
    });
  });
})();
