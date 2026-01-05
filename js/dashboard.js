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

// Arrears helpers: determine category and free days
function computeArrearsCategory(amount){ if (typeof amount !== 'number' || isNaN(amount)) return null; if (amount <= 1) return 1; if (amount <= 400) return 2; return 3; }
function freeDaysForCategory(cat){ if (cat === 1) return 3; if (cat === 2) return 1; return 0; }

// Compute charge based on category, eta and etd. Returns { total, breakdownLines }
function computeChargeForDates(cat, eta, etd){ try {
  if (![2,3].includes(cat)) return { total: 0, breakdown: [] };
  const toDateOnly = (d) => { if (!d) return null; try { const dt = (d && d.toDate) ? d.toDate() : (d instanceof Date ? d : new Date(d)); if (!dt || isNaN(dt.getTime())) return null; return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(),0,0,0,0); } catch(e){ return null; } };
  const start = toDateOnly(eta);
  const end = toDateOnly(etd) || start;
  if (!start || !end || end.getTime() < start.getTime()) return { total: 0, breakdown: [] };
  const dayMs = 24*60*60*1000;
  const totalDays = Math.floor((end.getTime() - start.getTime())/dayMs) + 1;
  const free = Math.max(0, Math.min(freeDaysForCategory(cat), totalDays));
  const chargedDays = Math.max(0, totalDays - free);
  const rateMap = { 2: 5, 3: 15 };
  const rate = rateMap[cat] || 0;
  const total = chargedDays * rate;
  const lines = [];
  for (let i=0;i<totalDays;i++){ const d = new Date(start.getTime()); d.setDate(d.getDate() + i); const dd = String(d.getDate()).padStart(2,'0'); const mm = String(d.getMonth()+1).padStart(2,'0'); const yyyy = d.getFullYear(); const label = (i < free) ? 'Percuma' : `RM ${rate.toFixed(2)}`; lines.push(`${dd}/${mm}/${yyyy} = ${label}`); }
  return { total, breakdown: lines };
} catch(e){ return { total:0, breakdown:[] }; } }
function showLoginMsg(el, m, ok=true){ el.textContent = m; el.style.color = ok ? 'green' : 'red'; }
function toast(msg, ok = true, opts = {}){
  // opts.duration ms (default 3000)
  const duration = typeof opts.duration === 'number' ? opts.duration : 3000;
  // ensure container exists
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `msg ${ok ? 'ok' : 'err'} show`;
  t.textContent = msg; // a11y
  t.setAttribute('role','status'); t.setAttribute('aria-live','polite'); t.setAttribute('aria-atomic','true');

  // allow optional close button for errors (improves accessibility)
  if (!ok) {
    const close = document.createElement('button');
    close.className = 'toast-close';
    close.type = 'button';
    close.setAttribute('aria-label','Tutup pemberitahuan');
    close.textContent = '×';
    close.addEventListener('click', ()=>{ if (!t._removed) { t._removed = true; t.classList.add('fade'); setTimeout(()=> t.remove(), 220); } });
    // add as last child (keep message readable)
    t.appendChild(close);
  }

  container.appendChild(t);
  // schedule auto-dismiss
  const hide = ()=>{ if (!t._removed) { t._removed = true; t.classList.add('fade'); setTimeout(()=> t.remove(), 220); } };
  let timer = setTimeout(hide, duration);
  // pause on hover
  t.addEventListener('mouseenter', ()=>{ clearTimeout(timer); });
  t.addEventListener('mouseleave', ()=>{ timer = setTimeout(hide, 1200); });
  return t;
}
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
const summarySearch = document.getElementById('summarySearch');
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
const passdownInput = document.getElementById('passdownInput');
const passdownList = document.getElementById('passdownList');
const passdownSaveBtn = document.getElementById('passdownSaveBtn');
const passdownClearBtn = document.getElementById('passdownClearBtn');
const passdownMeta = document.getElementById('passdownMeta');
const PASSDOWN_KEY = 'bc_passdown_notes_v1';
const PASSDOWN_LIMIT = 14;

// Units cache (unitId -> doc data) used to display unit category fallback
const unitsCache = Object.create(null);
// Flag set when reading units collection fails due to insufficient permissions
let unitsLoadPermissionDenied = false;

function setAdminLoggedIn(val){
  try { sessionStorage.setItem('admin_logged_in', val ? '1' : '0'); } catch(e) {}
  try {
    // Enable/disable admin-only controls
    const enable = !!val;
    const csvImportBtn = document.getElementById('csvImportBtn'); if (csvImportBtn) csvImportBtn.disabled = !enable;
    const csvForceWriteBtn = document.getElementById('csvForceWriteBtn'); if (csvForceWriteBtn) csvForceWriteBtn.disabled = !enable;
    const migrateApplyBtn = document.getElementById('migrateApplyBtn'); if (migrateApplyBtn) migrateApplyBtn.disabled = !enable;
    const saveUnitBtn = document.getElementById('saveUnitBtn'); if (saveUnitBtn) saveUnitBtn.disabled = !enable;
    const unitAddBtn = document.getElementById('unitAddBtn'); if (unitAddBtn) unitAddBtn.disabled = !enable;

    // Also toggle visibility of admin containers/buttons so "Log Keluar" is present when using admin claim
    const adminControls = document.getElementById('adminControls'); if (adminControls) adminControls.style.display = enable ? 'block' : 'none';
    const adminOpenLoginBtn = document.getElementById('adminOpenLoginBtn'); if (adminOpenLoginBtn) adminOpenLoginBtn.style.display = enable ? 'none' : 'inline-block';
    const adminLogoutButton = document.getElementById('adminLogoutBtn'); if (adminLogoutButton) adminLogoutButton.style.display = enable ? 'inline-block' : 'none';
    const sidebarLoginBtn = document.getElementById('sidebarAdminLoginBtn'); if (sidebarLoginBtn) sidebarLoginBtn.style.display = enable ? 'none' : 'inline-block';
    const sidebarLogoutBtn = document.getElementById('sidebarAdminLogoutBtn'); if (sidebarLogoutBtn) sidebarLogoutBtn.style.display = enable ? 'inline-block' : 'none';
    const parkingLogoutBtnEl = document.getElementById('parkingAdminLogoutBtn'); if (parkingLogoutBtnEl) parkingLogoutBtnEl.style.display = enable ? 'inline-block' : 'none';
  } catch(e) { /* ignore */ }
}
function isAdminLoggedIn(){ try { return sessionStorage.getItem('admin_logged_in') === '1'; } catch(e){ return false; } }

function handlePermissionDenied(e, friendlyMsg){
  try {
    const code = e && e.code ? e.code : '';
    if (String(code).toLowerCase().includes('permission-denied') || String(e).toLowerCase().includes('missing or insufficient permissions')) {
      unitsLoadPermissionDenied = true;
      toast(friendlyMsg || 'Kebenaran tidak mencukupi untuk operasi ini. Log masuk sebagai admin atau gunakan skrip admin.', false);
      // set admin login msg (helpful inline hint)
      try { const m = document.getElementById('adminLoginMsg'); if (m) m.textContent = 'Amaran: Tiada kebenaran tulis pada collection units.'; } catch(err){}
      // disable write controls
      try { const csvImportBtn = document.getElementById('csvImportBtn'); if (csvImportBtn) csvImportBtn.disabled = true; } catch(e){}
      try { const csvForceWriteBtn = document.getElementById('csvForceWriteBtn'); if (csvForceWriteBtn) csvForceWriteBtn.disabled = true; } catch(e){}
      try { const migrateApplyBtn = document.getElementById('migrateApplyBtn'); if (migrateApplyBtn) migrateApplyBtn.disabled = true; } catch(e){}
      try { const saveUnitBtn = document.getElementById('saveUnitBtn'); if (saveUnitBtn) saveUnitBtn.disabled = true; } catch(e){}
      try { const unitAddBtn = document.getElementById('unitAddBtn'); if (unitAddBtn) unitAddBtn.disabled = true; } catch(e){}
      return true;
    }
  } catch(err){}
  return false;
}

/* ---------- Passdown notes (sidebar mini notepad) ---------- */
function getSavedPassdownNotes(){
  try {
    const raw = localStorage.getItem(PASSDOWN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) return parsed.slice(0, PASSDOWN_LIMIT);
  } catch(e) { /* ignore */ }
  return [];
}

function persistPassdownNotes(notes){
  try { localStorage.setItem(PASSDOWN_KEY, JSON.stringify(notes.slice(0, PASSDOWN_LIMIT))); } catch(e) { /* ignore */ }
}

