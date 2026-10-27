(() => {
  const message = document.getElementById('status-message');
  const post = (path, payload) => fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Agendo-Canvas': '1' },
    body: JSON.stringify(payload)
  });

  const perform = async (element, payload) => {
    if (element.dataset.saving === 'true') return;
    element.dataset.saving = 'true';
    const controls = element.matches('form') ? [...element.querySelectorAll('input, button')] : [element];
    controls.forEach(control => { control.disabled = true; });
    message.textContent = 'Saving…';
    try {
      const res = await post('/settings/action', payload);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.reload !== false) location.reload();
      else message.textContent = 'Saved.';
    } catch (err) {
      message.textContent = 'Could not save setting: ' + err.message;
    } finally {
      delete element.dataset.saving;
      controls.forEach(control => { control.disabled = false; });
    }
  };

  document.querySelectorAll('select[data-setting], input[type="checkbox"][data-setting]').forEach(control => {
    control.addEventListener('change', () => perform(control, {
      action: control.dataset.setting,
      value: control.type === 'checkbox' ? control.checked : control.value,
      scope: control.dataset.scope,
      status: control.dataset.status,
    }));
  });

  document.querySelectorAll('form[data-setting]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      perform(form, { action: form.dataset.setting, value: form.elements.value.value });
    });
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
