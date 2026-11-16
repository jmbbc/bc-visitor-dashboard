import { collection, getDocs, limit, query, where } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const anchor = document.querySelector('#registrationTools');
const panel = document.createElement('details');
panel.className = 'card card-tight plate-search-panel';
panel.open = true;
panel.innerHTML = `<summary>Pemeriksaan Nombor Kenderaan</summary>
  <p class="plate-search-instructions">Untuk periksa nombor kenderaan, masukkan nombor penuh kenderaan, kemudian tekan butang Cari</p>
  <form class="verification-form">
    <input type="search" aria-label="Nombor kenderaan penuh" placeholder="Contoh ABC1234" required maxlength="24">
    <button class="btn">Cari</button>
  </form>
  <div><p role="status"></p>
  <ul aria-label="Hasil carian kenderaan"></ul></div>`;
anchor.append(panel);
const form = panel.querySelector('form');
const input = form.querySelector('input');
const button = form.querySelector('button');
const status = panel.querySelector('[role="status"]');
const results = panel.querySelector('ul');
const cap = 20;
const format = new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeZone: 'Asia/Kuala_Lumpur' });

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  const plate = input.value.trim().toUpperCase().replace(/\s+/g, '');
  results.replaceChildren();
  if (!/^[A-Z0-9]{2,24}$/.test(plate)) {
    status.textContent = 'Masukkan nombor kenderaan penuh.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Mencari…';
  try {
    const responses = collection(window.__FIRESTORE, 'responses');
    const snapshots = await Promise.all([
      getDocs(query(responses, where('vehicleNo', '==', plate), limit(cap))),
      getDocs(query(responses, where('vehicleNumbers', 'array-contains', plate), limit(cap))),
    ]);
    const found = new Map(snapshots.flatMap(snapshot => snapshot.docs.map(doc => [doc.id, doc.data()])));
    const rows = [...found.values()].map(row => ({ row, date: row.eta?.toDate?.() }))
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    for (const { row, date } of rows.slice(0, cap)) {
      const item = document.createElement('li');
      item.textContent = [date ? format.format(date) : 'Tarikh masuk tidak tersedia', row.hostUnit].filter(Boolean).join(' · ');
      results.append(item);
    }
    status.textContent = rows.length
      ? (rows.length >= cap || snapshots.some(snapshot => snapshot.size === cap)
        ? 'Paparan dihadkan kepada 20 rekod.' : rows.length + ' rekod dijumpai.')
      : 'Tiada padanan untuk ' + plate + '.';
  } catch (error) {
    console.warn('Carian nombor kenderaan gagal', error);
    status.textContent = 'Carian gagal. Semak sesi log masuk dan cuba semula.';
  } finally {
    button.disabled = false;
  }
});