function renderPassdownNotes(){
  if (!passdownList) return;
  const notes = getSavedPassdownNotes();
  if (!notes.length) {
    passdownList.innerHTML = '<div class="muted-small">Belum ada nota.</div>';
    if (passdownMeta) passdownMeta.textContent = '';
    return;
  }
  const items = notes.map(n => {
    const ts = n.ts ? new Date(n.ts) : new Date();
    const dateLabel = `${formatDateOnly(ts)} ${ts.toLocaleTimeString()}`;
    const author = escapeHtml(n.author || '');
    const text = escapeHtml(n.text || '');
    const id = n.ts || Math.random();
    return `<div class="passdown-item" data-passdown-ts="${id}">
      <div class="passdown-body">
        <div class="passdown-item-text">${text}</div>
        <div class="passdown-meta">${author ? author + ' • ' : ''}${dateLabel}</div>
      </div>
      <button type="button" class="passdown-pencil" data-passdown-menu="${id}" aria-label="Edit atau padam nota">✏️</button>
      <div class="passdown-actions-inline" data-passdown-actions="${id}">
        <button type="button" class="btn-ghost" data-passdown-edit="${id}">Edit</button>
        <button type="button" class="btn-ghost" data-passdown-delete="${id}">Padam</button>
      </div>
    </div>`;
  }).join('');
  passdownList.innerHTML = items;
  if (passdownMeta) {
    const ts = notes[0].ts ? new Date(notes[0].ts) : new Date();
    passdownMeta.textContent = `Terakhir: ${ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}

function addPassdownNote(){
  if (!passdownInput) return;
  const text = (passdownInput.value || '').trim();
  if (!text) { toast('Nota kosong — sila isi.', false); return; }
  const author = (who && who.textContent) ? who.textContent : 'Tanpa nama';
  const now = Date.now();
  const notes = getSavedPassdownNotes();
  notes.unshift({ text, author, ts: now });
  persistPassdownNotes(notes);
  passdownInput.value = '';
  renderPassdownNotes();
  toast('Nota disimpan');
}

function clearPassdownNotes(){
  persistPassdownNotes([]);
  renderPassdownNotes();
  toast('Nota dikosongkan');
}

function editPassdownNote(ts){
  const notes = getSavedPassdownNotes();
  const idx = notes.findIndex(n => String(n.ts) === String(ts));
  if (idx < 0) return;
  const current = notes[idx];
  const next = prompt('Edit nota', current.text || '');
  if (next === null) return;
  const text = next.trim();
  if (!text) { toast('Nota kosong — tidak disimpan.', false); return; }
  notes[idx] = Object.assign({}, current, { text, ts: Date.now() });
  persistPassdownNotes(notes);
  renderPassdownNotes();
  toast('Nota dikemas kini');
}

function deleteSinglePassdown(ts){
  const notes = getSavedPassdownNotes();
  const filtered = notes.filter(n => String(n.ts) !== String(ts));
  persistPassdownNotes(filtered);
  renderPassdownNotes();
  toast('Nota dibuang');
}

// keep selection hidden when navigating away
document.addEventListener('keydown', (evt)=>{
  if (evt.key === 'Escape') hidePassdownMenus();
});

function hidePassdownMenus(){
  if (!passdownList) return;
  passdownList.querySelectorAll('.passdown-actions-inline').forEach(el => el.classList.remove('open'));
}

function togglePassdownMenu(ts){
  if (!passdownList) return;
  const target = passdownList.querySelector(`[data-passdown-actions="${ts}"]`);
  if (!target) return;
  const isOpen = target.classList.contains('open');
  hidePassdownMenus();
  if (!isOpen) target.classList.add('open');
}

async function loadAllUnitsToCache(){
  try{
    if (!window.__FIRESTORE) return;
    const col = collection(window.__FIRESTORE, 'units');
    const snap = await getDocs(col);
    snap.forEach(d => { unitsCache[d.id] = d.data(); });
    console.info('[units] loaded', Object.keys(unitsCache).length);
  } catch(e) {
    console.warn('[units] cache load failed', e);
    // detect permission-denied and show a friendly hint in the UI
    try {
      const code = e && e.code ? e.code : '';
      if (code === 'permission-denied' || String(e).includes('Missing or insufficient permissions')) {
        unitsLoadPermissionDenied = true;
        toast('Tidak dapat baca units collection — semak Firestore rules (permission-denied)', false);
        try { const m = document.getElementById('adminLoginMsg'); if (m) m.textContent = 'Amaran: Tiada kebenaran baca units collection.'; } catch(e){}
        // disable write controls when permissions are insufficient
        try { const csvImportBtn = document.getElementById('csvImportBtn'); if (csvImportBtn) csvImportBtn.disabled = true; } catch(e){}
        try { const csvForceWriteBtn = document.getElementById('csvForceWriteBtn'); if (csvForceWriteBtn) csvForceWriteBtn.disabled = true; } catch(e){}
        try { const migrateApplyBtn = document.getElementById('migrateApplyBtn'); if (migrateApplyBtn) migrateApplyBtn.disabled = true; } catch(e){}
        try { const saveUnitBtn = document.getElementById('saveUnitBtn'); if (saveUnitBtn) saveUnitBtn.disabled = true; } catch(e){}
        try { const unitAddBtn = document.getElementById('unitAddBtn'); if (unitAddBtn) unitAddBtn.disabled = true; } catch(e){}
      }
    } catch(e) {}
  }
}

const navSummary = document.getElementById('navSummary');
const navCheckedIn = document.getElementById('navCheckedIn');
const navParking = document.getElementById('navParking');
const navUnitAdmin = document.getElementById('navUnitAdmin');
const navUnitContacts = document.getElementById('navUnitContacts');
const exportCSVBtn = document.getElementById('exportCSVBtn');
const exportAllCSVBtn = document.getElementById('exportAllCSVBtn');
const parkingSearchInput = document.getElementById('parkingSearch');
const listAreaUnitContacts = document.getElementById('listAreaUnitContacts');
const unitContactsSearch = document.getElementById('unitContactsSearch');
let parkingSearchTimer = null;

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

function filterRowsBySearch(rows, term){
  const q = (term || '').trim().toLowerCase();
  if (!q) return rows;
  return (rows || []).filter(r => {
    const plates = [];
    if (r.vehicleNo) plates.push(String(r.vehicleNo));
    if (Array.isArray(r.vehicleNumbers)) plates.push(...r.vehicleNumbers.map(String));
    else if (typeof r.vehicleNumbers === 'string') plates.push(String(r.vehicleNumbers));

    const parts = [
      r.visitorName,
      r.hostName,
      r.hostUnit,
      r.visitorPhone,
      r.hostPhone,
      r.category,
      r.status,
      r.entryDetails,
      plates.join(' '),
      r.unitCategory,
    ];
    return parts.some(p => p && String(p).toLowerCase().includes(q));
  });
}

function renderSummaryWithSearch(rows){
  responseCache.rows = rows || [];
  const term = summarySearch ? summarySearch.value : '';
  const filtered = filterRowsBySearch(responseCache.rows, term);
  renderList(filtered, listAreaSummary, false);
}

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
    if (navUnitAdmin && navUnitAdmin.classList.contains('active')) return 'unitadmin';
    if (navUnitContacts && navUnitContacts.classList.contains('active')) return 'unitcontacts';
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
[navSummary, navCheckedIn, navParking, navUnitContacts].forEach(btn => {
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
  if (!window.__AUTH) { showLoginMsg(loginMsg, 'Firebase auth belum tersedia — cuba semula sebentar lagi.', false); return; }
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

    // Load units cache for all signed-in users so arrears/category display is up-to-date
    try { loadAllUnitsToCache().catch(()=>{}); } catch(e) {}

    // Check for custom claim 'admin' and enable admin controls automatically
    try {
      // getIdTokenResult is available on user; it contains claims
      user.getIdTokenResult().then(token => {
        const isAdminClaim = token && token.claims && token.claims.admin === true;
        if (isAdminClaim) {
          setAdminLoggedIn(true);
          try { const c = document.getElementById('adminControls'); if (c) c.style.display = 'block'; } catch(e){}
          try { const openBtn = document.getElementById('adminOpenLoginBtn'); if (openBtn) openBtn.style.display = 'none'; } catch(e){}
          try { const m = document.getElementById('adminLoginMsg'); if (m) m.textContent = 'Log masuk sebagai admin (claim).'; } catch(e){}
        }
      }).catch(err => { /* ignore token errors */ });
    } catch(e) { /* ignore */ }


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
  // Merge Firestore-backed units cache with the static canonical list (window.UNITS_STATIC)
  const staticList = Array.isArray(window.UNITS_STATIC) ? window.UNITS_STATIC.slice() : [];
  // build canonical ordered list: preserve static order first, then append any keys missing from static list
  const cacheKeys = Object.keys(unitsCache);
  const combined = staticList.concat(cacheKeys.filter(k => !staticList.includes(k))).sort((a,b) => {
    // Keep the static ordering if both indices exist there, otherwise alphabetical fallback
    const ia = staticList.indexOf(a), ib = staticList.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b);
  });
  if (!combined.length) { el.innerHTML = '<div class="small">Tiada unit dalam rekod.</div>'; return; }

  function fmtAmount(v){ if (typeof v !== 'number') return null; return 'RM'+Number(v).toFixed(2); }

  let html = '<table><thead><tr><th style="width:56px">No.</th><th>Unit</th><th style="width:220px">Tunggakan</th><th>Kategori Unit</th><th></th></tr></thead><tbody>';
  combined.forEach((unitId, idx) => {
    const u = unitsCache[unitId] || {};
    const amount = (typeof u.arrearsAmount === 'number') ? u.arrearsAmount : null;
    const arrearsDisplay = (u.arrears === true) ? `Ya${amount !== null ? ' ('+fmtAmount(amount)+')' : ''}` : `Tiada${amount !== null ? ' ('+fmtAmount(amount)+')' : ''}`;
    const category = u.category || '—';
    html += `<tr><td>${idx+1}</td><td>${escapeHtml(unitId)}</td><td>${escapeHtml(arrearsDisplay)}</td><td>${escapeHtml(category)}</td><td><div style="display:flex;gap:6px"><button class="btn-ghost small" data-unit-edit="${escapeHtml(unitId)}">Edit</button><button class="btn-ghost small" data-unit-view="${escapeHtml(unitId)}">View</button></div></td></tr>`;
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
  // wire view buttons
  el.querySelectorAll('button[data-unit-view]').forEach(b => {
    b.addEventListener('click', (ev) => {
      const id = b.getAttribute('data-unit-view');
      const rawEl = document.getElementById('unitRawArea');
      if (!rawEl) return;
      const u = unitsCache[id];
      rawEl.style.display = 'block';
      rawEl.innerHTML = `<div style="font-weight:700;margin-bottom:6px">Raw document: ${escapeHtml(id)}</div><pre style="white-space:pre-wrap;word-break:break-word">${escapeHtml(JSON.stringify(u, null, 2) || '—')}</pre>`;
      // scroll into view
      try { rawEl.scrollIntoView({behavior:'smooth', block:'nearest'}); } catch(e){}
    });
  });
}

// Unit Contacts page: renders a simple searchable list of Unit — Nama Penghuni — Nombor Telefon
function renderUnitContacts(){
  const el = document.getElementById('listAreaUnitContacts');
  if (!el) return;
  const search = (unitContactsSearch && unitContactsSearch.value) ? unitContactsSearch.value.trim().toLowerCase() : '';
  const staticList = Array.isArray(window.UNITS_STATIC) ? window.UNITS_STATIC.slice() : [];
  const keys = new Set([].concat(staticList, Object.keys(unitsCache || {}), (responseCache.rows || []).map(r => r.hostUnit).filter(Boolean)));
  const arr = Array.from(keys).filter(Boolean).sort((a,b) => a.localeCompare(b));
  if (!arr.length) { el.innerHTML = '<div class="small">Tiada unit dalam rekod.</div>'; return; }
  let html = '<table class="table"><thead><tr><th style="width:56px">No.</th><th>Unit</th><th>Nama Penghuni</th><th>Nombor Telefon</th></tr></thead><tbody>';
  let rowNum = 1;
  arr.forEach((unitId) => {
    const u = unitsCache[unitId] || {};
    const contacts = [];
    const seen = new Set();
    const normPhone = (p) => (p || '').replace(/[^0-9+]/g,'');
    const addContact = (n, p) => {
      const name = (n || '').trim();
      const phone = (p || '').trim();
      if (!name && !phone) return;
      const key = `${name.toLowerCase()}|${normPhone(phone)}`;
      if (seen.has(key)) return;
      seen.add(key);
      contacts.push({ name, phone });
    };

    // Prefer contact fields on unit doc if present (support multiple combos)
    addContact(u.ownerName || u.name || u.hostName, u.ownerPhone || u.phone || u.hostPhone);
    addContact(u.contactName, u.contactPhone);
    addContact(u.tenantName, u.tenantPhone);

    // Fallback: aggregate all registration rows for this unit (not just latest)
    if (Array.isArray(responseCache.rows)) {
      responseCache.rows
        .filter(r => String(r.hostUnit || '').trim().toLowerCase() === String(unitId).trim().toLowerCase() && (r.hostName || r.hostPhone))
        .forEach(r => addContact(r.hostName, r.hostPhone));
    }

    // Skip units that do not match search across any contact tokens
    const tokens = [String(unitId).toLowerCase()].concat(contacts.flatMap(c => [c.name, c.phone].filter(Boolean).map(v => String(v).toLowerCase())));
    const matches = !search || tokens.some(t => t.includes(search));
    if (!matches) return;

    const namesHtml = contacts.length ? contacts.map(c => `<div class="small">${escapeHtml(c.name || '-')}</div>`).join('') : '<div class="small muted">-</div>';
    const phonesHtml = contacts.length ? contacts.map(c => {
      if (!c.phone) return '<div class="small">-</div>';
      const href = normalizePhoneForWhatsapp(c.phone);
      return `<div class="small"><a class="tel-link" href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(c.phone)}</a></div>`;
    }).join('') : '<div class="small muted">-</div>';

    html += `<tr><td>${rowNum++}</td><td>${escapeHtml(unitId)}</td><td>${namesHtml}</td><td>${phonesHtml}</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

if (unitContactsSearch) unitContactsSearch.addEventListener('input', ()=>{ renderUnitContacts(); });

async function adminLogin(password){
  if (!adminPasswordIsCorrect(password)) return false;
  setAdminLoggedIn(true);
  try { const a = document.getElementById('adminLoginWrap'); if (a) a.style.display = 'none'; } catch(e) {}
  try { const modal = document.getElementById('adminLoginModal'); if (modal) { modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); } } catch(e) {}
  try { const openBtn = document.getElementById('adminOpenLoginBtn'); if (openBtn) openBtn.style.display = 'none'; } catch(e) {}
  try { const p = document.getElementById('parkingLoginPage'); if (p) p.style.display = 'none'; } catch(e) {}
  try { const c = document.getElementById('adminControls'); if (c) c.style.display = 'block'; } catch(e) {}
  try { const l = document.getElementById('adminLogoutBtn'); if (l) l.style.display = 'inline-block'; } catch(e) {}
  try { const m = document.getElementById('adminLoginMsg'); if (m) m.textContent = 'Log masuk sebagai admin.'; } catch(e) {}
  try { const pm = document.getElementById('parkingAdminMsg'); if (pm) pm.textContent = ''; } catch(e) {}
  // load units into cache
  await loadAllUnitsToCache();
  renderUnitsList();
  return true;
}

