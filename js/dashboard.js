import {
  collection, query, where, getDocs, orderBy, doc, updateDoc, serverTimestamp, addDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const loginBox = document.getElementById('loginBox');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginMsg = document.getElementById('loginMsg');
const dashboardArea = document.getElementById('dashboardArea');
const who = document.getElementById('who');
const listArea = document.getElementById('listArea');
const reloadBtn = document.getElementById('reloadBtn');

function formatDate(ts){
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  return d.toLocaleString('en-GB');
}

function showLoginMsg(m, ok=true){ loginMsg.textContent = m; loginMsg.style.color = ok ? 'green' : 'red'; }

loginBtn.addEventListener('click', async ()=>{
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  showLoginMsg('Log masuk...');
  try {
    await signInWithEmailAndPassword(window.__AUTH, email, pass);
  } catch (err) {
    console.error('login err', err);
    showLoginMsg('Gagal log masuk: ' + (err.message || err), false);
  }
});

logoutBtn.addEventListener('click', async ()=>{
  await signOut(window.__AUTH);
});

onAuthStateChanged(window.__AUTH, user => {
  if (user) {
    loginBox.style.display = 'none';
    dashboardArea.style.display = 'block';
    who.textContent = user.email || user.uid;
    logoutBtn.style.display = 'inline-block';
    loadList();
  } else {
    loginBox.style.display = 'block';
    dashboardArea.style.display = 'none';
    logoutBtn.style.display = 'none';
  }
});

reloadBtn.addEventListener('click', ()=> loadList());

async function loadList(){
  listArea.innerHTML = '<div class="small">Memuat...</div>';
  try {
    const col = collection(window.__FIRESTORE, 'responses');
    // For demo: fetch last 100 entries, order by createdAt desc.
    const q = query(col, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    renderList(rows);
  } catch (err) {
    console.error('loadList err', err);
    listArea.innerHTML = '<div class="small">Gagal muat. Semak konsol.</div>';
  }
}

function renderList(rows){
  if (!rows.length) return listArea.innerHTML = '<div class="small">Tiada rekod</div>';
  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `<thead><tr><th>Nama</th><th>Unit</th><th>Kategori</th><th>ETA</th><th>ETD</th><th>Status</th><th>Aksi</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const statusClass = r.status === 'Checked In' ? 'pill-in' : (r.status === 'Checked Out' ? 'pill-out' : 'pill-pending');
    tr.innerHTML = `
      <td>${r.name || ''}</td>
      <td>${r.unit || ''}</td>
      <td>${r.category || ''}</td>
      <td>${formatDate(r.eta)}</td>
      <td>${formatDate(r.etd)}</td>
      <td><span class="status-pill ${statusClass}">${r.status || 'Pending'}</span></td>
      <td>
        <div class="actions">
          <button class="btn" data-action="in" data-id="${r.id}">Check In</button>
          <button class="btn btn-ghost" data-action="out" data-id="${r.id}">Check Out</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  listArea.innerHTML = '';
  listArea.appendChild(table);

  // attach handlers
  listArea.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async (ev) => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      await doStatusUpdate(id, action === 'in' ? 'Checked In' : 'Checked Out');
    });
  });
}

async function doStatusUpdate(docId, newStatus){
  try {
    const ref = doc(window.__FIRESTORE, 'responses', docId);
    // get old value (we don't fetch doc for brevity; Firestore requires read separately if needed)
    await updateDoc(ref, { status: newStatus, updatedAt: serverTimestamp() });
    // audit
    const auditCol = collection(window.__FIRESTORE, 'audit');
    await addDoc(auditCol, {
      ts: serverTimestamp(),
      userId: window.__AUTH.currentUser ? window.__AUTH.currentUser.uid : 'unknown',
      rowId: docId,
      field: 'status',
      old: '',
      new: newStatus,
      actionId: String(Date.now()),
      notes: ''
    });
    loadList();
  } catch (err) {
    console.error('update err', err);
    alert('Gagal kemaskini status. Semak konsol.');
  }
}
