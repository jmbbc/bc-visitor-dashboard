// js/dashboard.js — full patched version with parking save fixes, deterministic doc IDs,
// and assignLotTransaction (Firestore transaction) for atomic parking assignment.
//
// NOTE: This file now supports per-page date filters. There are three separate
// date inputs: `filterDateSummary`, `filterDateCheckedIn`, and `filterDateParking`.
// Each page uses its own selected date and changing one won't affect the others.

import {
  collection, query, where, getDocs, onSnapshot, orderBy, limit, doc, updateDoc, serverTimestamp,
  addDoc, setDoc, Timestamp, getDoc, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/* ---------- helpers ---------- */
function formatDateOnly(ts){
  if (!ts) return '-';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}
function isoDateString(d){ const dd = String(d.getDate()).padStart(2,'0'); const mm = String(d.getMonth()+1).padStart(2,'0'); const yy = d.getFullYear(); return `${yy}-${mm}-${dd}`; }
function showLoginMsg(el, m, ok=true){ el.textContent = m; el.style.color = ok ? 'green' : 'red'; }
function toast(msg, ok = true){ const t = document.createElement('div'); t.className = `msg ${ok ? 'ok' : 'err'}`; t.textContent = msg; // a11y
  t.setAttribute('role','status'); t.setAttribute('aria-live','polite'); t.setAttribute('aria-atomic','true');
  document.body.appendChild(t); setTimeout(()=>t.remove(),3000); }
function escapeHtml(s){ if (!s) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function normalizePhoneForWhatsapp(raw){
  let p = String(raw || '').trim();
  p = p.replace(/[\s\-().]/g,'');
  if (!p) return '#';
  if (p.startsWith('+')) return `https://wa.me/${p.replace(/^\+/,'')}`;
  if (p.startsWith('0')) return `https://wa.me/6${p.replace(/^0+/,'')}`;
  return `https://wa.me/${p}`;
}

/* ---------- Category Mapping (moved early to avoid TDZ) ---------- */
const categoryClassMap = {
  'Pelawat': 'cat-pelawat',
  'Kontraktor': 'cat-kontraktor',
  'Pindah barang': 'cat-pindah',
  'Pelawat Khas': 'cat-pelawat-khas',
  'Penghantaran Barang': 'cat-penghantaran',
  'Kenderaan': 'cat-lain',
  'Penghuni': 'cat-lain'
};

/* ---------- DOM refs ---------- */
const loginBox = document.getElementById('loginBox');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const loginMsg = document.getElementById('loginMsg');
const dashboardArea = document.getElementById('dashboardArea');
const who = document.getElementById('who');
const listAreaSummary = document.getElementById('listAreaSummary');
const listAreaCheckedIn = document.getElementById('listAreaCheckedIn');
const reloadBtn = document.getElementById('reloadBtn');
// per-page date inputs (summary, checked-in, parking)
const filterDateSummary = document.getElementById('filterDateSummary');
const filterDateCheckedIn = document.getElementById('filterDateCheckedIn');
const summaryDateWrap = document.getElementById('summaryDateWrap');
const checkedInDateWrap = document.getElementById('checkedInDateWrap');
// parking page uses internal week navigator; track its current yyyy-mm-dd
let parkingCurrentDate = null;
const todayLabel = document.getElementById('todayLabel');
const todayTime = document.getElementById('todayTime');
const kpiWrap = document.getElementById('kpiWrap');
const injectedControls = document.getElementById('injectedControls');

// Units cache (unitId -> doc data) used to display unit category fallback
const unitsCache = Object.create(null);

function setAdminLoggedIn(val){
  try { sessionStorage.setItem('admin_logged_in', val ? '1' : '0'); } catch(e) {}
}
function isAdminLoggedIn(){ try { return sessionStorage.getItem('admin_logged_in') === '1'; } catch(e){ return false; } }

async function loadAllUnitsToCache(){
  try{
    if (!window.__FIRESTORE) return;
    const col = collection(window.__FIRESTORE, 'units');
    const snap = await getDocs(col);
    snap.forEach(d => { unitsCache[d.id] = d.data(); });
    console.info('[units] loaded', Object.keys(unitsCache).length);
  } catch(e) { console.warn('[units] cache load failed', e); }
}

const navSummary = document.getElementById('navSummary');
const navCheckedIn = document.getElementById('navCheckedIn');
const navParking = document.getElementById('navParking');
const exportCSVBtn = document.getElementById('exportCSVBtn');

// auto-refresh timer handle
let autoRefreshTimer = null;
// live clock timer
let timeTicker = null;
// whether the user manually changed the date filter — prevents unwanted auto-reset
// track manual changes per-page so auto-sync doesn't override user's explicit selection
let filterDateUserChangedSummary = false;
let filterDateUserChangedCheckedIn = false;
let filterDateUserChangedParking = false;
// lightweight in-memory cache to reduce duplicate reads
// responseCache caches per-day query results (dateStr -> rows)
const responseCache = { date: null, rows: [] };
// weekCache keyed by week start date (yyyy-mm-dd) -> rows for that week
const weekResponseCache = Object.create(null);

function startAutoRefresh(intervalMs = 600_000){
  try{
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(()=>{
      console.info('[autoRefresh] running loadTodayList');
      loadTodayList();
    }, intervalMs);
    console.info('[autoRefresh] started interval', intervalMs);
    return autoRefreshTimer;
  } catch(e) { console.warn('startAutoRefresh err', e); }
}

/* ---------- Nav selection helpers (visual selected state + keyboard activation) ---------- */
function setSelectedNav(el){
  try{
    document.querySelectorAll('.sidebar .nav-item').forEach(b=>b.classList.remove('selected'));
    if (el && el.classList) el.classList.add('selected');
  } catch(e) { /* ignore */ }
}

function getActivePageKey(){
  try{
    if (navSummary && navSummary.classList.contains('active')) return 'summary';
    if (navCheckedIn && navCheckedIn.classList.contains('active')) return 'checkedin';
    if (navParking && navParking.classList.contains('active')) return 'parking';
  } catch(e){}
  return 'summary';
}

function getParkingDate(){
  // parkingCurrentDate takes precedence (set via setParkingDate)
  if (parkingCurrentDate) return parkingCurrentDate;
  // otherwise fall back to the summary date (so parking defaults to the summary selection)
  if (filterDateSummary && filterDateSummary.value) return filterDateSummary.value;
  return isoDateString(new Date());
}

// Ensure nav buttons support keyboard activation (Enter / Space) and toggle visual selection
[navSummary, navCheckedIn, navParking].forEach(btn => {
  if (!btn) return;
  // toggle selection on click (keeps visual box outline)
  btn.addEventListener('click', (e) => {
    try { setSelectedNav(btn); } catch(err){}
  });
  // allow Enter / Space to activate the button for keyboard users
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });
});


/* ---------- debug ---------- */
console.info('dashboard.js loaded. __AUTH?', !!window.__AUTH, '__FIRESTORE?', !!window.__FIRESTORE);

/* ---------- auth handlers ---------- */
loginBtn.addEventListener('click', async ()=>{
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  showLoginMsg(loginMsg, 'Log masuk...');
  try {
    // login
    const cred = await signInWithEmailAndPassword(window.__AUTH, email, pass);
    console.info('Login success:', cred.user && (cred.user.email || cred.user.uid));
    showLoginMsg(loginMsg, 'Berjaya log masuk.');
  } catch (err) {
    console.error('login err detailed', err);
    const code = err && err.code ? err.code : 'unknown_error';
    const msg = err && err.message ? err.message : String(err);
    showLoginMsg(loginMsg, `Gagal log masuk: ${code} — ${msg}`, false);
  }
});

logoutBtn.addEventListener('click', async ()=> {
  try {
    await signOut(window.__AUTH);
    showLoginMsg(loginMsg, 'Anda telah log keluar.', true);
  } catch (err) {
    console.error('logout err', err);
    showLoginMsg(loginMsg, 'Gagal log keluar', false);
  }
});

/* ---------- auth state change ---------- */
onAuthStateChanged(window.__AUTH, user => {
  console.info('dashboard: onAuthStateChanged ->', user ? (user.email || user.uid) : 'signed out');
  if (user) {
    loginBox.style.display = 'none';
    dashboardArea.style.display = 'block';
    who.textContent = user.email || user.uid;
    logoutBtn.style.display = 'inline-block';


    const now = new Date();
    todayLabel.textContent = formatDateOnly(now);
    todayTime.textContent = now.toLocaleTimeString();
    // start a live clock that updates every second and keep date in sync if midnight passes
    try {
      if (timeTicker) clearInterval(timeTicker);
      timeTicker = setInterval(()=>{
        const n = new Date();
        todayTime.textContent = n.toLocaleTimeString();
        // if date changes (passed midnight) update label + reload data for new date
        const newDateStr = isoDateString(new Date());

        // determine active page and its currently selected date
        const active = (typeof getActivePageKey === 'function') ? getActivePageKey() : 'summary';
        let curDateStr = isoDateString(new Date());
        if (active === 'summary' && filterDateSummary) curDateStr = filterDateSummary.value || isoDateString(new Date());
        else if (active === 'checkedin' && filterDateCheckedIn) curDateStr = filterDateCheckedIn.value || isoDateString(new Date());
        else if (active === 'parking') curDateStr = getParkingDate();

        if (curDateStr !== newDateStr) {
          todayLabel.textContent = formatDateOnly(new Date());
          // leave the user's chosen date untouched unless they didn't change it manually
          let shouldAuto = false;
          if (active === 'summary' && !filterDateUserChangedSummary && responseCache.date === curDateStr) shouldAuto = true;
          if (active === 'checkedin' && !filterDateUserChangedCheckedIn && responseCache.date === curDateStr) shouldAuto = true;
          if (active === 'parking' && !filterDateUserChangedParking && responseCache.date === curDateStr) shouldAuto = true;
          if (shouldAuto) {
            if (active === 'summary' && filterDateSummary) { filterDateSummary.value = newDateStr; filterDateUserChangedSummary = false; }
            if (active === 'checkedin' && filterDateCheckedIn) { filterDateCheckedIn.value = newDateStr; filterDateUserChangedCheckedIn = false; }
            if (active === 'parking') { parkingCurrentDate = newDateStr; filterDateUserChangedParking = false; }
            loadTodayList();
          }
        }
      }, 1000);
    } catch(e) { console.warn('timeTicker start failed', e); }
    // initialize each per-page filterDate input with today if empty
    const todayKey = isoDateString(now);
    if (filterDateSummary && !filterDateSummary.value) filterDateSummary.value = todayKey;
    if (filterDateCheckedIn && !filterDateCheckedIn.value) filterDateCheckedIn.value = todayKey;
    if (!parkingCurrentDate) parkingCurrentDate = todayKey;
    loadTodayList();
    startAutoRefresh();
  } else {
    loginBox.style.display = 'block';
    dashboardArea.style.display = 'none';
    logoutBtn.style.display = 'none';
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    if (timeTicker) { clearInterval(timeTicker); timeTicker = null; }
    // unsubscribe any active onSnapshot listener to avoid continued reads after sign-out
    try { if (typeof window.__RESPONSES_UNSUB === 'function') { window.__RESPONSES_UNSUB(); window.__RESPONSES_UNSUB = null; window.__RESPONSES_DATE = null; } } catch(e) { /* ignore */ }
  }
});

/* ---------- paging & fetch ---------- */
async function loadTodayList(){
  // load data for the currently active page using that page's date filter
  const active = (typeof getActivePageKey === 'function') ? getActivePageKey() : 'summary';
  if (active === 'parking') {
    const dateStr = getParkingDate();
    if (typeof window.loadParkingForDate === 'function') await window.loadParkingForDate(dateStr);
    return;
  }
  // summary / checked-in use the same loadListForDateStr function (snapshot-driven)
  const dateStr = (active === 'checkedin' && filterDateCheckedIn && filterDateCheckedIn.value) ? filterDateCheckedIn.value : ((filterDateSummary && filterDateSummary.value) ? filterDateSummary.value : isoDateString(new Date()));
  await loadListForDateStr(dateStr);
}