function adminLogout(){
  setAdminLoggedIn(false);
  try { const a = document.getElementById('adminLoginWrap'); if (a) a.style.display = 'block'; } catch(e) {}
  try { const modal = document.getElementById('adminLoginModal'); if (modal) { modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); } } catch(e) {}
  try { const openBtn = document.getElementById('adminOpenLoginBtn'); if (openBtn) openBtn.style.display = 'inline-block'; } catch(e) {}
  try { const p = document.getElementById('parkingLoginPage'); if (p) p.style.display = 'block'; } catch(e) {}
  try { const c = document.getElementById('adminControls'); if (c) c.style.display = 'none'; } catch(e) {}
  try { const l = document.getElementById('adminLogoutBtn'); if (l) l.style.display = 'none'; } catch(e) {}
  try { const m = document.getElementById('adminLoginMsg'); if (m) m.textContent = ''; } catch(e) {}
  try { const pm = document.getElementById('adminModalPassword'); if (pm) pm.value = ''; } catch(e) {}
  try { const pm = document.getElementById('parkingAdminMsg'); if (pm) pm.textContent = ''; } catch(e) {}
  // also sign out firebase auth if present (best-effort)
  try { if (window.__AUTH) signOut(window.__AUTH).catch(()=>{}); } catch(e) {}
}

// CSV parsing (RFC4180-friendly-ish) — returns array of objects using header row
// This parser normalizes header names and maps common localised headers
// -> Unit / unit / unitId  => 'unit'
// -> Amaun / amount / arrearsAmount => 'arrearsAmount'
// It also supports quoted fields containing commas and will trim whitespace.
function parseCSV(text){
  if (!text || !text.trim()) return [];
  // split lines, support both CRLF and LF
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim().length);

  // helper: parse a single CSV line into fields handling quotes
  function parseLine(line){
    const fields = [];
    let cur = '';
    let inQuotes = false;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (ch === '"'){
        // If double-quote inside quoted field, and next char is quote -> escaped quote
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; continue; }
        inQuotes = !inQuotes; continue;
      }
      if (ch === ',' && !inQuotes){
        fields.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    fields.push(cur);
    return fields.map(f => f.trim());
  }

  // normalize header token to simplified key
  function normalizeHeader(h){
    if (!h) return '';
    const s = String(h).trim().toLowerCase();
    const compact = s.replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
    if (['unit','unitid','units','rumah'].includes(compact)) return 'unit';
    if (['amaun','amount','arrearsamount','amt','jumlah'].includes(compact)) return 'arrearsAmount';
    if (['category','kategori','kategoriunit'].includes(compact)) return 'category';
    if (['arrears','tunggakan'].includes(compact)) return 'arrears';
    // fallback to original trimmed header
    return h.trim();
  }

  const headerFields = parseLine(lines[0]).map(normalizeHeader);
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const parts = parseLine(lines[i]);
    if (!parts.length) continue;
    // if header wasn't meaningful (eg first row of file was data like {"A-10-1":"981.60"})
    // we attempt to detect two-column simple files where first col looks like a unit id
    let obj = {};
    if (headerFields.length === 0 || headerFields.every(h => !h)){
      // fallback: assume first col = unit, second col = arrearsAmount
      if (parts.length >= 2) obj.unit = parts[0], obj.arrearsAmount = parts[1];
      else continue;
    } else {
      for (let j=0;j<headerFields.length;j++){
        const key = headerFields[j] || (`col${j}`);
        obj[key] = parts[j] || '';
      }
    }

    // coerce types: arrearsAmount -> number when possible
    if (obj.arrearsAmount !== undefined && obj.arrearsAmount !== null && obj.arrearsAmount !== ''){
      const n = Number(String(obj.arrearsAmount).replace(/[^0-9\-\.]/g,''));
      obj.arrearsAmount = Number.isFinite(n) ? n : null;
    } else {
      obj.arrearsAmount = null;
    }

    // compute boolean arrears if not present: true when arrearsAmount > 0
    if (obj.arrears === undefined || obj.arrears === null || String(obj.arrears).trim() === ''){
      obj.arrears = (typeof obj.arrearsAmount === 'number') ? (obj.arrearsAmount > 0) : false;
    } else {
      // coerce explicit truthy values
      obj.arrears = String(obj.arrears).toLowerCase().trim() === 'true';
    }

    // ensure unit id trimming
    if (obj.unit) obj.unit = String(obj.unit).trim();

    rows.push(obj);
  }
  return rows;
}

async function saveUnitToFirestore(unitId, data){
  if (!window.__FIRESTORE) throw new Error('firestore unavailable');
  const ref = doc(window.__FIRESTORE, 'units', unitId);
  const payload = Object.assign({}, data, { lastUpdatedAt: serverTimestamp(), lastUpdatedBy: who.textContent || 'admin' });
  try {
    await setDoc(ref, payload, { merge: true });
  } catch (e) {
    console.error('saveUnitToFirestore error', e);
    const code = e && e.code ? e.code : '';
    if (String(code).toLowerCase().includes('permission-denied') || String(e).toLowerCase().includes('missing or insufficient permissions')) {
      unitsLoadPermissionDenied = true; toast('Gagal simpan unit — kebenaran tidak mencukupi. Log masuk sebagai admin atau semak Firestore rules.', false);
    }
    throw e;
  }
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
    const amount = (r.arrearsAmount !== undefined && r.arrearsAmount !== null && r.arrearsAmount !== '') ? Number(r.arrearsAmount) : null;
    const data = { category: (r.category || '').trim(), arrears: String(r.arrears || '').toLowerCase() === 'true', arrearsAmount: amount };
    const ref = doc(window.__FIRESTORE, 'units', id);
    currentBatch.set(ref, Object.assign({}, data, { lastUpdatedAt: serverTimestamp(), lastUpdatedBy: who.textContent || 'admin' }), { merge: true });
    count++;
    if (count >= BATCH_SIZE){ batches.push(currentBatch); currentBatch = writeBatch(window.__FIRESTORE); count = 0; batchCount++; }
  }
  if (count > 0) batches.push(currentBatch);
  let success = 0;
  for (let i=0;i<batches.length;i++){
    try { await batches[i].commit(); success++; } catch(e) {
      console.error('batch commit failed', e);
      // If permission denied, set flag and inform user so UI can show fallback behavior
      try {
        if (handlePermissionDenied(e, 'Gagal menulis ke collection units — kebenaran tidak mencukupi. Log masuk sebagai admin atau semak Firestore rules.')) break; // abort further batches
      } catch(err){}
    }
  }
  // try reload cache — if reads are forbidden, update local cache from the imported rows so UI reflects changes
  try {
    await loadAllUnitsToCache();
  } catch(e) {
    console.warn('reload cache failed after import — applying local cache updates', e);
    // copy imported rows into unitsCache so the list shows intended updates
    rows.forEach(r => {
      const id = (r.unitId || r.unit || r.Unit || '').trim();
      if (!id) return;
      const udata = { category: (r.category || '').trim(), arrears: String(r.arrears || '').toLowerCase() === 'true', arrearsAmount: (r.arrearsAmount !== undefined && r.arrearsAmount !== null && r.arrearsAmount !== '') ? Number(r.arrearsAmount) : null, lastUpdatedAt: new Date() };
      unitsCache[id] = Object.assign({}, unitsCache[id] || {}, udata);
    });
  }
  renderUnitsList();
  return { batches: batches.length, committed: success };
}

