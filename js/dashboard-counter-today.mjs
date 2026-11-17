const endpoint = "https://script.google.com/macros/s/AKfycbznfyDGFQtyfP1KTvmNp9KP3hVKt355ka83FoHBojH4CwagrDmKaQawZym8n2aaaVdKwQ/exec";

const panel = document.querySelector('#counterToday');
const status = panel.querySelector('[role="status"]');
const refresh = panel.querySelector('button');
const table = panel.querySelector('table');
const rows = table.querySelector('tbody');
const categories = {
  ride: 'E-hailing / Teksi', delivery: 'Penghantaran', resident: 'Penghuni',
  office: 'Pejabat / Rasmi', visitor: 'Pelawat', service: 'Utiliti', sales: 'Jualan', other: 'Lain-lain',
};
const time = new Intl.DateTimeFormat('ms-MY', {
  timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', hour12: false,
});

function requestCounterRows(idToken) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const frame = document.createElement('iframe');
    frame.name = 'counter-today-' + requestId;
    frame.hidden = true;
    const form = document.createElement('form');
    form.hidden = true;
    form.method = 'POST';
    form.action = endpoint;
    form.target = frame.name;
    const payload = document.createElement('input');
    payload.type = 'hidden';
    payload.name = 'payload';
    payload.value = JSON.stringify({ action: 'counter-list', requestId, idToken });
    form.append(payload);

    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      frame.remove();
      form.remove();
    }
    function receive(event) {
      if (!/^https:\/\/(?:[a-z0-9-]+\.)?googleusercontent\.com$/.test(event.origin)) return;
      const reply = event.data;
      if (reply?.type !== 'counter-list' || reply.requestId !== requestId) return;
      cleanup();
      if (reply.ok && Array.isArray(reply.rows)) resolve(reply.rows);
      else reject(new Error('Counter access or read failed'));
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Counter response timed out'));
    }, 25000);
    window.addEventListener('message', receive);
    document.body.append(frame, form);
    form.submit();
    form.remove();
  });
}

async function showCounterToday({ silent = false } = {}) {
  if (document.body.dataset.dashboardPage !== 'checkedin' || !panel.open || refresh.disabled) return;
  if (!silent) {
    rows.replaceChildren();
    table.hidden = true;
  }
  if (new URLSearchParams(location.search).get('preview') === '1') {
    const examples = [
      ['10:25', 'Rizal', 'Utiliti', 'B1-2-3, B1-2-5', 'VAB 2187'],
      ['10:12', '—', 'Penghantaran', 'Kawasan PG', 'BQN 9072'],
      ['09:48', 'Aina', 'E-hailing / Teksi', 'Lobi Blok A', 'WXY 5521'],
    ];
    for (const values of examples) {
      const row = rows.insertRow();
      for (const value of values) row.insertCell().textContent = value;
    }
    table.hidden = false;
    status.textContent = 'Pratonton · 3 rekod contoh';
    return;
  }
  const auth = window.__AUTH;
  const user = auth?.currentUser;
  if (!user || location.origin !== 'https://jmbbc.github.io' ||
      new URLSearchParams(location.search).get('preview') === '1') {
    status.textContent = 'Paparan rekod kaunter tersedia kepada staf yang log masuk di dashboard rasmi.';
    return;
  }

  refresh.disabled = true;
  if (!silent) status.textContent = 'Memuatkan rekod kaunter…';
  try {
    const records = await requestCounterRows(await user.getIdToken());
    if (auth.currentUser !== user || !panel.open) return;
    rows.replaceChildren();
    for (const record of records) {
      const row = rows.insertRow();
      const values = [
        time.format(new Date(record.enteredAt)), categories[record.category] || 'Lain-lain',
      ];
      for (const value of [values[0], record.name, values[1], record.destination, record.vehicle]) {
        row.insertCell().textContent = value || '—';
      }
    }
    table.hidden = records.length === 0;
    status.textContent = records.length ? records.length + ' rekod hari ini.' : 'Tiada rekod kaunter hari ini.';
  } catch {
    if (auth.currentUser === user) status.textContent = 'Rekod kaunter gagal dimuatkan. Semak akses staf atau cuba lagi.';
  } finally {
    refresh.disabled = false;
  }
}

const isPreview = new URLSearchParams(location.search).get('preview') === '1';
if (!isPreview) {
  const refreshIntervalMs = 60 * 60 * 1000;
  setInterval(() => {
    if (!document.hidden && window.__AUTH?.currentUser) showCounterToday({ silent: true });
  }, refreshIntervalMs);
}

panel.addEventListener('toggle', showCounterToday);
new MutationObserver(showCounterToday).observe(document.body, {
  attributes: true, attributeFilter: ['data-dashboard-page'],
});
refresh.addEventListener('click', showCounterToday);
if (new URLSearchParams(location.search).get('preview') !== '1') window.__AUTH?.onAuthStateChanged(() => {
  rows.replaceChildren();
  table.hidden = true;
  status.textContent = '';
  if (window.__AUTH.currentUser) showCounterToday();
});