/* ---------- Admin: simple shared-password / units editor & CSV import ---------- */
// password is taken from window.__APP_CONFIG?.adminPassword or fallback to 'admin'
function adminPasswordIsCorrect(val){
  try {
    const cfg = window.__APP_CONFIG || {};
    const expected = cfg.adminPassword || 'admin';
    return String(val || '') === String(expected);
  } catch(e) { return false; }
}

function renderUnitsList(){
  const el = document.getElementById('unitsListArea');
  if (!el) return;
  const keys = Object.keys(unitsCache).sort();
  if (!keys.length) { el.innerHTML = '<div class="small">Tiada unit dalam rekod.</div>'; return; }
  let html = '<table><thead><tr><th>Unit</th><th>Kategori</th><th>Tunggakan</th><th>Jumlah (RM)</th><th>Terakhir</th><th></th></tr></thead><tbody>';
  keys.forEach(k => {
    const u = unitsCache[k] || {};
    html += `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(u.category||'')}</td><td>${u.arrears ? 'Ya' : 'Tiada'}</td><td>${typeof u.arrearsAmount === 'number' ? 'RM'+String(u.arrearsAmount) : '-'}</td><td>${u.lastUpdatedAt ? formatDateOnly(u.lastUpdatedAt) : '-'}</td><td><button class="btn-ghost small" data-unit-edit="${escapeHtml(k)}">Edit</button></td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
  // wire up edit buttons
  el.querySelectorAll('button[data-unit-edit]').forEach(b => {
    b.addEventListener('click', (ev) => {
      const id = b.getAttribute('data-unit-edit');
      const u = unitsCache[id] || {};
      document.getElementById('unitEditArea').style.display = 'block';
      document.getElementById('unitEditId').value = id;
      document.getElementById('unitEditCategory').value = u.category || '';
      document.getElementById('unitEditArrears').value = u.arrears ? 'true' : 'false';
      document.getElementById('unitEditAmount').value = typeof u.arrearsAmount === 'number' ? u.arrearsAmount : '';
    });
  });
}

async function adminLogin(password){
  if (!adminPasswordIsCorrect(password)) return false;
  setAdminLoggedIn(true);
  document.getElementById('adminLoginWrap').style.display = 'none';
  document.getElementById('adminControls').style.display = 'block';
  document.getElementById('adminLogoutBtn').style.display = 'inline-block';
  document.getElementById('adminLoginMsg').textContent = 'Log masuk sebagai admin.';
  // load units into cache
  await loadAllUnitsToCache();
  renderUnitsList();
  return true;
}

function adminLogout(){
  setAdminLoggedIn(false);
  document.getElementById('adminLoginWrap').style.display = 'block';
  document.getElementById('adminControls').style.display = 'none';
  document.getElementById('adminLogoutBtn').style.display = 'none';
  document.getElementById('adminLoginMsg').textContent = '';
}

// CSV parsing (simple RFC4180-ish, returns array of objects using header row)
function parseCSV(text){
  const rows = [];
  // split into lines, handle \r\n and quoted values roughly
  const lines = text.replace(/\r/g,'').split('\n').filter(l => l.trim().length);
  if (!lines.length) return rows;
  const header = lines[0].split(',').map(h => h.trim());
  for (let i=1;i<lines.length;i++){
    const line = lines[i];
    // basic split (does not handle embedded commas inside quotes reliably) — for most CSVs this is ok
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g,''));
    if (parts.length === 0) continue;
    const obj = {};
    for (let j=0;j<header.length;j++) obj[header[j]] = parts[j] || '';
    rows.push(obj);
  }
  return rows;
}

async function saveUnitToFirestore(unitId, data){
  if (!window.__FIRESTORE) throw new Error('firestore unavailable');
  const ref = doc(window.__FIRESTORE, 'units', unitId);
  const payload = Object.assign({}, data, { lastUpdatedAt: serverTimestamp(), lastUpdatedBy: who.textContent || 'admin' });
  await setDoc(ref, payload, { merge: true });
  // update cache
  unitsCache[unitId] = Object.assign({}, unitsCache[unitId] || {}, data, { lastUpdatedAt: new Date() });
  renderUnitsList();
}

async function importUnitsFromArray(rows){
  if (!window.__FIRESTORE) throw new Error('firestore unavailable');
  // rows: array of objects with unitId, category, arrears, arrearsAmount
  const BATCH_SIZE = 200;
  const batches = [];
  let currentBatch = writeBatch(window.__FIRESTORE);
  let count = 0, batchCount = 0;
  for (const r of rows){
    const id = (r.unitId || r.unit || r.Unit || '').trim();
    if (!id) continue;
    const data = { category: (r.category || '').trim(), arrears: String(r.arrears || '').toLowerCase() === 'true', arrearsAmount: r.arrearsAmount ? Number(r.arrearsAmount) : null };
    const ref = doc(window.__FIRESTORE, 'units', id);
    currentBatch.set(ref, Object.assign({}, data, { lastUpdatedAt: serverTimestamp(), lastUpdatedBy: who.textContent || 'admin' }), { merge: true });
    count++;
    if (count >= BATCH_SIZE){ batches.push(currentBatch); currentBatch = writeBatch(window.__FIRESTORE); count = 0; batchCount++; }
  }
  if (count > 0) batches.push(currentBatch);
  let success = 0;
  for (let i=0;i<batches.length;i++){
    try { await batches[i].commit(); success++; } catch(e) { console.error('batch commit failed', e); }
  }
  // reload cache
  await loadAllUnitsToCache();
  renderUnitsList();
  return { batches: batches.length, committed: success };
}

// wire admin UI when dashboard is initialized
document.addEventListener('DOMContentLoaded', ()=>{
  const loginBtnAdmin = document.getElementById('adminLoginBtn');
  const logoutBtnAdmin = document.getElementById('adminLogoutBtn');
  const adminMsg = document.getElementById('adminLoginMsg');
  const passwordEl = document.getElementById('adminPassword');
  const unitSearchEl = document.getElementById('unitSearch');
  const unitAddBtnEl = document.getElementById('unitAddBtn');
  const saveUnitBtn = document.getElementById('saveUnitBtn');
  const cancelUnitBtn = document.getElementById('cancelUnitBtn');
  const csvInput = document.getElementById('csvFileInput');
  const csvPreviewBtn = document.getElementById('csvPreviewBtn');
  const csvImportBtn = document.getElementById('csvImportBtn');
  const csvPreviewArea = document.getElementById('csvPreviewArea');

  if (!loginBtnAdmin) return;

  // restore admin session if present
  if (isAdminLoggedIn()) {
    document.getElementById('adminLoginWrap').style.display = 'none';
    document.getElementById('adminControls').style.display = 'block';
    document.getElementById('adminLogoutBtn').style.display = 'inline-block';
    loadAllUnitsToCache().then(()=> renderUnitsList());
  }

  loginBtnAdmin.addEventListener('click', async ()=>{
    const ok = await adminLogin(passwordEl.value || '');
    if (!ok) adminMsg.textContent = 'Password salah.';
    else adminMsg.textContent = '';
  });

  logoutBtnAdmin.addEventListener('click', ()=>{ adminLogout(); });

  unitAddBtnEl?.addEventListener('click', ()=>{
    const v = (unitSearchEl?.value || '').trim();
    if (!v) { document.getElementById('unitEditArea').style.display = 'block'; document.getElementById('unitEditId').value = ''; return; }
    document.getElementById('unitEditArea').style.display = 'block'; document.getElementById('unitEditId').value = v;
    const u = unitsCache[v] || {};
    document.getElementById('unitEditCategory').value = u.category || '';
    document.getElementById('unitEditArrears').value = u.arrears ? 'true' : 'false';
    document.getElementById('unitEditAmount').value = typeof u.arrearsAmount === 'number' ? u.arrearsAmount : '';
  });

  cancelUnitBtn?.addEventListener('click', ()=>{ document.getElementById('unitEditArea').style.display = 'none'; });

  saveUnitBtn?.addEventListener('click', async ()=>{
    const id = (document.getElementById('unitEditId').value || '').trim();
    if (!id) { alert('Unit ID kosong'); return; }
    const cat = (document.getElementById('unitEditCategory').value || '').trim();
    const arr = document.getElementById('unitEditArrears').value === 'true';
    const amount = document.getElementById('unitEditAmount').value ? Number(document.getElementById('unitEditAmount').value) : null;
    try { await saveUnitToFirestore(id, { category: cat, arrears: arr, arrearsAmount: amount }); toast('Unit disimpan'); document.getElementById('unitEditArea').style.display = 'none'; } catch(e) { console.error(e); toast('Gagal simpan unit', false); }
  });

  csvPreviewBtn?.addEventListener('click', ()=>{
    if (!csvInput || !csvInput.files || !csvInput.files[0]) { csvPreviewArea.style.display = 'block'; csvPreviewArea.textContent = 'Sila pilih fail CSV terlebih dahulu.'; return; }
    const f = csvInput.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(reader.result || '');
      csvPreviewArea.style.display = 'block'; csvPreviewArea.innerHTML = '<div class="small">Pratonton (10 baris pertama)</div>';
      const preview = rows.slice(0,10).map(r=> JSON.stringify(r)).join('\n');
      const pre = document.createElement('pre'); pre.textContent = preview; csvPreviewArea.appendChild(pre);
      csvPreviewArea._rows = rows;
    };
    reader.readAsText(f);
  });

  csvImportBtn?.addEventListener('click', async ()=>{
    if (!csvPreviewArea || !csvPreviewArea._rows || !csvPreviewArea._rows.length) { alert('Sila pratonton CSV terlebih dahulu'); return; }
    if (!confirm('Sahkan import CSV? Ini akan mengemas kini collection units (tidak mengubah rekod pendaftaran lama).')) return;
    try {
      document.getElementById('spinner').style.display = 'flex';
      const res = await importUnitsFromArray(csvPreviewArea._rows);
      toast('Import selesai: ' + (res.batches||0) + ' batch(es)');
    } catch(e) { console.error(e); toast('Import gagal', false); }
    finally { document.getElementById('spinner').style.display = 'none'; }
  });
});

if (reloadBtn) reloadBtn.addEventListener('click', ()=> loadTodayList());
if (filterDateSummary) filterDateSummary.addEventListener('change', ()=>{
  const todayKey = isoDateString(new Date());
  filterDateUserChangedSummary = (filterDateSummary.value !== todayKey);
  loadListForDateStr(filterDateSummary.value || isoDateString(new Date()));
});

if (filterDateCheckedIn) filterDateCheckedIn.addEventListener('change', ()=>{
  const todayKey = isoDateString(new Date());
  filterDateUserChangedCheckedIn = (filterDateCheckedIn.value !== todayKey);
  loadListForDateStr(filterDateCheckedIn.value || isoDateString(new Date()));
});

// parking date is managed by the parking module's week navigator -> no DOM date input change handler
if (navSummary) navSummary.addEventListener('click', ()=> { showPage('summary'); });
if (navCheckedIn) navCheckedIn.addEventListener('click', ()=> { showPage('checkedin'); });
if (exportCSVBtn) exportCSVBtn.addEventListener('click', ()=> { exportCSVForToday(); });

/* ---------- core fetch ---------- */
async function loadListForDateStr(yyyymmdd){
  console.info('[loadListForDateStr] called', yyyymmdd);
  const d = yyyymmdd.split('-');
  if (d.length !== 3) { listAreaSummary.innerHTML = '<div class="small">Tarikh tidak sah</div>'; return; }
  const from = new Date(parseInt(d[0],10), parseInt(d[1],10)-1, parseInt(d[2],10), 0,0,0,0);
  const to = new Date(from); to.setDate(to.getDate()+1);

  const spinner = document.getElementById('spinner');
  if (spinner) spinner.style.display = 'flex';
  listAreaSummary.innerHTML = '<div class="small">Memuat...</div>';
  listAreaCheckedIn.innerHTML = '<div class="small">Memuat...</div>';
  // KPIs are computed from cached/snapshot rows (avoid remote count APIs to reduce reads)

  try {
    // If we have cached rows for this date, render them immediately so the UI is responsive.
    // Then continue and fetch fresh data in the background so the UI eventually reconciles.
    if (responseCache.date === yyyymmdd && Array.isArray(responseCache.rows) && responseCache.rows.length) {
      const rows = responseCache.rows;
      // KPIs
      let pending = 0, checkedIn = 0, checkedOut = 0;
      rows.forEach(r => {
        if (!r.status || r.status === 'Pending') pending++;
        else if (r.status === 'Checked In') checkedIn++;
        else if (r.status === 'Checked Out') checkedOut++;
      });
      renderKPIs(pending, checkedIn, checkedOut);

      // render pages from cached rows
      renderList(rows, listAreaSummary, false);
      renderCheckedInList(rows.filter(r => r.status === 'Checked In'));
      console.info('[loadListForDateStr] used cache for instant render', yyyymmdd, 'rows:', rows.length);
      // continue — we will set up a snapshot listener below (or reuse existing) to get real-time updates
    }

    // try to reuse the cached rows for this date when available
    let rows = [];
    if (responseCache.date === yyyymmdd && Array.isArray(responseCache.rows) && responseCache.rows.length) {
      rows = responseCache.rows;
    } else {
      // We'll rely on snapshot / local rows for KPI computation to reduce remote count reads on Spark.
      const col = collection(window.__FIRESTORE, 'responses');
      const q = query(col, where('eta', '>=', Timestamp.fromDate(from)), where('eta', '<', Timestamp.fromDate(to)), orderBy('eta','asc'));

      // Use onSnapshot (real-time) for this date range — this reduces repeated full-fetch reads and
      // ensures clients stay in sync with server changes. If we already have a snapshot for this date
      // we'll reuse it; otherwise we install a new listener and let it drive updates.
      try {
        // unsubscribe previous snapshot if it's for another date
        if (typeof window.__RESPONSES_UNSUB === 'function' && window.__RESPONSES_DATE !== yyyymmdd) {
          try { window.__RESPONSES_UNSUB(); } catch(e) { /* ignore */ }
          window.__RESPONSES_UNSUB = null;
          window.__RESPONSES_DATE = null;
        }

        if (!window.__RESPONSES_UNSUB || window.__RESPONSES_DATE !== yyyymmdd) {
          console.info('[loadListForDateStr] attaching onSnapshot for', yyyymmdd);
          window.__RESPONSES_DATE = yyyymmdd;
          window.__RESPONSES_UNSUB = onSnapshot(q, snap => {
            const freshRows = [];
            snap.forEach(d => freshRows.push({ id: d.id, ...d.data() }));
            // update cache + UI
            responseCache.date = yyyymmdd;
            responseCache.rows = freshRows;

            // recompute KPIs and render
            let pending = 0, checkedIn = 0, checkedOut = 0;
            freshRows.forEach(r => {
              if (!r.status || r.status === 'Pending') pending++;
              else if (r.status === 'Checked In') checkedIn++;
              else if (r.status === 'Checked Out') checkedOut++;
            });
            renderKPIs(pending, checkedIn, checkedOut);
            renderList(freshRows, listAreaSummary, false);
            renderCheckedInList(freshRows.filter(r => r.status === 'Checked In'));
          }, err => console.error('[onSnapshot] error', err));
        }
        // let the snapshot handler populate rows — use cached rows for now
      } catch(snapshotErr) {
        console.warn('[loadListForDateStr] snapshot failed, falling back to getDocs', snapshotErr);
        const snap = await getDocs(q);
        snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      }
      // cache for reuse
      responseCache.date = yyyymmdd;
      responseCache.rows = rows;

      // compute KPIs from rows (we don't run remote counts on Spark to avoid extra reads)
      let pending = 0, checkedIn = 0, checkedOut = 0;
      rows.forEach(r => {
        if (!r.status || r.status === 'Pending') pending++;
        else if (r.status === 'Checked In') checkedIn++;
        else if (r.status === 'Checked Out') checkedOut++;
      });
      renderKPIs(pending, checkedIn, checkedOut);
    }

    // store in cache for reuse by other functions (export, parking summary)
    responseCache.date = yyyymmdd;
    responseCache.rows = rows;

    // KPIs already computed earlier in this function (from cache or snapshot fallback)

    // If we don't have rows from the primary eta query, try a safe fallback:
    // some older/migrated documents may not have 'eta' as a Timestamp (or may be missing),
    // but were created on the date the user expects; attempt to include those via createdAt.
    if ((!rows || rows.length === 0)) {
      try {
        console.info('[loadListForDateStr] no results for eta range — attempting fallback query using createdAt');
        const fallbackRows = [];
        const col2 = collection(window.__FIRESTORE, 'responses');
        const q2 = query(col2, where('createdAt', '>=', Timestamp.fromDate(from)), where('createdAt', '<', Timestamp.fromDate(to)), orderBy('createdAt','asc'));
        const snap2 = await getDocs(q2);
        snap2.forEach(d => fallbackRows.push({ id: d.id, ...d.data() }));
        if (fallbackRows.length) {
          // merge fallback rows into rows (avoid duplicates when both present)
          const ids = new Set(rows.map(r => r.id));
          fallbackRows.forEach(fr => { if (!ids.has(fr.id)) rows.push(fr); });
          responseCache.rows = rows;
          console.info('[loadListForDateStr] fallback found rows for createdAt:', fallbackRows.length);
          // Surface a brief UX hint so users know a fallback was used
          try { toast(`Menunjukkan ${fallbackRows.length} rekod yang dijumpai berdasarkan tarikh pembuatan (createdAt).`, true); } catch(e) {}
        }
      } catch (fbErr) {
        console.warn('[loadListForDateStr] fallback createdAt query failed', fbErr);
      }
      // If still nothing, attempt a limited, lenient client-side search for older documents
      if ((!rows || rows.length === 0)) {
        try {
          console.info('[loadListForDateStr] attempting lenient client-side fallback (limited fetch)');
          const looseRows = [];
          // limit the read to a reasonable number to avoid scanning entire collection
          // keep the read bounded — limit to 500 most recent documents to avoid scanning whole collection
          const q3 = query(col2, orderBy('createdAt','desc'), limit(500));
          // Try to get a limited snapshot — use getDocs and slice client-side
          const snap3 = await getDocs(q3);
          snap3.forEach(d => looseRows.push({ id: d.id, ...d.data() }));

          // Helper to get the date-only key (yyyy-mm-dd) from potential timestamp/string
          const toDateKey = (v) => {
            if (!v) return null;
            try {
              if (v && v.toDate) v = v.toDate();
              // if it's a string, parse it
              if (typeof v === 'string') v = new Date(v);
              if (!(v instanceof Date) || isNaN(v.getTime())) return null;
              return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
            } catch(e){ return null; }
          };

          const targetKey = yyyymmdd;
          const matched = looseRows.filter(r => {
            const etaKey = toDateKey(r.eta);
            const createdKey = toDateKey(r.createdAt);
            // if either eta or createdAt match the requested date, include
            return etaKey === targetKey || createdKey === targetKey;
          });
          if (matched.length) {
            // merge without duplicates
            const ids = new Set(rows.map(r => r.id));
            matched.forEach(m => { if (!ids.has(m.id)) rows.push(m); });
            responseCache.rows = rows;
            console.info('[loadListForDateStr] lenient fallback found rows:', matched.length);
            try { toast(`Menunjukkan ${matched.length} rekod (carian longgar) untuk tarikh ini.`, true); } catch(e){}
          }
        } catch (lenErr) {
          console.warn('[loadListForDateStr] lenient fallback failed', lenErr);
        }
      }
    }

    // render pages (snapshot listener will keep the UI fresh). Show the current rows we have.
    renderList(rows, listAreaSummary, false);
    renderCheckedInList(rows.filter(r => r.status === 'Checked In'));
    console.info('[loadListForDateStr] rendered summary + checked-in lists, rows:', rows.length);
  } catch (err) {
    console.error('loadList err', err);
    listAreaSummary.innerHTML = '<div class="small">Gagal muat. Semak konsol.</div>';
    listAreaCheckedIn.innerHTML = '<div class="small">Gagal muat. Semak konsol.</div>';
  } finally {
    if (spinner) spinner.style.display = 'none';
  }
}

/* ---------- KPIs ---------- */
function renderKPIs(pending, checkedIn, checkedOut){
  kpiWrap.innerHTML = '';
  const chip = (label, val, cls = '') => {
    const d = document.createElement('div');
    d.className = `chip ${cls}`.trim();
    d.textContent = `${label}: ${val}`;
    d.setAttribute('role','status');
    d.setAttribute('aria-live','polite');
    return d;
  };
  kpiWrap.appendChild(chip('Pending', pending, 'chip-pending'));
  kpiWrap.appendChild(chip('Dalam (Checked In)', checkedIn, 'chip-in'));
  kpiWrap.appendChild(chip('Keluar (Checked Out)', checkedOut, 'chip-out'));
}

/* ---------- Category ---------- */
function determineCategory(r){
  if (r.category) {
    // normalize whitespace and punctuation
    const k = String(r.category).trim().toLowerCase().replace(/[()\[\],.]/g,'');
    if (k.includes('contract') || k.includes('kontraktor') || k.includes('kontraktor')) return 'Kontraktor';
    if (k.includes('move') || k.includes('pindah')) return 'Pindah barang';
    if (k.includes('deliver') || k.includes('penghantaran') || k.includes('delivery') || k.includes('hantar')) return 'Penghantaran Barang';
    if (k.includes('vip') || k.includes('pelawat khas') || k.includes('special') || k.includes('v i p')) return 'Pelawat Khas';
    if (k.includes('resident') || k.includes('penghuni') || k.includes('owner') || k.includes('tenant') || k.includes('occupant')) return 'Penghuni';
    return String(r.category);
  }
  const note = (r.note || '').toString().toLowerCase();
  const role = (r.role || '').toString().toLowerCase();
  const vehicle = (Array.isArray(r.vehicleNumbers) ? r.vehicleNumbers.join(' ') : (r.vehicleNo || '')).toString().toLowerCase();
  if (/kontraktor|contractor|construction|kontraktor/i.test(note + ' ' + role)) return 'Kontraktor';
  if (/pindah|move out|moving|moved|move in|pindah rumah|pindah barang/i.test(note + ' ' + role)) return 'Pindah barang';
  if (/delivery|penghantaran|deliver|hantar|food|grab|foodpanda|lalamove/i.test(note + ' ' + role)) return 'Penghantaran Barang';
  if (/pelawat khas|vip|v\.i\.p|special guest|v i p/i.test(note + ' ' + role)) return 'Pelawat Khas';
  if (vehicle && vehicle.trim()) return 'Kenderaan';
  if (r.isResident || /penghuni|resident|owner|tenant/i.test(role + ' ' + note)) return 'Penghuni';
  return 'Pelawat';
}

/* ---------- Render summary ---------- */
function renderList(rows, containerEl, compact=false, highlightIds = new Set()){
  if (!rows || !rows.length) { containerEl.innerHTML = '<div class="small">Tiada rekod</div>'; return; }
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'table';
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>
      <th>Nama Pelawat</th>
      <th>Unit / Tuan Rumah</th>
      <th>Kategori Unit</th>
      <th>ETA</th>
      <th>ETD</th>
      <th>Kenderaan</th>
      <th>Kategori</th>
      <th>Status</th>
      <th>Aksi</th>
    </tr>`;
  table.appendChild(thead);
  const tbody = document.createElement('tbody');

  rows.forEach(r => {
    let vehicleDisplay = '-';
    if (Array.isArray(r.vehicleNumbers) && r.vehicleNumbers.length) vehicleDisplay = r.vehicleNumbers.join(', ');
    else if (r.vehicleNo) vehicleDisplay = r.vehicleNo;

    let hostContactHtml = '';
    if (r.hostName || r.hostPhone) {
      const phone = (r.hostPhone || '').trim();
      if (phone) {
        const normalized = normalizePhoneForWhatsapp(phone);
        hostContactHtml = `${escapeHtml(r.hostName || '')} • <a class="tel-link" href="${normalized}" target="_blank" rel="noopener noreferrer">${escapeHtml(phone)}</a>`;
      } else {
        hostContactHtml = escapeHtml(r.hostName || '');
      }
    }

    const categoryDisplay = determineCategory(r);
    const catClass = categoryClassMap[categoryDisplay] || 'cat-lain';
    const statusClass = r.status === 'Checked In' ? 'pill-in' : (r.status === 'Checked Out' ? 'pill-out' : 'pill-pending');

    const tr = document.createElement('tr');
    if (highlightIds && highlightIds.has(r.id)) tr.classList.add('conflict');
    tr.innerHTML = `
      <td class="visitor-cell">${escapeHtml(r.visitorName || '')}${r.entryDetails ? '<div class="small">'+escapeHtml(r.entryDetails || '')+'</div>' : ''}${r.visitorPhone ? (function(){ const waHref = normalizePhoneForWhatsapp(r.visitorPhone); return '<div class="small visitor-phone"><a class="tel-link" href="'+waHref+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(r.visitorPhone)+'</a></div>'; })() : ''}</td>
      <td>${escapeHtml(r.hostUnit || '')}${hostContactHtml ? '<div class="small">'+hostContactHtml+'</div>' : ''}</td>
      <td>${(function(){
        // prefer embedded snapshot on the visitor doc, fall back to units cache
        const uc = (r.unitCategory && String(r.unitCategory).trim()) ? String(r.unitCategory).trim() : (unitsCache[r.hostUnit] && unitsCache[r.hostUnit].category ? unitsCache[r.hostUnit].category : '—');
        const arrears = (r.unitArrears === true) ? true : (unitsCache[r.hostUnit] && unitsCache[r.hostUnit].arrears === true);
        const amount = (typeof r.unitArrearsAmount === 'number') ? r.unitArrearsAmount : (unitsCache[r.hostUnit] && typeof unitsCache[r.hostUnit].arrearsAmount === 'number' ? unitsCache[r.hostUnit].arrearsAmount : null);
        const badge = `<span class="unit-cat-badge">${escapeHtml(String(uc))}</span>`;
        const t = `${badge}${arrears ? ' <div class="small" style="margin-top:4px;color:#b91c1c">Tunggakan'+(amount ? ': RM'+String(amount) : '')+'</div>' : ''}`;
        return t;
      })()}</td>
      <td>${formatDateOnly(r.eta)}</td>
      <td>${formatDateOnly(r.etd)}</td>
      <td>${escapeHtml(vehicleDisplay)}</td>
      <td><span class="cat-badge ${catClass}">${escapeHtml(categoryDisplay)}</span></td>
      <td><span class="status-pill ${statusClass}">${escapeHtml(r.status || 'Pending')}</span></td>
      <td>
        <div class="actions">
          <button class="btn" data-action="in" data-id="${r.id}">Check In</button>
          <button class="btn btn-ghost" data-action="out" data-id="${r.id}">Check Out</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  wrap.appendChild(table);
  containerEl.innerHTML = '';
  containerEl.appendChild(wrap);

  containerEl.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      await doStatusUpdate(id, action === 'in' ? 'Checked In' : 'Checked Out');
    });
  });

  // No generic 'Isi Butiran' handlers here (checked-in edit removed)
}

/* ---------- Checked-In list (grouped by category) ---------- */
function renderCheckedInList(rows){
  const containerEl = listAreaCheckedIn;
  if (!rows || rows.length === 0) { containerEl.innerHTML = '<div class="small">Tiada rekod</div>'; return; }

  // group rows by category
  const groups = {};
  rows.forEach(r => {
    const c = determineCategory(r);
    groups[c] = groups[c] || [];
    groups[c].push(r);
  });

  // preferred order of categories
  const order = ['Pelawat','Kontraktor','Pindah barang','Penghantaran Barang','Pelawat Khas','Kenderaan','Penghuni'];
  const keys = Object.keys(groups).sort((a,b) => {
    const ia = order.indexOf(a); const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1; if (ib === -1) return -1; return ia - ib;
  });

  // build grouped card
  const wrap = document.createElement('div');
  wrap.className = 'card card-tight';
  keys.forEach(k => {
    const list = groups[k];
    const catClass = categoryClassMap[k] || 'cat-lain';
    const groupEl = document.createElement('div');
    groupEl.className = `parking-summary-group ${catClass}`;

    // header (coloured by category via catClass)
    const header = document.createElement('div');
    header.className = 'parking-summary-header';

    // create accessible toggle id for tbody
    const tidyKey = String(k).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'group';
    const tbodyId = `group-${tidyKey}-${Math.random().toString(36).slice(2,6)}`;

    header.innerHTML = `
      <div style="font-weight:700; display:flex; align-items:center; gap:12px">
        <button aria-controls="${tbodyId}" aria-expanded="true" class="group-toggle" title="Togol kumpulan ${escapeHtml(k)}">▾</button>
        <span class="group-title ${catClass}">${escapeHtml(k)}</span>
        <span class="small muted" style="margin-left:8px">(${list.length})</span>
      </div>`;
    groupEl.appendChild(header);

    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = `<thead><tr>
      <th>Kategori</th>
      <th>Unit / Tuan Rumah</th>
      <th>Tarikh masuk</th>
      <th>Tarikh keluar</th>
      <th>Kenderaan</th>
      <th>Status</th>
      <th>Aksi</th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');
    tbody.id = tbodyId;

    list.forEach(r => {
      const vehicleDisplay = (Array.isArray(r.vehicleNumbers) && r.vehicleNumbers.length) ? r.vehicleNumbers.join(', ') : (r.vehicleNo || '-');
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="cat-badge ${catClass}">${escapeHtml(k)}</span></td>
        <td>${escapeHtml(r.hostUnit || '')}${r.hostName ? '<div class="small">'+escapeHtml(r.hostName)+'</div>' : ''}</td>
        <td>${formatDateOnly(r.eta)}</td>
        <td>${formatDateOnly(r.etd)}</td>
        <td>${escapeHtml(vehicleDisplay)}</td>
        <td><span class="status-pill ${r.status === 'Checked In' ? 'pill-in' : (r.status === 'Checked Out' ? 'pill-out' : 'pill-pending')}">${escapeHtml(r.status || 'Pending')}</span></td>
        <td>
          <div class="actions">
            <button class="btn" data-action="in" data-id="${r.id}">Check In</button>
            <button class="btn btn-ghost" data-action="out" data-id="${r.id}">Check Out</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

      // attach toggle handler to header button
      setTimeout(()=>{
        const btn = header.querySelector('.group-toggle');
        if (!btn) return;
        btn.addEventListener('click', ()=>{
          const expanded = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', String(!expanded));
          if (!expanded) {
            // expand
            tbody.style.display = '';
            groupEl.classList.remove('collapsed');
            btn.textContent = '▾';
          } else {
            // collapse
            tbody.style.display = 'none';
            groupEl.classList.add('collapsed');
            btn.textContent = '▸';
          }
        });
      }, 0);

    table.appendChild(tbody);
    groupEl.appendChild(table);
    wrap.appendChild(groupEl);
  });

  containerEl.innerHTML = '';
  containerEl.appendChild(wrap);

  // attach button handlers
  containerEl.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      await doStatusUpdate(id, action === 'in' ? 'Checked In' : 'Checked Out');
    });
  });
}