async function setUnitsImportMeta({ fileName = '', totalRows = 0, source = 'csv' } = {}){
  try {
    if (!window.__FIRESTORE) return;
    const ref = doc(window.__FIRESTORE, 'unitMeta', 'import');
    await setDoc(ref, {
      importedAt: serverTimestamp(),
      fileName,
      totalRows,
      source
    }, { merge: true });
  } catch (e) {
    console.warn('setUnitsImportMeta failed', e);
  }
}

// wire admin UI when dashboard is initialized
document.addEventListener('DOMContentLoaded', ()=>{
  // Passdown notepad
  renderPassdownNotes();
  if (passdownSaveBtn) passdownSaveBtn.addEventListener('click', addPassdownNote);
  if (passdownClearBtn) passdownClearBtn.addEventListener('click', ()=>{ if (confirm('Kosongkan semua nota?')) clearPassdownNotes(); });
  if (passdownInput) passdownInput.addEventListener('keydown', (e)=>{ if (e.ctrlKey && e.key === 'Enter') addPassdownNote(); });
  if (passdownList) {
    passdownList.addEventListener('click', (e)=>{
      const menuBtn = e.target.closest('[data-passdown-menu]');
      if (menuBtn) { e.stopPropagation(); togglePassdownMenu(menuBtn.getAttribute('data-passdown-menu')); return; }
      const editBtn = e.target.closest('[data-passdown-edit]');
      if (editBtn) { e.stopPropagation(); hidePassdownMenus(); editPassdownNote(editBtn.getAttribute('data-passdown-edit')); return; }
      const delBtn = e.target.closest('[data-passdown-delete]');
      if (delBtn) { e.stopPropagation(); hidePassdownMenus(); deleteSinglePassdown(delBtn.getAttribute('data-passdown-delete')); return; }
    });
    document.addEventListener('click', (evt)=>{
      if (!passdownList.contains(evt.target)) hidePassdownMenus();
    });
  }

  // sync passdown notes across tabs/windows (listens to localStorage changes)
  window.addEventListener('storage', (e)=>{
    if (e.key === PASSDOWN_KEY) renderPassdownNotes();
  });

  const loginBtnAdmin = document.getElementById('adminLoginBtn');
  const logoutBtnAdmin = document.getElementById('adminLogoutBtn');
  const adminOpenLoginBtn = document.getElementById('adminOpenLoginBtn');
  const adminModal = document.getElementById('adminLoginModal');
  const adminModalLoginBtn = document.getElementById('adminModalLoginBtn');
  const adminModalCancelBtn = document.getElementById('adminModalCancelBtn');
  const adminModalClose = document.getElementById('adminModalClose');
  const adminModalPassword = document.getElementById('adminModalPassword');
  const adminModalMsg = document.getElementById('adminModalMsg');
  const sidebarLoginBtn = document.getElementById('sidebarAdminLoginBtn');
  const sidebarLogoutBtn = document.getElementById('sidebarAdminLogoutBtn');
  const sidebarPwd = document.getElementById('sidebarAdminPassword');
  const sidebarMsg = document.getElementById('sidebarAdminLoginMsg');
  const parkingLoginBtnEl = document.getElementById('parkingAdminLoginBtn');
  const parkingLogoutBtnEl = document.getElementById('parkingAdminLogoutBtn');
  const adminMsg = document.getElementById('adminLoginMsg');
  const passwordEl = document.getElementById('adminPassword');
  const unitSearchEl = document.getElementById('unitSearch');
  const unitAddBtnEl = document.getElementById('unitAddBtn');
  const saveUnitBtn = document.getElementById('saveUnitBtn');
  const cancelUnitBtn = document.getElementById('cancelUnitBtn');
  const csvInput = document.getElementById('csvFileInput');
  const csvPreviewBtn = document.getElementById('csvPreviewBtn');
  const csvImportBtn = document.getElementById('csvImportBtn');
  const csvForceWriteBtn = document.getElementById('csvForceWriteBtn');
  const csvPreviewArea = document.getElementById('csvPreviewArea');
  const migratePreviewBtn = document.getElementById('migratePreviewBtn');
  const migrateApplyBtn = document.getElementById('migrateApplyBtn');
  const migrationPreviewArea = document.getElementById('migrationPreviewArea');
  const csvFileLabel = document.getElementById('csvFileLabel');

  // Load units cache early so arrears/category uses latest data even before admin login
  try { loadAllUnitsToCache().then(()=>{ try { if (getActivePageKey() === 'summary') renderUnitsList(); } catch(e){} }); } catch(e) {}

  // proceed if any admin-login control exists (sidebar, modal, or parking)
  if (!adminOpenLoginBtn && !loginBtnAdmin && !sidebarLoginBtn && !parkingLoginBtnEl) return;

  // restore admin session if present
  if (isAdminLoggedIn()) {
    try { const pLogin = document.getElementById('parkingLoginPage'); if (pLogin) pLogin.style.display = 'none'; } catch(e) {}
    try { const modal = document.getElementById('adminLoginModal'); if (modal) modal.style.display = 'none'; } catch(e) {}
    try { const openBtn = document.getElementById('adminOpenLoginBtn'); if (openBtn) openBtn.style.display = 'none'; } catch(e) {}
    try { const c = document.getElementById('adminControls'); if (c) c.style.display = 'block'; } catch(e) {}
    try { if (sidebarLoginBtn) sidebarLoginBtn.style.display = 'none'; if (sidebarLogoutBtn) sidebarLogoutBtn.style.display = 'inline-block'; } catch(e) {}
    try { if (parkingLogoutBtnEl) parkingLogoutBtnEl.style.display = 'inline-block'; } catch(e) {}
    try { if (document.getElementById('adminLogoutBtn')) document.getElementById('adminLogoutBtn').style.display = 'inline-block'; } catch(e) {}
    loadAllUnitsToCache().then(()=> renderUnitsList());
  }
  // ensure admin-only controls are disabled if not admin
  try { setAdminLoggedIn(isAdminLoggedIn()); } catch(e) {}

  // wire new modal-login open button (in-page) — opens login modal
  if (adminOpenLoginBtn) {
    adminOpenLoginBtn.addEventListener('click', () => {
      try {
        if (adminModal) { adminModal.classList.remove('hidden'); adminModal.setAttribute('aria-hidden','false'); }
        if (adminModalPassword) adminModalPassword.focus();
      } catch(e){}
    });
  }

  // wire admin logout buttons (modal/sidebar/parking) to clear admin session
  if (logoutBtnAdmin) logoutBtnAdmin.addEventListener('click', ()=>{ try { adminLogout(); toast('Anda telah log keluar dari mod pentadbir.'); } catch(e){} });
  if (sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', ()=>{ try { adminLogout(); toast('Anda telah log keluar dari mod pentadbir.'); } catch(e){} });
  if (parkingLogoutBtnEl) parkingLogoutBtnEl.addEventListener('click', ()=>{ try { adminLogout(); toast('Anda telah log keluar dari mod pentadbir.'); } catch(e){} });

  // modal login handler
  if (adminModalLoginBtn) {
    adminModalLoginBtn.addEventListener('click', async ()=>{
      const ok = await adminLogin(adminModalPassword?.value || '');
      if (!ok) {
        if (adminModalMsg) adminModalMsg.textContent = 'Password salah.';
      } else {
        if (adminModalMsg) adminModalMsg.textContent = '';
        try { if (adminModal) { adminModal.classList.add('hidden'); adminModal.setAttribute('aria-hidden','true'); } } catch(e){}
        try { if (adminOpenLoginBtn) adminOpenLoginBtn.style.display = 'none'; } catch(e){}
      }
    });
  }

  // show chosen CSV file name (nicer UX) and support clicking label to open file dialog
  if (csvInput && csvFileLabel) {
    csvInput.addEventListener('change', ()=>{
      const f = csvInput.files && csvInput.files[0];
      csvFileLabel.textContent = f ? `${f.name}` : 'Choose File';
    });
    // clicking the label should focus the file input (it exists as <label for=> in HTML)
  }

  if (adminModalCancelBtn) adminModalCancelBtn.addEventListener('click', ()=>{ try{ if (adminModal) { adminModal.classList.add('hidden'); adminModal.setAttribute('aria-hidden','true'); } }catch(e){} });
  if (adminModalClose) adminModalClose.addEventListener('click', ()=>{ try{ if (adminModal) { adminModal.classList.add('hidden'); adminModal.setAttribute('aria-hidden','true'); } }catch(e){} });

  // Parking-specific login button (shown when navParking is clicked)
  const parkingLoginBtn = document.getElementById('parkingAdminLoginBtn');
  const parkingPwd = document.getElementById('parkingAdminPassword');
  const parkingMsg = document.getElementById('parkingAdminMsg');
  const parkingLoginPage = document.getElementById('parkingLoginPage');
  if (parkingLoginBtn) {
    parkingLoginBtn.addEventListener('click', async ()=>{
      const ok = await adminLogin(parkingPwd?.value || '');
      if (!ok) {
        if (parkingMsg) parkingMsg.textContent = 'Kata laluan salah';
      } else {
        if (parkingMsg) parkingMsg.textContent = '';
        // hide the login page and ensure parking view shows admin controls
        if (parkingLoginPage) parkingLoginPage.style.display = 'none';
        document.getElementById('adminControls').style.display = 'block';
      }
    });
  }
  const parkingCancelBtn = document.getElementById('parkingAdminCancelBtn');
  if (parkingCancelBtn) parkingCancelBtn.addEventListener('click', ()=>{ if (parkingLoginPage) parkingLoginPage.style.display = 'none'; });

  // parking/logout button inside adminControls
  if (parkingLogoutBtnEl) parkingLogoutBtnEl.addEventListener('click', ()=>{ adminLogout();
    try { if (sidebarLoginBtn) sidebarLoginBtn.style.display = 'inline-block'; if (sidebarLogoutBtn) sidebarLogoutBtn.style.display = 'none'; } catch(e) {}
  });

  // handle adminOpenLoginBtn presence if available — leave as a fallback to open modal
  if (adminOpenLoginBtn && !adminModalLoginBtn && loginBtnAdmin) {
    // legacy handler: keep old behavior (if modal not present)
    adminOpenLoginBtn.addEventListener('click', async ()=>{
      const ok = await adminLogin(passwordEl?.value || '');
      if (!ok) adminMsg.textContent = 'Password salah.';
      else adminMsg.textContent = '';
    });
  }

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
      try {
        const f = csvInput && csvInput.files && csvInput.files[0];
        await setUnitsImportMeta({ fileName: f ? f.name : '', totalRows: (csvPreviewArea._rows || []).length, source: 'csv-import' });
      } catch(e) { console.warn('unit meta update (import) failed', e); }
    } catch(e) { console.error(e); toast('Import gagal', false); }
    finally { document.getElementById('spinner').style.display = 'none'; }
  });

  // Force-write: write all parsed CSV rows to units/* (uses importUnitsFromArray under the hood)
  csvForceWriteBtn?.addEventListener('click', async ()=>{
    if (!csvPreviewArea || !csvPreviewArea._rows || !csvPreviewArea._rows.length) { alert('Sila pratonton fail CSV terlebih dahulu'); return; }
    if (!confirm('Sahkah anda mahu menulis semua baris CSV ke collection units (force)?')) return;
    try {
      document.getElementById('spinner').style.display = 'flex';
      // ensure rows are transformed into expected import shape
      const rows = csvPreviewArea._rows.map(r => {
        return {
          unit: (r.unit || r.unitId || r.Unit || '').trim(),
          category: (r.category || r.Kategori || '').trim(),
          arrears: (r.arrears !== undefined) ? r.arrears : ((typeof r.arrearsAmount === 'number') ? (r.arrearsAmount > 0) : ''),
          arrearsAmount: r.arrearsAmount !== undefined ? r.arrearsAmount : (r.Amaun || r.amount || r.Amaun || '')
        };
      });
      const res = await importUnitsFromArray(rows);
      toast('Tulis CSV selesai: ' + (res.committed || 0) + ' batch(es)');
      try {
        const f = csvInput && csvInput.files && csvInput.files[0];
        await setUnitsImportMeta({ fileName: f ? f.name : '', totalRows: (rows || []).length, source: 'csv-force' });
      } catch(e) { console.warn('unit meta update (force) failed', e); }
    } catch(e) {
      console.error('force write failed', e);
      if (!handlePermissionDenied(e, 'Tulis CSV gagal: kebenaran tidak mencukupi. Log masuk sebagai admin atau gunakan skrip import tempatan -- lihat docs ADMIN_SETUP.md.')) {
        toast('Tulis CSV gagal: ' + (e && e.message ? e.message : String(e)), false);
      }
    } finally { document.getElementById('spinner').style.display = 'none'; }
  });

  // --- Migration: preview & apply ---
  async function findMigrationCandidates(){
    if (!window.__FIRESTORE) throw new Error('firestore unavailable');
    const col = collection(window.__FIRESTORE, 'units');
    const snap = await getDocs(col);
    const rows = [];
    snap.forEach(d => {
      const id = d.id;
      const data = d.data() || {};
      // find possible legacy amount fields
      const keys = Object.keys(data || {});
      const amountKeys = keys.filter(k => /amaun|amount|jumlah|rm|arrearsamount/i.test(k));
      // ignore if already has 'arrearsAmount' and a proper numeric value
      const hasArrearsAmount = (typeof data.arrearsAmount === 'number');
      // choose best candidate value for amount (prefer existing arrearsAmount if numeric)
      let candidateVal = null;
      let usedKey = null;
      if (hasArrearsAmount) { candidateVal = data.arrearsAmount; usedKey = 'arrearsAmount'; }
      else if (amountKeys.length) {
        // prefer keys that exactly match 'amaun' or 'amount' ignoring case, otherwise first match
        const exact = amountKeys.find(k=>/^amaun$/i.test(k) || /^amount$/i.test(k) || /^arrearsamount$/i.test(k) || /^jumlah$/i.test(k));
        usedKey = exact || amountKeys[0];
        const raw = data[usedKey];
        if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
          const n = Number(String(raw).replace(/[^0-9\-\.]/g,''));
          candidateVal = Number.isFinite(n) ? n : null;
        }
      }

      // determine current arrears boolean
      const currentArrears = (data.arrears === true) || (data.arrears === 'true');
      // proposed values
      const proposed = { arrearsAmount: candidateVal, arrears: (typeof candidateVal === 'number') ? (candidateVal > 0) : Boolean(currentArrears) };

      // pick only if there is something to migrate (either candidateVal exists and differs from arrearsAmount OR arrears missing/mismatch)
      const needAmount = (candidateVal !== null) && (data.arrearsAmount !== candidateVal);
      const needArrearsBool = (typeof data.arrears !== 'boolean') || (Boolean(data.arrears) !== Boolean(proposed.arrears));
      if (needAmount || needArrearsBool) {
        rows.push({ id, data, usedKey, proposed });
      }
    });
    return rows;
  }

  migratePreviewBtn?.addEventListener('click', async ()=>{
    try {
      migrationPreviewArea.style.display = 'block';
      migrationPreviewArea.innerHTML = '<div class="small">Mencari dokumen ...</div>';
      let rows = [];
      try { rows = await findMigrationCandidates(); } catch(e) { console.warn('findMigrationCandidates failed, will fallback to CSV if available', e); rows = []; }
      // if no candidates in Firestore, try using the CSV that's currently loaded in the preview (if any)
      if ((!rows || !rows.length) && csvPreviewArea && csvPreviewArea._rows && csvPreviewArea._rows.length) {
        // use CSV rows as migration source
        const csvRows = csvPreviewArea._rows;
        rows = [];
        csvRows.forEach(r => {
          const id = (r.unit || r.unitId || r.Unit || r['Unit'] || r['unitId'] || '').trim();
          if (!id) return;
          // find amount in parsed row fields (parser normalizes 'amaun' -> arrearsAmount)
          let amount = null;
          if (typeof r.arrearsAmount === 'number') amount = r.arrearsAmount;
          else {
            const candidateKey = Object.keys(r).find(k => /amaun|amount|jumlah|rm|arrearsamount/i.test(k));
            if (candidateKey) {
              const raw = r[candidateKey];
              if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
                const n = Number(String(raw).replace(/[^0-9\-\.]/g,''));
                amount = Number.isFinite(n) ? n : null;
              }
            }
          }
          const storeData = unitsCache[id] || {};
          const proposed = { arrearsAmount: amount, arrears: (typeof amount === 'number') ? (amount > 0) : (storeData.arrears === true) };
          // show candidate only if we have something to change or create
          const needAmount = (amount !== null) && (storeData.arrearsAmount !== amount);
          const needArrearsBool = (typeof storeData.arrears !== 'boolean') || (Boolean(storeData.arrears) !== Boolean(proposed.arrears));
          if (needAmount || needArrearsBool) {
            rows.push({ id, data: storeData, usedKey: 'csv', proposed, csvRow: r });
          }
        });
      }
      if (!rows || !rows.length) { migrationPreviewArea.innerHTML = '<div class="small">Tiada dokumen perlukan migrasi.</div>'; return; }
      let html = `<div class="small" style="font-weight:700;margin-bottom:6px">Dijangka dikemaskini ${rows.length} dokumen</div>`;
      html += '<table style="width:100%;border-collapse:collapse"><thead><tr><th>Unit</th><th>Hadapan</th><th>Cadangan</th></tr></thead><tbody>';
      rows.slice(0,200).forEach(r => {
        const oldAmt = r.data.arrearsAmount !== undefined ? r.data.arrearsAmount : (r.usedKey ? r.data[r.usedKey] : '-') ;
        html += `<tr><td style="padding:6px;border-bottom:1px solid var(--input-border)">${escapeHtml(r.id)}</td><td style="padding:6px;border-bottom:1px solid var(--input-border)">amount: ${escapeHtml(String(oldAmt))}<br>arrears:${escapeHtml(String(r.data.arrears||''))}</td><td style="padding:6px;border-bottom:1px solid var(--input-border)">arrearsAmount: ${r.proposed.arrearsAmount === null? '-' : 'RM'+Number(r.proposed.arrearsAmount).toFixed(2)}<br>arrears: ${r.proposed.arrears}</td></tr>`;
      });
      html += '</tbody></table>';
      if (rows.length > 200) html += `<div class="small muted" style="margin-top:6px">Paparan terhad kepada 200 baris — ${rows.length - 200} dokumen lagi</div>`;
      migrationPreviewArea.innerHTML = html;
      migrationPreviewArea._candidates = rows;
    } catch(e) {
      console.error('migratePreview err', e);
      migrationPreviewArea.innerHTML = '<div class="small err">Gagal cari dokumen untuk migrasi.</div>';
    }
  });

  migrateApplyBtn?.addEventListener('click', async ()=>{
    try {
      const rows = migrationPreviewArea && migrationPreviewArea._candidates ? migrationPreviewArea._candidates : null;
      if (!rows || !rows.length) { if (migrationPreviewArea) migrationPreviewArea.innerHTML = '<div class="small">Sila pratonton migrasi terlebih dahulu.</div>'; return; }
      if (!confirm(`Anda pasti mahu jalankan migrasi pada ${rows.length} dokumen? Ini akan mengemaskini medan 'arrearsAmount' dan 'arrears' pada dokumen units/*`)) return;
      document.getElementById('spinner').style.display = 'flex';
      // commit batched updates
      const BATCH_SIZE = 200;
      let batch = writeBatch(window.__FIRESTORE);
      let applied = 0, ops = 0;
      for (let i=0;i<rows.length;i++){
        const r = rows[i];
        const ref = doc(window.__FIRESTORE, 'units', r.id);
        const payload = Object.assign({}, r.proposed, { lastUpdatedAt: serverTimestamp(), lastUpdatedBy: who.textContent || 'admin' });
        batch.set(ref, payload, { merge: true });
        applied++;
        ops++;
        if (ops >= BATCH_SIZE) {
          try {
            await batch.commit();
          } catch(e) {
            console.error('batch commit failed', e);
            if (handlePermissionDenied(e, 'Gagal tulis migrasi: kebenaran tidak mencukupi. Log masuk sebagai admin atau gunakan skrip lokal untuk import.') ) break;
          }
          batch = writeBatch(window.__FIRESTORE); ops = 0;
        }
      }
      if (ops > 0) {
        try {
          await batch.commit();
        } catch(e) {
          console.error('batch commit failed', e);
          if (handlePermissionDenied(e, 'Gagal tulis migrasi: kebenaran tidak mencukupi. Log masuk sebagai admin atau gunakan skrip lokal untuk import.') ) ;
        }
      }
      // reload cache and render; if reload fails due to permissions, update in-memory cache from applied rows
      try {
        await loadAllUnitsToCache();
      } catch(e) {
        console.warn('reload cache failed after migration — applying local cache updates', e);
        // update unitsCache from the applied rows (rows array contains id/proposed)
        rows.forEach(r => {
          try {
            const id = r.id;
            const udata = Object.assign({}, unitsCache[id] || {}, r.proposed || {} , { lastUpdatedAt: new Date() });
            unitsCache[id] = udata;
          } catch(e) {}
        });
      }
      renderUnitsList();
      migrationPreviewArea.innerHTML = `<div class="small">Migrasi selesai — ${applied} dokumen dikemaskini.</div>`;
      toast(`Migrasi selesai — ${applied} dokumen dikemaskini`);
    } catch(e) {
      console.error('migrateApply err', e);
      if (!handlePermissionDenied(e, 'Migrasi gagal: kebenaran tidak mencukupi untuk menulis ke `units`. Sila gunakan skrip admin atau set klaim `admin`.')) {
        toast('Migrasi gagal', false);
      }
    } finally { document.getElementById('spinner').style.display = 'none'; }
  });

  // wire sidebar admin quick-login controls (if present)
  if (sidebarLoginBtn) {
    sidebarLoginBtn.addEventListener('click', async () => {
      const ok = await adminLogin(sidebarPwd?.value || '');
      if (!ok) {
        if (sidebarMsg) sidebarMsg.textContent = 'Password salah.';
      } else {
        if (sidebarMsg) sidebarMsg.textContent = '';
        // reflect login state to sidebar controls
        if (sidebarLoginBtn) sidebarLoginBtn.style.display = 'none';
        if (sidebarLogoutBtn) sidebarLogoutBtn.style.display = 'inline-block';
      }
    });
  }
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', () => {
      adminLogout();
      if (sidebarLoginBtn) sidebarLoginBtn.style.display = 'inline-block';
      if (sidebarLogoutBtn) sidebarLogoutBtn.style.display = 'none';
      if (sidebarMsg) sidebarMsg.textContent = '';
      try { if (sidebarPwd) sidebarPwd.value = ''; } catch(e){}
    });
  }
});