/* ---------- Checked-In list ---------- */

/* ---------- status update & audit ---------- */
async function doStatusUpdate(docId, newStatus){
  // Optimistic update: update in-memory cache and UI immediately so the user perceives instant response.
  // Then perform the Firestore writes in the background and reconcile (reload) when the writes complete.
  const ref = doc(window.__FIRESTORE, 'responses', docId);
  let originalRow = null;
  try {
    // If we have cached rows, patch the cached entry and re-render immediately
    if (responseCache.date && Array.isArray(responseCache.rows)) {
      const idx = responseCache.rows.findIndex(r => r.id === docId);
      if (idx !== -1) {
        originalRow = Object.assign({}, responseCache.rows[idx]);
        responseCache.rows[idx] = Object.assign({}, responseCache.rows[idx], { status: newStatus, updatedAt: new Date() });
        // KPIs: update counts quickly using the cache
        const rows = responseCache.rows;
        let pending = 0, checkedIn = 0, checkedOut = 0;
        rows.forEach(r => {
          if (!r.status || r.status === 'Pending') pending++;
          else if (r.status === 'Checked In') checkedIn++;
          else if (r.status === 'Checked Out') checkedOut++;
        });
        // re-render immediately
        renderKPIs(pending, checkedIn, checkedOut);
        renderList(rows, listAreaSummary, false);
        renderCheckedInList(rows.filter(r => r.status === 'Checked In'));
      }
    }

    // perform write (don't block UI) — we'll still await the write so we can report failures,
    // but we will not block with a full reload; instead run a background reconciliation afterward.
    let snap = null;
    try {
      snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { status: newStatus, updatedAt: serverTimestamp() }, { merge: true });
      } else {
        await updateDoc(ref, { status: newStatus, updatedAt: serverTimestamp() });
      }
    } catch (writeErr) {
      // on write error revert the optimistic change
      console.error('[status] write failed', writeErr);
      toast('Gagal kemaskini status ke server. Cuba lagi', false);
      if (originalRow && responseCache.date && Array.isArray(responseCache.rows)) {
        const i2 = responseCache.rows.findIndex(r => r.id === docId);
        if (i2 !== -1) { responseCache.rows[i2] = originalRow; renderList(responseCache.rows, listAreaSummary, false); renderCheckedInList(responseCache.rows.filter(r => r.status === 'Checked In')); }
      }
      return;
    }

    // audit write: do not block UI — write audit in background
    (async () => {
      try {
        const auditCol = collection(window.__FIRESTORE, 'audit');
        await addDoc(auditCol, {
          ts: serverTimestamp(),
          userId: window.__AUTH.currentUser ? window.__AUTH.currentUser.uid : 'unknown',
          rowId: docId,
          field: 'status',
          old: snap && snap.exists() ? JSON.stringify(snap.data()) : '',
          new: newStatus,
          actionId: String(Date.now()),
          notes: 'Status change from dashboard'
        });
      } catch (auditErr) {
        console.error('[status] audit write failed', auditErr);
      }
    })();

    toast('Status dikemaskini');

    // rely on onSnapshot listeners (installed for the current date) to reconcile server-side changes
    // (avoids an extra full fetch/read after every status change)

  } catch (err) {
    console.error('[status] doStatusUpdate err', err);
    toast('Gagal kemaskini status. Semak konsol untuk butiran penuh.', false);
    // revert optimistic update if we previously set it
    if (originalRow && responseCache.date && Array.isArray(responseCache.rows)) {
      const i2 = responseCache.rows.findIndex(r => r.id === docId);
      if (i2 !== -1) { responseCache.rows[i2] = originalRow; renderList(responseCache.rows, listAreaSummary, false); renderCheckedInList(responseCache.rows.filter(r => r.status === 'Checked In')); }
    }
  }
}

/* overlap detection removed per user request */

/* ---------- CSV export ---------- */
async function exportCSVForToday(){
  // Export uses the summary's selected date
  const dateStr = (filterDateSummary && filterDateSummary.value) ? filterDateSummary.value : isoDateString(new Date());
  const d = dateStr.split('-');
  const from = new Date(parseInt(d[0],10), parseInt(d[1],10)-1, parseInt(d[2],10), 0,0,0,0);
  const to = new Date(from); to.setDate(to.getDate()+1);

  try {
    const col = collection(window.__FIRESTORE, 'responses');
    const q = query(col, where('eta', '>=', Timestamp.fromDate(from)), where('eta', '<', Timestamp.fromDate(to)), orderBy('eta','asc'));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (!rows.length) { toast('Tiada rekod untuk eksport'); return; }

    const header = ['id','hostUnit','hostName','hostPhone','visitorName','visitorPhone','category','eta','etd','vehicleNo','vehicleNumbers','status'];
    const csv = [header.join(',')];
    rows.forEach(r => {
      const line = [
        r.id || '',
        (r.hostUnit||'').replace(/,/g,''),
        (r.hostName||'').replace(/,/g,''),
        (r.hostPhone||'').replace(/,/g,''),
        (r.visitorName||'').replace(/,/g,''),
        (r.visitorPhone||'').replace(/,/g,''),
        (r.category||'').replace(/,/g,''),
        (r.eta && r.eta.toDate) ? r.eta.toDate().toISOString() : '',
        (r.etd && r.etd.toDate) ? r.etd.toDate().toISOString() : '',
        (r.vehicleNo||'').replace(/,/g,''),
        (Array.isArray(r.vehicleNumbers) ? r.vehicleNumbers.join(';') : '').replace(/,/g,''),
        (r.status||'')
      ];
      csv.push(line.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitors_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('export csv err', err);
    toast('Gagal eksport CSV. Semak konsol.');
  }
}

/* ---------- modal edit ---------- */
async function openEditModalFor(docId){
  try {
    const ref = doc(window.__FIRESTORE, 'responses', docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) { toast('Rekod tidak ditemui'); return; }
    const data = snap.data();
    document.getElementById('editDocId').value = docId;
    document.getElementById('editUnit').value = data.hostUnit || '';
    document.getElementById('editETA').value = data.eta && data.eta.toDate ? isoDateString(data.eta.toDate()) : '';
    document.getElementById('editETD').value = data.etd && data.etd.toDate ? isoDateString(data.etd.toDate()) : '';
    const veh = Array.isArray(data.vehicleNumbers) && data.vehicleNumbers.length ? data.vehicleNumbers.join(';') : (data.vehicleNo || '');
    document.getElementById('editVehicle').value = veh;
    document.getElementById('editStatus').value = data.status || 'Pending';
    openModal(document.getElementById('editModal'), '#saveEditBtn');
  } catch (err) {
    console.error('openEditModalFor err', err);
    toast('Gagal muatkan data. Semak konsol');
  }
}
// Modal helper: open, close, focus trap and restore focus
// Use 'var' here so the binding is hoisted and not subject to TDZ when modal helpers are invoked
var _lastFocusedElement = null;
function _getFocusable(modal){
  const sel = 'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(modal.querySelectorAll(sel)).filter(el => el.offsetParent !== null);
}
function openModal(modal, initialFocusSelector){
  if (!modal) return;
  _lastFocusedElement = document.activeElement;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  // focus
  const focusBase = initialFocusSelector ? modal.querySelector(initialFocusSelector) : modal.querySelector('button, input, select, textarea');
  (focusBase || modal).focus();
  // trap
  const focusables = _getFocusable(modal);
  if (focusables.length) {
    const first = focusables[0]; const last = focusables[focusables.length-1];
    modal._trapListener = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    modal.addEventListener('keydown', modal._trapListener);
  }
}
function closeModal(modal){
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden','true');
  if (modal._trapListener) { modal.removeEventListener('keydown', modal._trapListener); modal._trapListener = null; }
  if (_lastFocusedElement && typeof _lastFocusedElement.focus === 'function') _lastFocusedElement.focus();
  _lastFocusedElement = null;
}
document.getElementById('closeEditModal').addEventListener('click', ()=> closeModal(document.getElementById('editModal')));
document.getElementById('cancelEditBtn').addEventListener('click', ()=> closeModal(document.getElementById('editModal')));
document.getElementById('saveEditBtn').addEventListener('click', async (ev) => {
  ev.preventDefault();
  const id = document.getElementById('editDocId').value;
  if (!id) { toast('ID dokumen hilang'); return; }
  const unit = document.getElementById('editUnit').value.trim();
  const etaVal = document.getElementById('editETA').value || '';
  const etdVal = document.getElementById('editETD').value || '';
  const vehicleRaw = document.getElementById('editVehicle').value.trim();
  const status = document.getElementById('editStatus').value;

  const payload = {};
  if (unit) payload.hostUnit = unit;
  if (etaVal) payload.eta = Timestamp.fromDate(new Date(etaVal));
  if (etdVal) payload.etd = Timestamp.fromDate(new Date(etdVal));
  if (vehicleRaw) {
    const parts = vehicleRaw.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) { payload.vehicleNumbers = parts; payload.vehicleNo = ''; }
    else { payload.vehicleNo = parts[0] || ''; payload.vehicleNumbers = []; }
  }
  payload.status = status;
  payload.updatedAt = serverTimestamp();

  try {
    const ref = doc(window.__FIRESTORE, 'responses', id);
    const oldSnap = await getDoc(ref);
    const oldData = oldSnap.exists() ? oldSnap.data() : null;
    await updateDoc(ref, payload);

    const auditCol = collection(window.__FIRESTORE, 'audit');
    await addDoc(auditCol, {
      ts: serverTimestamp(),
      userId: window.__AUTH.currentUser ? window.__AUTH.currentUser.uid : 'unknown',
      rowId: id,
      field: 'manual_update',
      old: oldData ? JSON.stringify(oldData) : '',
      new: JSON.stringify(payload),
      actionId: String(Date.now()),
      notes: 'Manual edit from dashboard'
    });

    toast('Maklumat disimpan');
    closeModal(document.getElementById('editModal'));
    // update in-memory cache so UI reflects the manual edit immediately (no full reload)
    if (responseCache.date && Array.isArray(responseCache.rows)) {
      const idx = responseCache.rows.findIndex(r => r.id === id);
      if (idx !== -1) {
        const existing = responseCache.rows[idx] || {};
        responseCache.rows[idx] = Object.assign({}, existing, payload);
        renderList(responseCache.rows, listAreaSummary, false);
        renderCheckedInList(responseCache.rows.filter(r => r.status === 'Checked In'));
      }
    }
  } catch (err) {
    console.error('saveEdit err', err);
    toast('Gagal simpan. Semak konsol.');
  }
});

/* ---------- page switching ---------- */
function showPage(key){
  if (key === 'summary') {
    document.getElementById('pageSummary').style.display = '';
    document.getElementById('pageCheckedIn').style.display = 'none';
    document.getElementById('pageParking').style.display = 'none';
    navSummary.classList.add('active');
    navCheckedIn.classList.remove('active');
    if (navParking) navParking.classList.remove('active');
    // keep visual selection in sync with the active page
    try { setSelectedNav(navSummary); } catch(e) {}
    // show the per-page date control for summary
    try { if (summaryDateWrap) summaryDateWrap.style.display = ''; if (checkedInDateWrap) checkedInDateWrap.style.display = 'none'; } catch(e) {}
  } else if (key === 'checkedin') {
    document.getElementById('pageSummary').style.display = 'none';
    document.getElementById('pageCheckedIn').style.display = '';
    document.getElementById('pageParking').style.display = 'none';
    navSummary.classList.remove('active');
    navCheckedIn.classList.add('active');
    try { setSelectedNav(navCheckedIn); } catch(e) {}
    try { if (summaryDateWrap) summaryDateWrap.style.display = 'none'; if (checkedInDateWrap) checkedInDateWrap.style.display = ''; } catch(e) {}
    if (navParking) navParking.classList.remove('active');
  }
  // If user navigates away from registration views (eg. parking) unsubscribe snapshot listeners
  if (key !== 'summary' && key !== 'checkedin') {
    try { if (typeof window.__RESPONSES_UNSUB === 'function') { window.__RESPONSES_UNSUB(); window.__RESPONSES_UNSUB = null; window.__RESPONSES_DATE = null; } } catch(e) { /* ignore */ }
  } else {
    // When returning to summary/checkedin, ensure we have the latest snapshot for the current date
    try {
      // When returning to summary/checkedin, ensure we have the latest snapshot for the current date
      if (key === 'summary') {
        const ds = (filterDateSummary && filterDateSummary.value) ? filterDateSummary.value : isoDateString(new Date());
        loadListForDateStr(ds);
      } else if (key === 'checkedin') {
        const ds = (filterDateCheckedIn && filterDateCheckedIn.value) ? filterDateCheckedIn.value : isoDateString(new Date());
        loadListForDateStr(ds);
      }
    } catch(e) { /* ignore */ }
  }
  // KPIs are only relevant for the registration summary view
  try { kpiWrap.style.display = (key === 'summary') ? '' : 'none'; } catch(e) { /* ignore if missing */ }
  // Show/hide the right per-page date input already handled above
}

/* per-page date inputs are initialised when auth state becomes active */
document.addEventListener('DOMContentLoaded', ()=>{
  // ensure the initial nav 'active' has the visual selected state
  try { const initial = document.querySelector('.sidebar .nav-item.active'); if (initial) setSelectedNav(initial); } catch(e) { /* ignore */ }
});

/* ---------- Parking report module (patched) ---------- */
(function initParkingModule(){
  const pageParking = document.getElementById('pageParking');
  const parkingDateLabel = document.getElementById('parkingDateLabel');
  const parkingPKName = document.getElementById('parkingPKName');
  const parkingMasuk = document.getElementById('parkingMasuk');
  const parkingLuar = document.getElementById('parkingLuar');
  const parkingSaveAll = document.getElementById('parkingSaveAll');

  const modal = document.getElementById('parkingSlotModal');
  const closeParkingModal = document.getElementById('closeParkingModal');
  const cancelSlotBtn = document.getElementById('cancelSlotBtn');
  const saveSlotBtn = document.getElementById('saveSlotBtn');
  const clearSlotBtn = document.getElementById('clearSlotBtn');
  const slotNumberEl = document.getElementById('slotNumber');
  const slotVehicleEl = document.getElementById('slotVehicle');
  const slotUnitEl = document.getElementById('slotUnit');
  const slotETAEl = document.getElementById('slotETA');
  const slotETDEl = document.getElementById('slotETD');
  const slotDocIdEl = document.getElementById('slotDocId');

  const masukSlots = Array.from({length:19}, (_,i)=> String(i+1).padStart(2,'0')); // 01..19
  const luarSlots = Array.from({length:19}, (_,i)=> String(40 + i)); // 40..58

  // in-memory cache: { slotId: { vehicle, unit, eta, etd, docId } }
  let slotCache = {};

  function setParkingDate(dateStr){
    // dateStr may be undefined -> default to today
    const d = dateStr ? new Date(dateStr) : new Date();
    parkingCurrentDate = dateStr ? dateStr : isoDateString(new Date());
    parkingDateLabel.textContent = formatDateOnly(d);
  }

  // deterministic doc id helper
  function parkingDocIdFor(dateStr, slotId){
    const safeDate = dateStr || isoDateString(new Date());
    return `parking-${safeDate}-${slotId}`;
  }

  // load parking for date
  async function loadParkingForDate(dateStr){
    console.info('[parking] loadParkingForDate', dateStr);
    try {
      slotCache = {};
      const col = collection(window.__FIRESTORE, 'parkingSlots');
      const q = query(col, where('date', '==', dateStr), orderBy('slot','asc'));
      const snap = await getDocs(q);
      snap.forEach(d => {
        const data = d.data();
        const slotId = data.slot || '';
        slotCache[slotId] = Object.assign({}, data, { docId: d.id });
      });
      renderAllSlots();
    } catch (err) {
      console.error('[parking] loadParkingForDate err', err);
      toast('Gagal muat data parkir. Semak konsol.');
    }
  }

  // render single slot row
  function renderSlotRow(slotId, container){
    // console.debug to help trace rendering
    //console.debug('[parking] renderSlotRow', slotId);
    const data = slotCache[slotId] || {};
    const div = document.createElement('div');
    div.className = 'parking-slot' + (data.vehicle ? ' filled' : '');
    div.dataset.slot = slotId;
    div.innerHTML = `
      <div class="meta">
        <div class="slot-num">${escapeHtml(slotId)}</div>
        <div class="slot-info">
          <div class="small">${data.vehicle ? escapeHtml(data.vehicle) : '<span class="parking-empty">Kosong</span>'}</div>
          <div class="small">${data.unit ? escapeHtml(data.unit) : ''}${data.eta ? ' • '+escapeHtml(data.eta) : ''}${data.etd ? ' • '+escapeHtml(data.etd) : ''}</div>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-edit" data-slot="${escapeHtml(slotId)}">Edit</button>
      </div>
    `;
    const btn = div.querySelector('.btn-edit');
    btn.addEventListener('click', ()=> openSlotModal(slotId));
    container.appendChild(div);
  }

  // render all slots (defensive: make sure containers exist)
  function renderAllSlots(){
    try {
      if (!parkingMasuk || !parkingLuar) {
        console.warn('[parking] container missing', {parkingMasuk: !!parkingMasuk, parkingLuar: !!parkingLuar});
        return;
      }
      parkingMasuk.innerHTML = '';
      parkingLuar.innerHTML = '';
      masukSlots.forEach(s => renderSlotRow(s, parkingMasuk));
      luarSlots.forEach(s => renderSlotRow(s, parkingLuar));

      // also render compact lot list for quick overview
      try { renderParkingLotList(); } catch(e) { /* ignore if not present */ }
    } catch (err) {
      console.error('[parking] renderAllSlots err', err);
    }
  }

  // open modal for slot
  function openSlotModal(slotId){
    const data = slotCache[slotId] || {};
    slotNumberEl.value = slotId;
    slotVehicleEl.value = data.vehicle || '';
    slotUnitEl.value = data.unit || '';
    slotETAEl.value = data.eta || '';
    slotETDEl.value = data.etd || '';
    slotDocIdEl.value = data.docId || '';
    openModal(modal, '#slotVehicle');
  }

  // quick-edit by lot number control (inserts tiny control at top of parking page)
  try {
    const pageParkingEl = document.getElementById('pageParking');
    if (pageParkingEl) {
      // create a compact lot list container (top of page)
      const lotListWrap = document.createElement('div');
      lotListWrap.id = 'parkingLotListWrap';
      pageParkingEl.insertAdjacentElement('afterbegin', lotListWrap);
    }
  } catch (e) {
    console.warn('[parking] parking list container failed to create', e);
  }

  // render a compact list / grid view of all lots with status
  function renderParkingLotList(){
    try {
      const wrapper = document.getElementById('parkingLotListWrap');
      if (!wrapper) return;
      wrapper.innerHTML = '';

      const title = document.createElement('div');
      title.style.display = 'flex';
      title.style.justifyContent = 'space-between';
      title.style.alignItems = 'center';
      title.style.gap = '8px';
      title.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Senarai Lot Parkir</div><div class="small muted">(Klik lot untuk edit)</div>`;
      wrapper.appendChild(title);

      const cols = document.createElement('div');
      cols.className = 'lot-columns';

      // Render a single compact lot list (no separate Masuk / Luar columns)
      const singleList = document.createElement('div');
      singleList.className = 'lot-list';
      masukSlots.forEach(slotId => {
        const data = slotCache[slotId] || {};
        const chip = document.createElement('button');
        chip.className = 'lot-chip' + (data.vehicle ? ' filled' : '');
        chip.type = 'button';
        chip.textContent = slotId + (data.vehicle ? ` • ${data.vehicle}` : ' • Kosong');
        chip.dataset.slot = slotId;
        chip.addEventListener('click', ()=> openSlotModal(slotId));
        leftGrid.appendChild(chip);
      });
      luarSlots.forEach(slotId => {
        const data = slotCache[slotId] || {};
        const chip = document.createElement('button');
        chip.className = 'lot-chip' + (data.vehicle ? ' filled' : '');
        chip.type = 'button';
        chip.textContent = slotId + (data.vehicle ? ` • ${data.vehicle}` : ' • Kosong');
        chip.dataset.slot = slotId;
        chip.addEventListener('click', ()=> openSlotModal(slotId));
        rightGrid.appendChild(chip);
      });
      // combine both masuk and luar into a single list (ordered)
      const allSlots = masukSlots.concat(luarSlots);
      allSlots.forEach(slotId => {
        const data = slotCache[slotId] || {};
        const chip = document.createElement('button');
        chip.className = 'lot-chip' + (data.vehicle ? ' filled' : '');
        chip.type = 'button';
        chip.textContent = slotId + (data.vehicle ? ` • ${data.vehicle}` : ' • Kosong');
        chip.dataset.slot = slotId;
        chip.addEventListener('click', ()=> openSlotModal(slotId));
        singleList.appendChild(chip);
      });

      cols.appendChild(singleList);
      wrapper.appendChild(cols);
    } catch (err) {
      console.error('[parking] renderParkingLotList err', err);
    }
  }

  // save single slot (create or merge) using deterministic doc id
  async function saveSlot(slotId, payload, applyToResponses = false){
    try {
      const dateKey = getParkingDate();
      const docId = parkingDocIdFor(dateKey, slotId);
      const ref = doc(window.__FIRESTORE, 'parkingSlots', docId);
      await setDoc(ref, Object.assign({ slot: slotId, date: dateKey }, payload, { updatedAt: serverTimestamp() }), { merge: true });
      slotCache[slotId] = Object.assign(slotCache[slotId] || {}, payload, { docId });
      renderAllSlots();
      toast('Slot disimpan');
      // if user opted to apply the slot change to registration
      if (applyToResponses) {
        try {
          const dateKey = getParkingDate();
          const result = await applySlotToResponses(dateKey, slotId, payload);
          if (result && result.updated) toast(`Kemas kini pendaftaran: ${result.updated} rekod`);
          else if (result && result.matched === 0) toast('Tiada pendaftaran sepadan ditemui', false);
        } catch (err) {
          console.error('[parking] applySlotToResponses err', err);
          toast('Gagal kemaskini pendaftaran. Semak konsol.', false);
        }
      }
    } catch (err) {
      console.error('[parking] saveSlot err', err);
      toast('Gagal simpan slot. Semak konsol untuk butiran.');
    }
  }

  // clear single slot
  async function clearSlot(slotId){
    try {
      const dateKey = getParkingDate();
      const docId = parkingDocIdFor(dateKey, slotId);
      const ref = doc(window.__FIRESTORE, 'parkingSlots', docId);
      await setDoc(ref, { slot: slotId, date: dateKey, vehicle:'', unit:'', eta:'', etd:'', updatedAt: serverTimestamp() }, { merge: true });
      slotCache[slotId] = { vehicle:'', unit:'', eta:'', etd:'', docId };
      renderAllSlots();
      toast('Slot dikosongkan');
    } catch (err) {
      console.error('[parking] clearSlot err', err);
      toast('Gagal kosongkan slot. Semak konsol.');
    }
  }

  // save parking meta (PK name)
  async function saveParkingMeta(){
    try {
      const pkName = parkingPKName.value.trim();
      const dateKey = getParkingDate();
      const metaId = `meta-${dateKey}`;
      const ref = doc(window.__FIRESTORE, 'parkingMeta', metaId);
      await setDoc(ref, { date: dateKey, pkName, updatedAt: serverTimestamp() }, { merge: true });
      toast('Maklumat ringkasan disimpan');
    } catch (err) {
      console.error('[parking] saveParkingMeta err', err);
      toast('Gagal simpan ringkasan. Semak konsol.');
    }
  }

  // attach listeners for modal buttons
  if (saveSlotBtn) {
    saveSlotBtn.addEventListener('click', async () => {
      const slotId = slotNumberEl.value;
      const payload = {
        vehicle: slotVehicleEl.value.trim() || '',
        unit: slotUnitEl.value.trim() || '',
        eta: slotETAEl.value || '',
        etd: slotETDEl.value || ''
      };
      const applyToResponses = (document.getElementById('applyToRegistration') && document.getElementById('applyToRegistration').checked) || false;
      await saveSlot(slotId, payload, applyToResponses);
      closeModal(modal);
    });
  }
  if (clearSlotBtn) {
    clearSlotBtn.addEventListener('click', async () => {
      const slotId = slotNumberEl.value;
      await clearSlot(slotId);
      closeModal(modal);
    });
  }
  if (parkingSaveAll) {
    parkingSaveAll.addEventListener('click', async () => {
      await saveParkingMeta();
    });
  }

  // nav: activate parking page
  if (navParking) {
    navParking.addEventListener('click', ()=> {
      try { setSelectedNav(navParking); } catch(e) {}
      console.info('[navParking] clicked');
      document.getElementById('pageSummary').style.display = 'none';
      document.getElementById('pageCheckedIn').style.display = 'none';
      pageParking.style.display = '';

      navSummary.classList.remove('active');
      navCheckedIn.classList.remove('active');
      navParking.classList.add('active');

      // KPIs are only shown on 'Senarai pendaftaran'
      try { kpiWrap.style.display = 'none'; } catch(e) {}

      const ds = getParkingDate();
      // hide per-page summary/checked-in date controls since we're on parking view
      try { if (summaryDateWrap) summaryDateWrap.style.display = 'none'; if (checkedInDateWrap) checkedInDateWrap.style.display = 'none'; } catch(e) {}
      console.info('[navParking] loading parking for date', ds);
      // unsubscribe summary/checked-in snapshot while viewing parking to avoid unnecessary reads
      try { if (typeof window.__RESPONSES_UNSUB === 'function') { window.__RESPONSES_UNSUB(); window.__RESPONSES_UNSUB = null; window.__RESPONSES_DATE = null; } } catch(e) { /* ignore */ }
      setParkingDate(ds);
      // hide the old static parking card (clean the page for calendar + lot list)
      try {
        const staticCard = document.getElementById('pageParking').querySelector('.card.card-tight');
        if (staticCard) staticCard.style.display = 'none';
      } catch (e) { /* ignore */ }
      // load parking slots then render week calendar + summary
      loadParkingForDate(ds).then(()=>{
        try { console.info('[navParking] renderParkingWeekCalendar after load'); renderParkingWeekCalendar(ds); } catch(e){ console.warn('[navParking] calendar render failed', e); }
        if (typeof renderParkingLotSummary === 'function') { console.info('[navParking] scheduling renderParkingLotSummary'); setTimeout(()=>renderParkingLotSummary(ds), 100); }
      }).catch(err=>{ console.warn('[navParking] loadParkingForDate error', err); });
    });
  }

  // close modal handlers
  [closeParkingModal, cancelSlotBtn].forEach(b => b && b.addEventListener('click', ()=> { closeModal(modal); }));

  // expose loader for external calls (used when filterDate changes)
  window.loadParkingForDate = loadParkingForDate;

  // ensure we unsubscribe snapshot listeners when the page unloads
  try { window.addEventListener('beforeunload', ()=>{ if (typeof window.__RESPONSES_UNSUB === 'function') { try { window.__RESPONSES_UNSUB(); } catch(e){} window.__RESPONSES_UNSUB = null; window.__RESPONSES_DATE = null; } if (timeTicker) { try { clearInterval(timeTicker); } catch(e){} timeTicker = null; } }); } catch(e) { /* ignore */ }

  // Apply slot update to matching responses for the same date (manual-confirmation flow)
  async function applySlotToResponses(dateKey, slotId, payload){
    if (!dateKey) return { matched: 0, updated: 0 };
    try {
      const from = new Date(dateKey + 'T00:00:00');
      const to = new Date(from); to.setDate(to.getDate()+1);

      const colRef = collection(window.__FIRESTORE, 'responses');
      let rows = [];
      // reuse cached rows for this date when available
      if (responseCache.date === dateKey && Array.isArray(responseCache.rows) && responseCache.rows.length) {
        rows = responseCache.rows;
      } else {
        const q = query(colRef, where('eta','>=', Timestamp.fromDate(from)), where('eta','<', Timestamp.fromDate(to)), orderBy('eta','asc'));
        const snap = await getDocs(q);
        snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
        // cache for reuse
        responseCache.date = dateKey;
        responseCache.rows = rows;
      }

      // find matches — match by vehicleNo or vehicleNumbers array or hostUnit
      const needle = String(payload.vehicle || '').trim().toLowerCase();
      const matches = rows.filter(r => {
        try{
          if (!needle) return false;
          if (r.vehicleNo && String(r.vehicleNo).trim().toLowerCase() === needle) return true;
          if (Array.isArray(r.vehicleNumbers) && r.vehicleNumbers.map(x=>String(x).toLowerCase()).includes(needle)) return true;
          if (r.hostUnit && String(r.hostUnit).trim().toLowerCase() === String(payload.unit || '').trim().toLowerCase()) return true;
          return false;
        } catch(e){ return false; }
      });

      if (!matches.length) {
        return { matched: 0, updated: 0 };
      }

      // if multiple matches, confirm with the user before updating all
      if (matches.length > 1) {
        const ok = confirm(`Ditemui ${matches.length} pendaftaran yang sepadan. Kemaskini semua?`);
        if (!ok) return { matched: matches.length, updated: 0 };
      }

      // perform batch update (vehicleNo, hostUnit and parkingLot)
      const batch = writeBatch(window.__FIRESTORE);
      matches.forEach(m => {
        const ref = doc(window.__FIRESTORE, 'responses', m.id);
        const upd = { updatedAt: serverTimestamp() };
        if (payload.vehicle) upd.vehicleNo = payload.vehicle;
        if (payload.unit) upd.hostUnit = payload.unit;
        // also set parkingLot to the slot id so registration stays in sync
        upd.parkingLot = slotId;
        batch.update(ref, upd);
      });
      await batch.commit();

      // write audit entry
      try{
        const auditCol = collection(window.__FIRESTORE, 'audit');
        await addDoc(auditCol, { ts: serverTimestamp(), userId: window.__AUTH && window.__AUTH.currentUser ? (window.__AUTH.currentUser.uid || window.__AUTH.currentUser.email) : 'unknown', action: 'apply_slot_to_responses', slotId, date: dateKey, matched: matches.length });
      } catch(e){ console.warn('audit write failed', e); }

      return { matched: matches.length, updated: matches.length };
    } catch(err){ console.error('[parking] applySlotToResponses err', err); throw err; }
  }

  /* ---------- Parking report summary (only include category 'Pelawat') ---------- */
  async function renderParkingLotSummary(dateStr){
    console.info('[parking] renderParkingLotSummary called', dateStr);
    try {
      const ds = dateStr || getParkingDate();
      // record the current parking date and treat this as a user-driven change when a specific date is requested
      parkingCurrentDate = ds;
      filterDateUserChangedParking = true;
      const d = ds.split('-');
      if (d.length !== 3) return;
      const from = new Date(parseInt(d[0],10), parseInt(d[1],10)-1, parseInt(d[2],10), 0,0,0,0);
      const to = new Date(from); to.setDate(to.getDate()+1);

      // try to use cached rows for the date if available
      const colRef = collection(window.__FIRESTORE, 'responses');
      let rows = [];
      if (responseCache.date === ds && Array.isArray(responseCache.rows) && responseCache.rows.length) {
        rows = responseCache.rows;
      } else {
        const q = query(colRef, where('eta','>=', Timestamp.fromDate(from)), where('eta','<', Timestamp.fromDate(to)), orderBy('eta','asc'));
        const snap = await getDocs(q);
        snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
        // cache for reuse
        responseCache.date = ds;
        responseCache.rows = rows;
      }

      // filter only Pelawat category who are staying over (Bermalam)
      const pelawatRows = rows.filter(r => determineCategory(r) === 'Pelawat' && String((r.stayOver || '').toLowerCase()) === 'yes');

      const total = pelawatRows.length;
      const assigned = pelawatRows.filter(r => r.parkingLot && String(r.parkingLot).trim()).length;
      const unassigned = total - assigned;
      console.info('[parking] pelawatRows', total, 'assigned', assigned, 'unassigned', unassigned);

      // build small summary card
      const page = document.getElementById('pageParking');
      if (!page) return;

      let existing = document.getElementById('parkingReportSummary');
      const wrap = existing || document.createElement('div');
      wrap.id = 'parkingReportSummary';
      // add a parking-report class so we can style it like the main registration table
      wrap.className = 'card small parking-report';
      wrap.style.marginBottom = '12px';
      let listHtml = '';
      if (pelawatRows.length) {
        // show a tiny list of unassigned items for quick action
        const sample = pelawatRows.slice(0,6);
        listHtml = '<div style="margin-top:8px">';
        sample.forEach(r => {
          const phone = r.visitorPhone ? escapeHtml(r.visitorPhone) : '-';
          const slot = r.parkingLot ? `<strong>Lot ${escapeHtml(r.parkingLot)}</strong>` : '<em>Belum assigned</em>';
          listHtml += `<div class="small">${escapeHtml(r.visitorName || '-') } — ${escapeHtml(r.hostUnit || '-') } • ${phone} • ${slot}</div>`;
        });
        if (pelawatRows.length > sample.length) listHtml += `<div class="small muted" style="margin-top:6px">+${pelawatRows.length - sample.length} lagi...</div>`;
        listHtml += '</div>';
      } else {
        listHtml = '<div class="small">Tiada rekod pelawat pada tarikh ini.</div>';
      }

      wrap.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap">
          <div style="display:flex;gap:10px;align-items:center">
            <div style="font-weight:700">Laporan Parkir — Pelawat Bermalam</div>
            <div class="small muted">(${formatDateOnly(from)})</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <div class="chip chip-pending">Jumlah: ${total}</div>
            <div class="chip chip-in">Assigned: ${assigned}</div>
            <div class="chip chip-out">Unassigned: ${unassigned}</div>
          </div>
        </div>
        ${listHtml}
      `;

      if (!existing) {
        const header = page.querySelector('.card.card-tight');
        if (header) header.parentNode.insertBefore(wrap, header);
        else page.insertAdjacentElement('afterbegin', wrap);
      }

      // render the weekly parking calendar view (fresh view for Pelawat)
      try { renderParkingWeekCalendar(dateStr || ds); } catch(e){ console.warn('[parking] calendar render failed', e); }
    } catch (err) {
      console.error('[parking] renderParkingLotSummary err', err);
    }
  }

  /* ---------- Weekly calendar view (Pelawat-only) ---------- */
  function dayStart(d){ const x = new Date(d); x.setHours(0,0,0,0); return x; }
  function dayKey(d){ const x = dayStart(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }

  function weekRangeFromDate(dateStr){
    const d = dateStr ? new Date(dateStr) : new Date();
    // find Monday of week (or Sunday start if you prefer). We'll use Monday.
    const day = d.getDay(); // 0=Sun,1=Mon
    const diff = (day === 0 ? -6 : 1) - day; // how many days to subtract to get Monday
    const monday = new Date(d); monday.setDate(d.getDate() + diff); monday.setHours(0,0,0,0);
    const days = [];
    for (let i=0;i<7;i++){ const dd = new Date(monday); dd.setDate(monday.getDate()+i); days.push(dd); }
    return { start: days[0], days };
  }

  async function renderParkingWeekCalendar(dateStr){
    console.info('[parking] renderParkingWeekCalendar called', dateStr);
    try{
      const page = document.getElementById('pageParking');
      if (!page) return;

      const ds = dateStr || getParkingDate();
      // ensure parkingCurrentDate reflects the rendered calendar (user navigation)
      parkingCurrentDate = ds;
      filterDateUserChangedParking = true;
      const wr = weekRangeFromDate(ds);
      const from = new Date(wr.start); const to = new Date(wr.start); to.setDate(to.getDate()+7);

      // Query responses for the week
      const weekKey = isoDateString(wr.start);
      const col = collection(window.__FIRESTORE, 'responses');
      // reuse cached week rows when possible
      let rows = weekResponseCache[weekKey];
      if (!Array.isArray(rows)) {
        const q = query(col, where('eta','>=', Timestamp.fromDate(from)), where('eta','<', Timestamp.fromDate(to)), orderBy('eta','asc'));
        const snap = await getDocs(q);
        rows = [];
        snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
        weekResponseCache[weekKey] = rows;
      }

      // Only Pelawat category AND staying over (Bermalam)
      const pelawat = rows.filter(r => determineCategory(r) === 'Pelawat' && String((r.stayOver || '').toLowerCase()) === 'yes');

      // Build per-plate counts across the week (count of distinct days a plate appears on)
      // We'll use this to mark plates that appear on multiple days
      const plateDays = {}; // plate -> Set of dayKeys
      pelawat.forEach(r => {
        // gather all plates for this registration
        const plates = new Set();
        if (r.vehicleNo) plates.add(String(r.vehicleNo).trim());
        if (Array.isArray(r.vehicleNumbers)) r.vehicleNumbers.forEach(x => plates.add(String(x).trim()));
        if (typeof r.vehicleNumbers === 'string' && !r.vehicleNo) plates.add(String(r.vehicleNumbers).trim());
        // if none, skip
        plates.forEach(pl => {
          if (!pl) return;
          const key = dayKey(r.eta && r.eta.toDate ? r.eta.toDate() : (r.eta ? new Date(r.eta) : new Date()));
          plateDays[pl] = plateDays[pl] || new Set();
          plateDays[pl].add(key);
        });
      });

      // convert to counts map for quick lookup
      const plateCounts = {};
      Object.keys(plateDays).forEach(p => { plateCounts[p] = plateDays[p].size; });

      // build calendar container
      let calWrap = document.getElementById('parkingWeekCalendar');
      if (!calWrap){ calWrap = document.createElement('div'); calWrap.id = 'parkingWeekCalendar'; calWrap.className = 'card'; calWrap.style.marginTop = '12px'; }
      calWrap.innerHTML = '';

      // helper: stable color mapping per plate (simple hash -> palette)
      const dupPalette = ['#FB7185','#60A5FA','#F59E0B','#34D399','#A78BFA','#F97316','#60A5FA','#FCA5A5','#86EFAC'];
      function colorForPlate(plate) {
        if (!plate) return dupPalette[0];
        let h = 0; for (let i=0;i<plate.length;i++) h = ((h<<5)-h) + plate.charCodeAt(i), h |= 0;
        const idx = Math.abs(h) % dupPalette.length; return dupPalette[idx];
      }

      const header = document.createElement('div');
      header.style.display = 'flex'; header.style.justifyContent='space-between'; header.style.alignItems='center'; header.style.gap='8px';
      // left: title + prev/next controls, right: week range
      const left = document.createElement('div'); left.style.display='flex'; left.style.alignItems='center'; left.style.gap='8px';
      const title = document.createElement('div'); title.style.fontWeight = '700'; title.textContent = 'Kalendar Mingguan Parkir — Pelawat Bermalam';
      const navWrap = document.createElement('div'); navWrap.className = 'pw-week-nav';
      const prevBtn = document.createElement('button'); prevBtn.type='button'; prevBtn.className='btn-ghost'; prevBtn.textContent = '‹'; prevBtn.title = 'Minggu sebelumnya';
      const nextBtn = document.createElement('button'); nextBtn.type='button'; nextBtn.className='btn-ghost'; nextBtn.textContent = '›'; nextBtn.title = 'Minggu seterusnya';
      navWrap.appendChild(prevBtn); navWrap.appendChild(nextBtn);
      left.appendChild(title); left.appendChild(navWrap);
      const right = document.createElement('div'); right.className = 'small muted'; right.textContent = `Minggu bermula ${formatDateOnly(wr.days[0])} — ${formatDateOnly(wr.days[6])}`;
      header.appendChild(left); header.appendChild(right);
      // wire navigation
      prevBtn.addEventListener('click', ()=>{
        try{
          const base = new Date(wr.start); base.setDate(base.getDate() - 7);
          renderParkingWeekCalendar(isoDateString(base));
        } catch(e){ console.warn('[parking] prev week failed', e); }
      });
      nextBtn.addEventListener('click', ()=>{
        try{
          const base = new Date(wr.start); base.setDate(base.getDate() + 7);
          renderParkingWeekCalendar(isoDateString(base));
        } catch(e){ console.warn('[parking] next week failed', e); }
      });
      calWrap.appendChild(header);

      // Render a simplified 2-column weekly table (Date | Unit + Vehicle) for Pelawat only
      const dayKeys = wr.days.map(dayKey);

      const table = document.createElement('table');
      table.className = 'parking-week-table';
      table.style.width = '100%';
      // No table column headers (we display combined cards per date)
      const tbody = document.createElement('tbody');
      // Build rows per day (2-column: Date | Vehicle + Unit)
      dayKeys.forEach(k => {
        const theDate = new Date(k);
        const tr = document.createElement('tr');
        const tdDate = document.createElement('td'); tdDate.className = 'pw-date-cell';
        const tdItems = document.createElement('td'); tdItems.className = 'pw-items-cell';
        // find rows where ETA..ETD includes this date
        const items = pelawat.filter(r => {
          try{
            const eta = r.eta && r.eta.toDate ? r.eta.toDate() : (r.eta ? new Date(r.eta) : null);
            const etd = r.etd && r.etd.toDate ? r.etd.toDate() : (r.etd ? new Date(r.etd) : null);
            if (!eta) return false;
            const s = dayStart(eta); const e = etd ? dayStart(etd) : s;
            const dd = dayStart(k);
            return s.getTime() <= dd.getTime() && dd.getTime() <= e.getTime();
          } catch(e){ return false; }
        });

        // header with date information (left column)
        const headerEl = document.createElement('div'); headerEl.className = 'pw-day-header';
        const dayLong = theDate.toLocaleDateString(undefined, { weekday: 'long' });
        const malayDays = ['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];
        const malay = malayDays[theDate.getDay()];
        const dd = String(theDate.getDate()).padStart(2,'0');
        const mm = String(theDate.getMonth()+1).padStart(2,'0');
        const yy = theDate.getFullYear();
        headerEl.innerHTML = `<div style="font-weight:700">${dayLong} (${malay})</div><div class="small">${dd}/${mm}/${yy}</div>`;
        tdDate.appendChild(headerEl);

        // total vehicle count for this day (account for arrays / strings)
        const totalVehicles = items.reduce((acc, rr) => {
          let cnt = 0;
          if (rr.vehicleNo) cnt++;
          if (Array.isArray(rr.vehicleNumbers)) cnt += rr.vehicleNumbers.length;
          else if (typeof rr.vehicleNumbers === 'string' && !rr.vehicleNo) cnt++;
          return acc + cnt;
        }, 0);

        if (!items.length) {
          const empty = document.createElement('div'); empty.className = 'small muted'; empty.textContent = 'Tiada pelawat Checked In'; tdItems.appendChild(empty);
        } else {
          const list = document.createElement('div'); list.className = 'pw-vehicle-list';
          // if more than 2 vehicle items, use a 2-column grid
          if (totalVehicles > 2) list.classList.add('multi-cols');
          // show all vehicle numbers (no limit); support vehicleNo and vehicleNumbers (array or string)
          // Collect vehicle+unit entries and dedupe exact pairs per day
          const pairs = [];
          items.forEach(r => {
            const rawNums = [];
            if (r.vehicleNo) rawNums.push(String(r.vehicleNo));
            if (Array.isArray(r.vehicleNumbers)) rawNums.push(...r.vehicleNumbers.map(x => String(x)));
            if (typeof r.vehicleNumbers === 'string' && !r.vehicleNo) rawNums.push(String(r.vehicleNumbers));
            rawNums.forEach(num => {
              const plate = String(num || '').trim();
              if (!plate) return;
              const unit = r.hostUnit ? String(r.hostUnit).trim() : '';
              pairs.push({ plate, unit, id: r.id });
            });
          });

          // dedupe by plate + unit (so same plate at different units is kept, exact duplicates removed)
          const unique = [];
          const seen = new Set();
          pairs.forEach(p => {
            const key = `${p.plate}||${p.unit}`;
            if (!seen.has(key)) { seen.add(key); unique.push(p); }
          });

          unique.forEach(r => {
            const item = document.createElement('div'); item.className = 'pw-vehicle-item';
            const unit = r.unit ? ` — ${r.unit}` : '';
            // if plate appears on more than one day this week, mark it
            const count = plateCounts[r.plate] || 0;
            item.textContent = `${r.plate}${unit}`;
            if (count > 1) {
              item.classList.add('pw-vehicle-duplicate');
              item.setAttribute('data-dup-count', String(count));
              // store plate on element for later color mapping
              item.setAttribute('data-plate', r.plate);
              // assign consistent color for this plate
              const pcolor = colorForPlate(r.plate);
              try { item.style.setProperty('--dup-color', pcolor); } catch(e) {}
              // add small icon for duplication visibility
              const icon = document.createElement('span'); icon.className = 'dup-icon'; icon.textContent = '🔁'; icon.setAttribute('aria-hidden','true');
              item.insertBefore(icon, item.firstChild);
            }
            // attempt to open matching response id if available
            item.addEventListener('click', ()=>{ try{ const id = r.id; if (id) openEditModalFor && typeof openEditModalFor === 'function' ? openEditModalFor(id) : toast('Buka butiran pendaftaran (fungsi tidak tersedia)', false); } catch(e) { console.warn(e); } });
            list.appendChild(item);
          });
          tdItems.appendChild(list);
        }
        // append two columns
        tr.appendChild(tdDate);
        tr.appendChild(tdItems);
        tbody.appendChild(tr);
      });

      table.appendChild(tbody);
      calWrap.appendChild(table);

      // insert calendar after summary or top of page
      const existingCal = document.getElementById('parkingWeekCalendar');
      if (!existingCal) {
        const header = page.querySelector('.card.card-tight');
        if (header) header.parentNode.insertBefore(calWrap, header.nextSibling);
        else page.appendChild(calWrap);
      }

    } catch(err){ console.error('[parking] renderParkingWeekCalendar err', err); }
  }

  /* ---------- Assign Lot transaction helpers ---------- */

  // helper: get yyyy-mm-dd from Timestamp or Date/string
  function dateKeyFromEta(eta) {
    if (!eta) return null;
    let d;
    if (eta.toDate) d = eta.toDate();
    else if (typeof eta === 'string') d = new Date(eta);
    else d = new Date(eta);
    if (isNaN(d.getTime())) return null;
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  /**
   * Assign lot atomically using Firestore transaction.
   * Ensures no two responses get same lot for same date.
   */
  async function assignLotTransaction(responseId, lotId) {
    if (!responseId || !lotId) throw new Error('responseId dan lotId diperlukan');

    const responsesCol = collection(window.__FIRESTORE, 'responses');
    const respRef = doc(window.__FIRESTORE, 'responses', responseId);
    const auditCol = collection(window.__FIRESTORE, 'audit');

    try {
      const auditPayload = await runTransaction(window.__FIRESTORE, async (tx) => {
        // read response
        const respSnap = await tx.get(respRef);
        if (!respSnap.exists()) throw new Error('Rekod pendaftaran tidak ditemui');

        const respData = respSnap.data();
        const eta = respData.eta;
        const dateKey = dateKeyFromEta(eta);
        if (!dateKey) throw new Error('Tarikh masuk tidak sah pada rekod ini');

        // build range for that date
        const from = new Date(dateKey + 'T00:00:00');
        const to = new Date(from); to.setDate(to.getDate() + 1);

        // query other responses for same date with same lot
        const colRef = collection(window.__FIRESTORE, 'responses');
        const q = query(
          colRef,
          where('eta', '>=', Timestamp.fromDate(from)),
          where('eta', '<', Timestamp.fromDate(to)),
          where('parkingLot', '==', lotId)
        );

        const qSnap = await getDocs(q);
        const conflict = qSnap.docs.some(d => d.id !== responseId);
        if (conflict) throw new Error(`Lot ${lotId} sudah diambil untuk tarikh ${dateKey}`);

        // perform update
        const assignedBy = window.__AUTH && window.__AUTH.currentUser ? (window.__AUTH.currentUser.uid || window.__AUTH.currentUser.email) : 'unknown';
        tx.update(respRef, {
          parkingLot: lotId,
          assignedBy,
          assignedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // prepare audit payload to write after tx
        return {
          ts: serverTimestamp(),
          userId: assignedBy,
          rowId: responseId,
          action: 'assign_parking_lot',
          details: {
            lot: lotId,
            eta: dateKey,
            hostUnit: respData.hostUnit || null,
            visitorName: respData.visitorName || null
          }
        };
      });

      // write audit after successful transaction
      try {
        await addDoc(auditCol, auditPayload);
      } catch (ae) {
        console.error('Gagal tulis audit selepas assign', ae);
      }
    } catch (err) {
      console.error('[assignLot] err', err);
      throw err;
    }
  }

  // UI handler wrapper
  async function onAssignButtonClicked(responseId, selectedLotId) {
    try {
      // optional: disable UI
      await assignLotTransaction(responseId, selectedLotId);
      toast(`Lot ${selectedLotId} berjaya diassign`);
      // update cache to reflect assigned lot immediately (snapshot will also sync)
      if (responseCache.date && Array.isArray(responseCache.rows)) {
        const idx = responseCache.rows.findIndex(r => r.id === responseId);
        if (idx !== -1) {
          responseCache.rows[idx] = Object.assign({}, responseCache.rows[idx], { parkingLot: selectedLotId, assignedAt: new Date() });
          renderList(responseCache.rows, listAreaSummary, false);
          renderCheckedInList(responseCache.rows.filter(r => r.status === 'Checked In'));
        }
      }
    } catch (err) {
      const msg = err && err.message ? err.message : 'Gagal assign lot';
      toast(`Gagal assign lot: ${msg}`);
    } finally {
      // optional: re-enable UI
    }
  }

  // expose assign function for UI usage
  window.assignLotTransaction = assignLotTransaction;
  window.onAssignButtonClicked = onAssignButtonClicked;

})();