if (reloadBtn) reloadBtn.addEventListener('click', ()=> loadTodayList());
if (summarySearch) summarySearch.addEventListener('input', () => {
  renderSummaryWithSearch(responseCache.rows || []);
});
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

// parking search: debounce and re-render using cached data only (no extra reads)
if (parkingSearchInput) {
  parkingSearchInput.addEventListener('input', ()=>{
    if (parkingSearchTimer) clearTimeout(parkingSearchTimer);
    parkingSearchTimer = setTimeout(()=>{
      try { renderParkingWeekCalendar(getParkingDate(), { useCacheOnly: true }); } catch(e){ console.warn('[parkingSearch] render failed', e); }
    }, 250);
  });
}

// parking date is managed by the parking module's week navigator -> no DOM date input change handler
if (navSummary) navSummary.addEventListener('click', ()=> { showPage('summary'); });
if (navCheckedIn) navCheckedIn.addEventListener('click', ()=> { showPage('checkedin'); });
if (navUnitAdmin) navUnitAdmin.addEventListener('click', ()=> { try { setSelectedNav(navUnitAdmin); } catch(e){}; showPage('unitadmin'); });
if (navUnitContacts) navUnitContacts.addEventListener('click', ()=> { try { setSelectedNav(navUnitContacts); } catch(e){}; showPage('unitcontacts'); renderUnitContacts(); });
if (exportCSVBtn) exportCSVBtn.addEventListener('click', ()=> { exportCSVForToday(); });
if (exportAllCSVBtn) exportAllCSVBtn.addEventListener('click', ()=> { exportCSVAll(); });

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
      renderSummaryWithSearch(rows);
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

            // Supplemental: include any multi-day stays whose ETD >= from and whose ETA < to
            (async () => {
              try {
                const qEt = query(col, where('etd', '>=', Timestamp.fromDate(from)), orderBy('etd','asc'));
                const snap2 = await getDocs(qEt);
                snap2.forEach(d => {
                  // skip if already present
                  if (freshRows.some(fr => fr.id === d.id)) return;
                  const data = d.data() || {};
                  // ensure ETA exists and started before 'to' (i.e., the stay spans into the requested day)
                  const etaVal = data.eta && data.eta.toDate ? data.eta.toDate() : (data.eta ? new Date(data.eta) : null);
                  if (etaVal && etaVal.getTime() < to.getTime()) {
                    freshRows.push({ id: d.id, ...data });
                  }
                });
              } catch (e) {
                // non-fatal — we already have main eta-based rows
                console.warn('[loadListForDateStr] etd supplemental query failed', e);
              }

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
              renderSummaryWithSearch(freshRows);
              renderCheckedInList(freshRows.filter(r => r.status === 'Checked In'));
            })();

          }, err => console.error('[onSnapshot] error', err));
        }
        // let the snapshot handler populate rows — use cached rows for now
      } catch(snapshotErr) {
        console.warn('[loadListForDateStr] snapshot failed, falling back to getDocs', snapshotErr);
        const snap = await getDocs(q);
        snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

        // Supplemental: include any multi-day stays whose ETD >= from and whose ETA < to
        try {
          const qEt = query(col, where('etd', '>=', Timestamp.fromDate(from)), orderBy('etd','asc'));
          const snap2 = await getDocs(qEt);
          snap2.forEach(d => {
            if (rows.some(r => r.id === d.id)) return;
            const data = d.data() || {};
            const etaVal = data.eta && data.eta.toDate ? data.eta.toDate() : (data.eta ? new Date(data.eta) : null);
            if (etaVal && etaVal.getTime() < to.getTime()) {
              rows.push({ id: d.id, ...data });
            }
          });
        } catch (e) {
          console.warn('[loadListForDateStr] etd supplemental fetch failed', e);
        }
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
    renderSummaryWithSearch(rows);
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
        // Prefer live units data for up-to-date arrears/category; fallback to embedded snapshot
        const live = unitsCache[r.hostUnit] || {};
        const uc = (live.category && String(live.category).trim()) ? String(live.category).trim() : ((r.unitCategory && String(r.unitCategory).trim()) ? String(r.unitCategory).trim() : '—');
        const arrears = (typeof live.arrears === 'boolean') ? live.arrears : (r.unitArrears === true);
        const amount = (typeof live.arrearsAmount === 'number') ? live.arrearsAmount : ((typeof r.unitArrearsAmount === 'number') ? r.unitArrearsAmount : null);
        // decide badge label: if unit has arrears, show 'Kategori N' (2 or 3); otherwise show unit category string
        let badgeLabel = uc;
        let badgeClassExtra = '';
        try {
          if (arrears && amount !== null) {
            const aCat = computeArrearsCategory(amount);
            if (aCat) {
              badgeLabel = `Kategori ${aCat}`;
              badgeClassExtra = ` unit-cat-arrears-${aCat}`; // apply color class
            }
          }
        } catch (e) { /* ignore */ }
        // If unit has no explicit category and no arrears, treat as Kategori 1 (green)
        try {
          if ((!uc || uc === '—') && !arrears) {
            badgeLabel = 'Kategori 1';
            badgeClassExtra = ' unit-cat-kategori-1';
          }
        } catch (e) { /* ignore */ }
        const badge = `<span class="unit-cat-badge${badgeClassExtra}">${escapeHtml(String(badgeLabel))}</span>`; 

        // compute payable amount (based on ETA/ETD and arrears category)
        let paymentHtml = '';
        try {
          if (arrears && amount !== null) {
            const visitorCat = (r.category || '').trim();
            if (visitorCat === 'Pelawat' || visitorCat === 'Kontraktor') {
              const cat = computeArrearsCategory(amount);
              const charge = computeChargeForDates(cat, r.eta, r.etd);
              if (charge && typeof charge.total === 'number') {
                paymentHtml = `<div class="small" style="margin-top:4px;color:#b91c1c">Jumlah pembayaran : RM ${charge.total.toFixed(2)}</div>`;
              }
            } else {
              // do not show payment for other visitor categories
              paymentHtml = `<div class="small muted" style="margin-top:4px">—</div>`;
            }
          }
        } catch(e) { /* ignore */ }
        const t = `${badge}${arrears ? ' <div class="small" style="margin-top:4px;color:#b91c1c">Tunggakan'+(amount !== null ? ': RM'+String(amount) : '')+'</div>' : ''}${paymentHtml}`;
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
        renderSummaryWithSearch(rows);
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
        if (i2 !== -1) { responseCache.rows[i2] = originalRow; renderSummaryWithSearch(responseCache.rows); renderCheckedInList(responseCache.rows.filter(r => r.status === 'Checked In')); }
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
      if (i2 !== -1) { responseCache.rows[i2] = originalRow; renderSummaryWithSearch(responseCache.rows); renderCheckedInList(responseCache.rows.filter(r => r.status === 'Checked In')); }
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

/* Export all responses (no date filter) and include repeated-submission counts (dupGroupSize)
   This exports every document in `responses` collection and keeps duplicate docs as-is.
*/
async function exportCSVAll(){
  try {
    if (!window.__FIRESTORE) { toast('Firestore belum tersedia', false); return; }
    const col = collection(window.__FIRESTORE, 'responses');
    const snap = await getDocs(col);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));

    if (!rows.length) { toast('Tiada rekod untuk eksport'); return; }

    // Build fingerprint groups (same logic as UI duplicate detection)
    const fingerprintGroups = {};
    function mkNameKey(name) { if (!name) return ''; return String(name).trim().toLowerCase().replace(/\s+/g,'_').slice(0,64); }
    function normalizePhoneLocal(p) { return (p || '').replace(/[^0-9+]/g,''); }
    function getDateKeyFromEta(eta) {
      if (!eta) return 'null';
      const d = eta && eta.toDate ? eta.toDate() : (typeof eta === 'string' ? new Date(eta) : new Date(eta));
      if (!d || isNaN(d.getTime())) return 'null';
      const yy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
      return `${yy}-${mm}-${dd}`;
    }

    rows.forEach(r => {
      try {
        const fpDate = getDateKeyFromEta(r.eta);
        const hostUnit = (r.hostUnit || '').replace(/\s+/g,'') || 'null';
        const phone = normalizePhoneLocal(r.visitorPhone || '');
        const nameK = mkNameKey(r.visitorName || '');
        const idKey = phone || nameK || 'noid';
        const fp = `${fpDate}|${hostUnit}|${idKey}`;
        fingerprintGroups[fp] = fingerprintGroups[fp] || [];
        fingerprintGroups[fp].push(r.id);
      } catch(e) { /* ignore individual err */ }
    });

    const idDupCounts = {};
    Object.keys(fingerprintGroups).forEach(fp => { const arr = fingerprintGroups[fp] || []; arr.forEach(id => idDupCounts[id] = arr.length); });

    const header = ['id','hostUnit','hostName','hostPhone','visitorName','visitorPhone','category','eta','etd','vehicleNo','vehicleNumbers','status','dupGroupSize','createdAt','updatedAt'];
    const csv = [header.join(',')];
    rows.forEach(r => {
      const created = (r.createdAt && r.createdAt.toDate) ? r.createdAt.toDate().toISOString() : (r.createdAt ? new Date(r.createdAt).toISOString() : '');
      const updated = (r.updatedAt && r.updatedAt.toDate) ? r.updatedAt.toDate().toISOString() : (r.updatedAt ? new Date(r.updatedAt).toISOString() : '');
      const line = [
        r.id || '',
        (r.hostUnit||'').replace(/,/g,''),
        (r.hostName||'').replace(/,/g,''),
        (r.hostPhone||'').replace(/,/g,''),
        (r.visitorName||'').replace(/,/g,''),
        (r.visitorPhone||'').replace(/,/g,''),
        (r.category||'').replace(/,/g,''),
        (r.eta && r.eta.toDate) ? r.eta.toDate().toISOString() : (r.eta ? new Date(r.eta).toISOString() : ''),
        (r.etd && r.etd.toDate) ? r.etd.toDate().toISOString() : (r.etd ? new Date(r.etd).toISOString() : ''),
        (r.vehicleNo||'').replace(/,/g,''),
        (Array.isArray(r.vehicleNumbers) ? r.vehicleNumbers.join(';') : (r.vehicleNumbers||'')).replace(/,/g,''),
        (r.status||'').replace(/,/g,''),
        String(idDupCounts[r.id] || 0),
        created,
        updated
      ];
      csv.push(line.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
    });

    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `responses_all_${isoDateString(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

  } catch (err) {
    console.error('export csv all err', err);
    toast('Gagal eksport CSV. Semak konsol.', false);
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
        renderSummaryWithSearch(responseCache.rows);
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
  else if (key === 'unitadmin') {
    document.getElementById('pageSummary').style.display = 'none';
    document.getElementById('pageCheckedIn').style.display = 'none';
    document.getElementById('pageParking').style.display = 'none';
    // show the main Unit Admin page
    const page = document.getElementById('pageUnitAdmin'); if (page) {
      page.style.display = '';
      // ensure the Unit Admin page is scrolled into view so it is not hidden below other content
      try { page.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e) { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
    // update nav active states
    try { navSummary.classList.remove('active'); navCheckedIn.classList.remove('active'); if (navParking) navParking.classList.remove('active'); if (navUnitAdmin) navUnitAdmin.classList.add('active'); } catch(e){}
    // hide KPIs
    try { kpiWrap.style.display = 'none'; } catch(e) {}
    try { if (summaryDateWrap) summaryDateWrap.style.display = 'none'; if (checkedInDateWrap) checkedInDateWrap.style.display = 'none'; } catch(e) {}
    // ensure snapshot unsubscribed
    try { if (typeof window.__RESPONSES_UNSUB === 'function') { window.__RESPONSES_UNSUB(); window.__RESPONSES_UNSUB = null; window.__RESPONSES_DATE = null; } } catch(e) { /* ignore */ }
  }
  else if (key === 'unitcontacts') {
    document.getElementById('pageSummary').style.display = 'none';
    document.getElementById('pageCheckedIn').style.display = 'none';
    document.getElementById('pageParking').style.display = 'none';
    const page = document.getElementById('pageUnitContacts'); if (page) {
      page.style.display = '';
      try { page.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e) { /* ignore */ }
    }
    try { navSummary.classList.remove('active'); navCheckedIn.classList.remove('active'); if (navParking) navParking.classList.remove('active'); if (navUnitAdmin) navUnitAdmin.classList.remove('active'); if (navUnitContacts) navUnitContacts.classList.add('active'); } catch(e){}
    try { kpiWrap.style.display = 'none'; } catch(e) {}
    try { if (summaryDateWrap) summaryDateWrap.style.display = 'none'; if (checkedInDateWrap) checkedInDateWrap.style.display = 'none'; } catch(e) {}
    try { if (typeof window.__RESPONSES_UNSUB === 'function') { window.__RESPONSES_UNSUB(); window.__RESPONSES_UNSUB = null; window.__RESPONSES_DATE = null; } } catch(e) { /* ignore */ }
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
  // hide Unit Admin page for other pages
  try { const page = document.getElementById('pageUnitAdmin'); if (page && key !== 'unitadmin') page.style.display = 'none'; } catch(e) {}
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
      // Ensure containers exist. Some page variants don't include separate Masuk/Luar
      // slots DOM nodes; fall back to the single compact list area (`parkingListArea`).
      let masukEl = document.getElementById('parkingMasuk');
      let luarEl = document.getElementById('parkingLuar');
      const fallback = document.getElementById('parkingListArea');

      if (!masukEl && !luarEl && !fallback) {
        // No Masuk/Luar containers and no existing parkingListArea — create a fallback
        try {
          const created = document.createElement('div');
          created.id = 'parkingListArea';
          created.style.marginTop = '8px';
          // append into pageParking if available, otherwise fallback to body
          if (pageParking) pageParking.appendChild(created);
          else document.body.appendChild(created);
          // update variables so subsequent code uses the created element
          masukEl = document.getElementById('parkingMasuk');
          luarEl = document.getElementById('parkingLuar');
          // ensure we reference the newly created fallback
          fallback = document.getElementById('parkingListArea');
        } catch (err) {
          console.warn('[parking] could not create fallback slot container', err);
          return;
        }
      }

      // If both Masuk/Luar present use the original layout
      if (masukEl && luarEl) {
        masukEl.innerHTML = '';
        luarEl.innerHTML = '';
        masukSlots.forEach(s => renderSlotRow(s, masukEl));
        luarSlots.forEach(s => renderSlotRow(s, luarEl));
        // also render compact lot list for quick overview
        try { renderParkingLotList(); } catch(e) { /* ignore if not present */ }
        return;
      }

      // Fallback: render all slots into a single compact list area
      try {
        const container = fallback || masukEl || luarEl;
        if (!container) return;
        container.innerHTML = '';
        const single = document.createElement('div'); single.className = 'lot-list';
        const allSlots = masukSlots.concat(luarSlots);
        allSlots.forEach(slotId => renderSlotRow(slotId, single));
        container.appendChild(single);
        // ensure fallback container is visible (some pages initially hide it)
        try { container.style.display = ''; } catch(e) {}
      } catch (err) { console.error('[parking] fallback renderAllSlots err', err); }

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

  // NOTE: the top-of-page compact lot list `#parkingLotListWrap` was removed
  // per user request. We keep renderParkingLotList() safe (it returns early
  // if the wrapper is not present) and rely on either the Masuk/Luar columns
  // or the `#parkingListArea` fallback for slot rendering.

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

      // Create separate containers for Masuk / Luar quick-list + a combined compact list
      const leftGrid = document.createElement('div'); leftGrid.className = 'lot-list left-grid';
      const rightGrid = document.createElement('div'); rightGrid.className = 'lot-list right-grid';
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

      cols.appendChild(leftGrid);
      cols.appendChild(rightGrid);
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
      // ensure Unit Admin page is hidden when switching to Parking view
      try { const p = document.getElementById('pageUnitAdmin'); if (p) p.style.display = 'none'; } catch(e) {}
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
      // if admin not logged in, show dedicated parking login page
      try {
        const pLogin = document.getElementById('parkingLoginPage');
        const controls = document.getElementById('adminControls');
        if (!isAdminLoggedIn()) {
          if (pLogin) pLogin.style.display = 'block';
          if (controls) controls.style.display = 'none';
        } else {
          if (pLogin) pLogin.style.display = 'none';
          if (controls) controls.style.display = 'block';
        }
      } catch(e) { /* ignore */ }
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

  async function renderParkingWeekCalendar(dateStr, opts = {}){
    const useCacheOnly = !!opts.useCacheOnly;
    console.info('[parking] renderParkingWeekCalendar called', dateStr, 'useCacheOnly?', useCacheOnly);
    try{
      const page = document.getElementById('pageParking');
      if (!page) return;

      const ds = dateStr || getParkingDate();
      // ensure parkingCurrentDate reflects the rendered calendar (user navigation)
      parkingCurrentDate = ds;
      filterDateUserChangedParking = true;
      const wr = weekRangeFromDate(ds);
      const from = new Date(wr.start); const to = new Date(wr.start); to.setDate(to.getDate()+7);
      // extend backward by max stay span (3 days) so overlaps from previous week are included
      const fromBuffered = new Date(from); fromBuffered.setDate(fromBuffered.getDate() - 3);

      // Query responses for the week
      const weekKey = isoDateString(wr.start);
      const col = collection(window.__FIRESTORE, 'responses');
      // reuse cached week rows when possible; on cache-only mode, skip fetching when missing
      let rows = weekResponseCache[weekKey];
      if (!Array.isArray(rows)) {
        if (useCacheOnly) {
          rows = [];
        } else {
          const q = query(col, where('eta','>=', Timestamp.fromDate(fromBuffered)), where('eta','<', Timestamp.fromDate(to)), orderBy('eta','asc'));
          const snap = await getDocs(q);
          rows = [];
          snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
          weekResponseCache[weekKey] = rows;
        }
      }

      const searchTerm = (parkingSearchInput?.value || '').trim().toLowerCase();

      // Only Pelawat category AND staying over (Bermalam) AND overlaps the rendered week window
      const pelawatAll = rows.filter(r => {
        if (determineCategory(r) !== 'Pelawat') return false;
        if (String((r.stayOver || '').toLowerCase()) !== 'yes') return false;
        const eta = r.eta && r.eta.toDate ? r.eta.toDate() : (r.eta ? new Date(r.eta) : null);
        const etd = r.etd && r.etd.toDate ? r.etd.toDate() : (r.etd ? new Date(r.etd) : eta);
        if (!eta) return false;
        const end = etd || eta;
        // overlap condition: starts before week end AND ends on/after week start
        return eta.getTime() < to.getTime() && end.getTime() >= from.getTime();
      });

      // Filter by plate/unit search term (case-insensitive). Matches vehicleNo or any vehicleNumbers.
      const pelawat = searchTerm ? pelawatAll.filter(r => {
        const vals = [];
        if (r.vehicleNo) vals.push(String(r.vehicleNo));
        if (Array.isArray(r.vehicleNumbers)) vals.push(...r.vehicleNumbers.map(String));
        else if (typeof r.vehicleNumbers === 'string' && !r.vehicleNo) vals.push(String(r.vehicleNumbers));
        const unitVal = r.hostUnit ? String(r.hostUnit) : '';
        return vals.some(v => v.toLowerCase().includes(searchTerm)) || (unitVal && unitVal.toLowerCase().includes(searchTerm));
      }) : pelawatAll;

      // Build per-plate counts across the week (count of total occurrences in the week)
      // We'll use this to mark plates that appear more than once in the rendered Monday–Sunday week
      // Also track the distinct days a plate spans, so multi-day stays are flagged as duplicates too.
      const plateCounts = {}; // plate -> occurrence count
      const plateDayMap = {}; // plate -> Set of dayKeys it appears on
      pelawat.forEach(r => {
        // gather all plates for this registration (dedupe within a registration)
        const plates = new Set();
        if (r.vehicleNo) plates.add(String(r.vehicleNo).trim());
        if (Array.isArray(r.vehicleNumbers)) r.vehicleNumbers.forEach(x => plates.add(String(x).trim()));
        if (typeof r.vehicleNumbers === 'string' && !r.vehicleNo) plates.add(String(r.vehicleNumbers).trim());
        const eta = r.eta && r.eta.toDate ? r.eta.toDate() : (r.eta ? new Date(r.eta) : new Date());
        const etd = r.etd && r.etd.toDate ? r.etd.toDate() : (r.etd ? new Date(r.etd) : eta);
        // span each day from eta..etd (inclusive), but only within the week window
        const spanStart = dayStart(eta);
        const spanEnd = dayStart(etd);
        plates.forEach(pl => {
          if (!pl) return;
          plateCounts[pl] = (plateCounts[pl] || 0) + 1;
          plateDayMap[pl] = plateDayMap[pl] || new Set();
          const cursor = new Date(spanStart);
          while (cursor.getTime() <= spanEnd.getTime() && cursor.getTime() < to.getTime()) {
            plateDayMap[pl].add(dayKey(cursor));
            cursor.setDate(cursor.getDate() + 1);
          }
        });
      });

      // Compute plates that appear on consecutive days within the week
      const plateConsecutiveDays = {}; // plate -> Set of dayKeys that are part of a consecutive streak
      Object.keys(plateDayMap).forEach(p => {
        const days = Array.from(plateDayMap[p]);
        days.sort();
        const set = new Set();
        for (let i = 1; i < days.length; i++) {
          const prev = new Date(days[i-1]);
          const curr = new Date(days[i]);
          const diffDays = Math.round((curr - prev) / (24*60*60*1000));
          if (diffDays === 1) {
            set.add(days[i-1]);
            set.add(days[i]);
          }
        }
        if (set.size) plateConsecutiveDays[p] = set;
      });

      // --- Detect duplicate submissions (same-date | same-hostUnit | same phone-or-name)
      // Use similar fingerprint logic as scripts/find-duplicates.js so UI flags repeated
      // submissions of identical data (server-side dedupe key: dateKey|hostUnit|phone-or-name)
      const fingerprintGroups = {}; // fingerprint -> array of response ids
      const idDupCounts = {}; // response id -> duplicate group size
      function mkNameKey(name) {
        if (!name) return '';
        return String(name).trim().toLowerCase().replace(/\s+/g,'_').slice(0,64);
      }
      function normalizePhoneLocal(p) { return (p || '').replace(/[^0-9+]/g,''); }

      pelawat.forEach(r => {
        try {
          const fpDate = r.eta ? dayKey(r.eta && r.eta.toDate ? r.eta.toDate() : (r.eta ? new Date(r.eta) : new Date())) : 'null';
          const hostUnit = (r.hostUnit || '').replace(/\s+/g,'') || 'null';
          const phone = normalizePhoneLocal(r.visitorPhone || '');
          const nameK = mkNameKey(r.visitorName || '');
          const idKey = phone || nameK || 'noid';
          const fp = `${fpDate}|${hostUnit}|${idKey}`;
          fingerprintGroups[fp] = fingerprintGroups[fp] || [];
          fingerprintGroups[fp].push(r.id);
        } catch(e) { /* ignore individual row errors */ }
      });

      Object.keys(fingerprintGroups).forEach(fp => {
        const arr = fingerprintGroups[fp] || [];
        arr.forEach(id => { idDupCounts[id] = arr.length; });
      });

      // build calendar container
      let calWrap = document.getElementById('parkingWeekCalendar');
      if (!calWrap){ calWrap = document.createElement('div'); calWrap.id = 'parkingWeekCalendar'; calWrap.className = 'card'; calWrap.style.marginTop = '12px'; }
      calWrap.innerHTML = '';

      // helper: palette keyed per plate (not per count) so different plates get different colors
      const platePalette = ['#FB7185','#60A5FA','#F59E0B','#34D399','#A78BFA','#F97316','#06B6D4','#10B981','#F472B6','#9CA3AF'];
      const plateColorMap = {};
      function colorForPlate(plate){
        if (!plate) return null;
        const key = String(plate).trim().toUpperCase();
        if (!plateColorMap[key]) {
          const idx = Object.keys(plateColorMap).length % platePalette.length;
          plateColorMap[key] = platePalette[idx];
        }
        return plateColorMap[key];
      }

      function hexToRgba(hex, alpha){
        if (!hex) return null;
        // support #RRGGBB
        const h = hex.replace('#','');
        const r = parseInt(h.substring(0,2),16);
        const g = parseInt(h.substring(2,4),16);
        const b = parseInt(h.substring(4,6),16);
        return `rgba(${r},${g},${b},${alpha})`;
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
          // sort so duplicates appear first, then alphabetical by first word of the plate
          const firstWord = (plate) => {
            const s = String(plate || '').trim();
            if (!s) return '';
            const token = s.split(/\s+/)[0];
            return token.toLowerCase();
          };
          unique.sort((a, b) => {
            const daySpanA = plateDayMap[a.plate] ? plateDayMap[a.plate].size : 0;
            const daySpanB = plateDayMap[b.plate] ? plateDayMap[b.plate].size : 0;
            const dupA = ((plateCounts[a.plate] || 0) > 1 || daySpanA > 1) ? 1 : 0;
            const dupB = ((plateCounts[b.plate] || 0) > 1 || daySpanB > 1) ? 1 : 0;
            if (dupA !== dupB) return dupB - dupA; // duplicates first
            const fa = firstWord(a.plate);
            const fb = firstWord(b.plate);
            const cmp = fa.localeCompare(fb, undefined, { sensitivity: 'base' });
            if (cmp !== 0) return cmp;
            return String(a.plate || '').localeCompare(String(b.plate || ''), undefined, { sensitivity: 'base' });
          });


          unique.forEach(r => {
              const item = document.createElement('div'); item.className = 'pw-vehicle-item';
              // build left-side content matching the provided sample: small dot, rounded icon, plate text + unit
              const left = document.createElement('div'); left.className = 'pw-vehicle-left';
              // vehicle badge removed per request (no icon)
              const plateSpan = document.createElement('span'); plateSpan.className = 'pw-plate-text';
              const unit = r.unit ? ` — ${r.unit}` : '';
              plateSpan.textContent = `${r.plate}${unit}`;
              // left dot removed per request
              // badge removed; no longer append an icon here
              left.appendChild(plateSpan);
              item.appendChild(left);
              // compute per-plate count for multi-day highlighting
              const count = plateCounts[r.plate] || 0;
              const daySpan = plateDayMap[r.plate] ? plateDayMap[r.plate].size : 0;
              const isDup = (count > 1) || (daySpan > 1);
              const isConsecutive = plateConsecutiveDays[r.plate] && plateConsecutiveDays[r.plate].has(k);
              if (isDup) {
                item.classList.add('pw-vehicle-duplicate');
                item.classList.add('pw-week-duplicate');
                // show day span when it spans multiple days; otherwise show occurrence count
                const dupCountVal = (daySpan > 1) ? daySpan : count;
                item.setAttribute('data-dup-count', String(dupCountVal));
                if (daySpan > 3) item.classList.add('pw-dup-long');
                // store plate on element for later color mapping
                item.setAttribute('data-plate', r.plate);
                // choose color per plate so each distinct plate uses its own tint
                const pcolor = colorForPlate(r.plate);
                if (pcolor) {
                  try {
                    const bg = hexToRgba(pcolor, 0.12);
                    const border = hexToRgba(pcolor, 0.45);
                    const shadow = hexToRgba(pcolor, 0.18);
                    item.style.setProperty('background', `linear-gradient(180deg, ${bg}, rgba(255,255,255,0.96))`, 'important');
                    item.style.setProperty('border', `1px solid ${border}`, 'important');
                  } catch(e) {}
                }
                // add small icon for duplication visibility (retain previous icon for parity)
                // multi-day duplicate icon removed per request
              }
              if (isConsecutive) {
                item.classList.add('pw-consecutive');
              }
            // mark if the underlying registration(s) for this displayed plate+unit
            // represent repeated submissions of identical data (same-date|unit|phone-or-name)
            try {
              // If the underlying registration(s) for this displayed plate+unit
              // represent repeated submissions of identical data (same-date|unit|phone-or-name)
              // we still mark the element with the class so it can be styled, but
              // we intentionally do not append a right-side exclamation icon (removed).
              const subCount = idDupCounts[r.id] || 0;
              if (subCount > 1) {
                item.classList.add('pw-submission-duplicate');
              }

              // combine duplicate reasons (week-level plate occurrences + submission duplicates)
              const reasons = [];
              if ((count || 0) > 1) reasons.push(`Plate appears ${count} time${count>1?'s':''} this week`);
              else if (daySpan > 1) reasons.push(`Plate spans ${daySpan} day${daySpan>1?'s':''} this week`);
              if (isConsecutive) reasons.push('Plate appears on consecutive days this week');
              if (subCount > 1) reasons.push(`Registration duplicated ${subCount} time${subCount>1?'s':''}`);
              if (reasons.length) {
                item.classList.add('pw-duplicate');
                try { item.setAttribute('title', reasons.join(' — ')); } catch(e){}
              }
            } catch(e) { /* ignore */ }
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
          renderSummaryWithSearch(responseCache.rows);
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
