// js/visitor.js - datalist -> custom autocomplete filtered suggestions
import {
  collection, addDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ---------- utilities ---------- */
function waitForFirestore(timeout = 5000){
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function check(){
      if (window.__FIRESTORE) return resolve(window.__FIRESTORE);
      if (Date.now() - start > timeout) return reject(new Error('Firestore not available'));
      setTimeout(check, 50);
    })();
  });
}

function toast(message, ok = true) {
  const el = document.createElement('div');
  el.className = `toast ${ok ? 'ok' : 'err'}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(()=> el.classList.add('fade'), 10);
  setTimeout(()=> el.remove(), 3300);
}

function showStatus(msg, ok=true){
  const statusEl = document.getElementById('statusMsg');
  if (!statusEl) return;
  statusEl.innerHTML = `<span class="${ok ? 'text-green-500' : 'text-red-500'}">${msg}</span>`;
}

function validatePhone(phone){
  if (!phone) return true;
  const p = phone.replace(/\s+/g,'').replace(/[^0-9+]/g,'');
  return p.length >= 7 && p.length <= 15;
}

function dateFromInputDateOnly(val){
  if (!val) return null;
  const parts = val.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0],10);
  const m = parseInt(parts[1],10)-1;
  const d = parseInt(parts[2],10);
  const dt = new Date(y,m,d,0,0,0,0);
  return isNaN(dt.getTime()) ? null : dt;
}

/* ---------- vehicle helpers (unchanged) ---------- */
function createVehicleRow(value=''){
  const wrapper = document.createElement('div');
  wrapper.className = 'vehicle-row';
  wrapper.style.display = 'flex';
  wrapper.style.gap = '8px';
  wrapper.style.alignItems = 'center';
  wrapper.style.marginTop = '6px';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'ABC1234';
  input.value = value;
  input.className = 'vehicle-input';
  input.style.flex = '1';
  input.style.padding = '8px';
  input.style.borderRadius = '8px';
  input.style.border = '1px solid var(--input-border, #e5e7eb)';
  input.style.background = 'var(--card, #fff)';
  input.style.color = 'var(--form-text, #111)';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'vehicle-remove btn-ghost';
  removeBtn.textContent = '−';
  removeBtn.title = 'Keluarkan baris';
  removeBtn.style.padding = '8px 10px';
  removeBtn.style.borderRadius = '8px';
  removeBtn.style.cursor = 'pointer';
  removeBtn.setAttribute('aria-label','Keluarkan nombor kenderaan');
  removeBtn.addEventListener('click', () => wrapper.remove());

  wrapper.appendChild(input);
  wrapper.appendChild(removeBtn);
  return wrapper;
}

function getVehicleNumbersFromList(){
  const list = document.querySelectorAll('#vehicleList .vehicle-row input');
  const out = [];
  list.forEach(i => {
    const v = i.value.trim();
    if (v) out.push(v);
  });
  return out;
}

/* ---------- units list (from your List.csv) ---------- */
const units = [
  /* (paste the same array of unit strings from your List.csv here) */
  /* for brevity in this snippet assume it's present; in your file include full array */
];

/* ---------- autocomplete config ---------- */
const LIMIT_SEARCH = 20; // number of suggestions shown max

/* ---------- normalization & validation ---------- */
function normalizeUnitInput(raw) {
  if (!raw) return '';
  let s = raw.trim().toUpperCase();
  s = s.replace(/\s+/g, '').replace(/[_\.\/\\]/g, '-').replace(/-{2,}/g,'-');
  const m = s.match(/^([A-Z]{1,2})(\d{1,3})(\d{1,2})$/);
  if (m) s = `${m[1]}-${parseInt(m[2],10)}-${m[3]}`;
  return s;
}
function isPatternValidUnit(val) {
  if (!val) return false;
  return /^[A-Z0-9]+-\d{1,3}-\d{1,2}$/.test(val);
}

/* ---------- autocomplete logic ---------- */
function matchUnitsPrefix(prefix) {
  if (!prefix) return [];
  const p = prefix.toUpperCase().replace(/\s+/g,'').replace(/[_\.\/\\]/g,'-');
  // match beginsWith p
  const out = [];
  for (let i=0;i<units.length;i++){
    if (units[i].toUpperCase().startsWith(p)) out.push(units[i]);
    if (out.length >= LIMIT_SEARCH) break;
  }
  return out;
}

function createSuggestionItem(text, index) {
  const div = document.createElement('div');
  div.className = 'autocomplete-item';
  div.role = 'option';
  div.setAttribute('data-value', text);
  div.setAttribute('data-index', index);
  div.tabIndex = -1;
  div.textContent = text;
  return div;
}

function openSuggestions(list, wrapperEl, inputEl) {
  const container = wrapperEl.querySelector('#unitSuggestions');
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<div class="autocomplete-empty">Tiada padanan</div>';
    container.hidden = false;
    return;
  }
  list.forEach((it, i) => container.appendChild(createSuggestionItem(it, i)));
  container.hidden = false;
  // reset selection
  container.querySelectorAll('.autocomplete-item').forEach(el => el.setAttribute('aria-selected','false'));
  container.style.display = 'block';
}

function closeSuggestions(wrapperEl) {
  const container = wrapperEl.querySelector('#unitSuggestions');
  if (!container) return;
  container.hidden = true;
  container.innerHTML = '';
}

function selectSuggestion(value, inputEl, wrapperEl) {
  inputEl.value = value;
  // after selection hide list
  closeSuggestions(wrapperEl);
  inputEl.focus();
}

/* ---------- subcategory/company/etd etc (kept) ---------- */
const companyCategories = new Set(['Kontraktor','Penghantaran Barang','Pindah Rumah']);
const categoriesEtdDisabled = new Set(['Kontraktor','Penghantaran Barang','Pindah Rumah']);

const subCategoryMap = {
  'Penghantaran Barang': [
    { value: 'Penghantaran Masuk', label: 'Penghantaran Masuk' },
    { value: 'Penghantaran Keluar', label: 'Penghantaran Keluar' }
  ],
  'Pindah Rumah': [
    { value: 'Pindah Masuk', label: 'Pindah Masuk' },
    { value: 'Pindah Keluar', label: 'Pindah Keluar' }
  ],
  'Kontraktor': [
    { value: 'Renovasi', label: 'Renovasi' },
    { value: 'Telekomunikasi', label: 'Telekomunikasi' },
    { value: 'Kerja Servis', label: 'Kerja Servis' },
    { value: 'Kawalan Serangga Perosak', label: 'Kawalan Serangga Perosak' },
    { value: 'Kerja Pembaikan', label: 'Kerja Pembaikan' },
    { value: 'Pemeriksaan', label: 'Pemeriksaan' }
  ]
};

const subCategoryHelpMap = {
  'Penghantaran Masuk': 'Penghantaran masuk ke premis — nyatakan pihak penghantar dan penerima; pastikan masa muat turun dicatat.',
  'Penghantaran Keluar': 'Penghantaran keluar dari premis — nyatakan penerima di luar dan butiran kenderaan jika ada.',
  'Pindah Masuk': 'Kemasukan barangan pindah ke unit; sila nyatakan anggaran jumlah barangan dan nombor lori jika ada.',
  'Pindah Keluar': 'Pengeluaran barangan pindah dari unit; rekod nombor lori dan masa anggaran.',
  'Renovasi': 'Kerja-kerja pengubahsuaian (contoh: cat, tukar jubin). Pastikan kontraktor bawa dokumen kelulusan dan senarai pekerja.',
  'Telekomunikasi': 'Kerja pemasangan/servis telekomunikasi. Sertakan nombor projek/PO dan waktu kerja jangkaan.',
  'Kerja Servis': 'Servis berkala seperti penyelenggaraan lif, AC, atau sistem mekanikal. Nyatakan alat yang dibawa jika perlu.',
  'Kawalan Serangga Perosak': 'Rawatan kawalan perosak. Pastikan kawasan yang terlibat dan langkah keselamatan diberi tahu.',
  'Kerja Pembaikan': 'Pembaikan kecil/struktur. Nyatakan skop kerja ringkas dan akses yang diperlukan.',
  'Pemeriksaan': 'Pemeriksaan keselamatan/inspeksi; sertakan pihak yang melakukan pemeriksaan dan tujuan pemeriksaan.'
};

function setCompanyFieldState(show) {
  const companyWrap = document.getElementById('companyWrap');
  const companyInput = document.getElementById('companyName');
  if (!companyWrap || !companyInput) return;
  if (show) {
    companyWrap.classList.remove('hidden');
    companyInput.required = true;
    companyInput.disabled = false;
    companyInput.removeAttribute('aria-hidden');
  } else {
    companyWrap.classList.add('hidden');
    companyInput.required = false;
    companyInput.disabled = true;
    companyInput.value = '';
    companyInput.setAttribute('aria-hidden','true');
  }
}

function updateSubCategoryForCategory(cat) {
  const wrap = document.getElementById('subCategoryWrap');
  const select = document.getElementById('subCategory');
  const helpWrap = document.getElementById('subCategoryHelpWrap');
  const helpEl = document.getElementById('subCategoryHelp');
  if (!wrap || !select) return;

  select.innerHTML = '<option value="">— Pilih —</option>';
  select.required = false;
  select.disabled = true;
  wrap.classList.add('hidden');
  wrap.setAttribute('aria-hidden','true');

  if (helpEl) { helpEl.textContent = ''; }
  if (helpWrap) { helpWrap.classList.add('hidden'); helpWrap.setAttribute('aria-hidden','true'); }

  if (subCategoryMap[cat]) {
    subCategoryMap[cat].forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    });
    wrap.classList.remove('hidden');
    wrap.removeAttribute('aria-hidden');
    select.disabled = false;
    select.required = true;
    select.removeEventListener('change', showSubCategoryHelp);
    select.addEventListener('change', showSubCategoryHelp);
    showSubCategoryHelp();
  }
}

function showSubCategoryHelp() {
  const select = document.getElementById('subCategory');
  const val = select?.value || '';
  const helpWrap = document.getElementById('subCategoryHelpWrap');
  const helpEl = document.getElementById('subCategoryHelp');
  if (!helpEl || !helpWrap) return;

  if (val && subCategoryHelpMap[val]) {
    helpEl.textContent = subCategoryHelpMap[val];
    helpWrap.classList.remove('hidden');
    helpWrap.removeAttribute('aria-hidden');
  } else {
    helpEl.textContent = '';
    helpWrap.classList.add('hidden');
    helpWrap.setAttribute('aria-hidden','true');
  }
}

/* ---------- main init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('hostUnit');
  const wrapper = input?.closest('.autocomplete-wrap');
  const listEl = document.getElementById('unitSuggestions');

  // NOTE: ensure units array is present (paste full array above)
  // populate initial (no persistent datalist necessary)

  // keyboard navigation state
  let focusedIndex = -1;
  let currentSuggestions = [];

  function renderMatches(prefix) {
    if (!wrapper || !input) return;
    const matches = matchUnitsPrefix(prefix);
    currentSuggestions = matches;
    if (!matches.length) {
      openSuggestions([], wrapper, input);
      focusedIndex = -1;
      return;
    }
    openSuggestions(matches, wrapper, input);
    focusedIndex = -1;
  }

  // input handlers
  input.addEventListener('input', (e) => {
    const v = e.target.value || '';
    const normQuery = v.trim().toUpperCase().replace(/\s+/g,'').replace(/[_\.\/\\]/g,'-');
    // If user typed only prefix like "A1" or "A-1", show matches
    renderMatches(normQuery);
  });

  // keyboard navigation
  input.addEventListener('keydown', (e) => {
    const items = listEl.querySelectorAll('.autocomplete-item');
    if (listEl.hidden) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
      items.forEach((it, idx) => it.setAttribute('aria-selected', idx === focusedIndex ? 'true':'false'));
      items[focusedIndex]?.scrollIntoView({block:'nearest'});
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
      items.forEach((it, idx) => it.setAttribute('aria-selected', idx === focusedIndex ? 'true':'false'));
      items[focusedIndex]?.scrollIntoView({block:'nearest'});
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && items[focusedIndex]) {
        e.preventDefault();
        const val = items[focusedIndex].getAttribute('data-value');
        selectSuggestion(val, input, wrapper);
      } else {
        // no selection, allow form submit to handle validation
      }
    } else if (e.key === 'Escape') {
      closeSuggestions(wrapper);
    }
  });

  // click on suggestion
  listEl.addEventListener('click', (ev) => {
    const item = ev.target.closest('.autocomplete-item');
    if (!item) return;
    const val = item.getAttribute('data-value');
    selectSuggestion(val, input, wrapper);
  });

  // blur: close with slight delay to allow click
  input.addEventListener('blur', () => setTimeout(()=> closeSuggestions(wrapper), 150));

  // normalization on blur (also sets validity message)
  input.addEventListener('blur', (e) => {
    const norm = normalizeUnitInput(e.target.value || '');
    e.target.value = norm;
    if (norm && !isPatternValidUnit(norm)) {
      input.setCustomValidity('Format tidak sah. Gunakan contohnya A-12-03.');
      showStatus('Unit rumah: format tidak sah. Gunakan contoh A-12-03.', false);
    } else {
      input.setCustomValidity('');
      if (norm && !units.includes(norm)) {
        showStatus('Unit tidak ditemui dalam senarai; pastikan ia betul.', true);
      } else {
        showStatus('', true);
      }
    }
  });

  // rest of existing init (theme, firestore wait, form submit etc.)
  const savedTheme = (localStorage.getItem('visitorTheme') || 'dark');
  if (savedTheme === 'light') document.documentElement.classList.remove('dark'); else document.documentElement.classList.add('dark');
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const cur = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    if (next === 'light') document.documentElement.classList.remove('dark'); else document.documentElement.classList.add('dark');
    try { localStorage.setItem('visitorTheme', next); } catch(e){}
  });

  (async () => {
    try { await waitForFirestore(); } catch (err) {
      console.error('Firestore init failed', err);
      showStatus('Initialisasi Firestore gagal. Sila hubungi pentadbir.', false);
      return;
    }

    // grab elements used later in submit
    const form = document.getElementById('visitorForm');
    const clearBtn = document.getElementById('clearBtn');
    const categoryEl = document.getElementById('category');
    const subCategoryEl = document.getElementById('subCategory');
    const stayOverEl = document.getElementById('stayOver');
    const etaEl = document.getElementById('eta');
    const etdEl = document.getElementById('etd');
    const hostUnitEl = document.getElementById('hostUnit');

    const companyWrap = document.getElementById('companyWrap');
    const companyInput = document.getElementById('companyName');

    const vehicleSingleWrap = document.getElementById('vehicleSingleWrap');
    const vehicleMultiWrap = document.getElementById('vehicleMultiWrap');
    const vehicleList = document.getElementById('vehicleList');
    const addVehicleBtn = document.getElementById('addVehicleBtn');

    if (!form) { console.error('visitorForm missing'); return; }

    function updateVehicleControlsForCategory(cat) {
      if (!vehicleSingleWrap || !vehicleMultiWrap || !addVehicleBtn || !vehicleList) return;
      if (cat === 'Pelawat Khas') {
        vehicleSingleWrap.classList.add('hidden');
        vehicleMultiWrap.classList.remove('hidden');
        addVehicleBtn.disabled = false;
        addVehicleBtn.classList.remove('btn-disabled');
        if (!vehicleList.querySelector('.vehicle-row')) {
          vehicleList.innerHTML = '';
          vehicleList.appendChild(createVehicleRow(''));
        }
      } else {
        vehicleSingleWrap.classList.remove('hidden');
        vehicleMultiWrap.classList.add('hidden');
        addVehicleBtn.disabled = true;
        addVehicleBtn.classList.add('btn-disabled');
        vehicleList && (vehicleList.innerHTML = '');
      }
    }

    function updateEtdState(cat) {
      if (!etdEl || !etaEl) return;
      if (categoriesEtdDisabled.has(cat)) {
        etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = ''; return;
      }
      if (cat === 'Pelawat') {
        const stay = stayOverEl?.value || 'No';
        if (stay === 'Yes') {
          etdEl.disabled = false;
          const etaVal = etaEl.value;
          if (etaVal) {
            const etaDate = dateFromInputDateOnly(etaVal);
            if (etaDate) {
              const maxDate = new Date(etaDate); maxDate.setDate(maxDate.getDate() + 3);
              const toIso = d => d.toISOString().slice(0,10);
              etdEl.min = toIso(etaDate); etdEl.max = toIso(maxDate);
            }
          }
        } else {
          etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = '';
        }
        return;
      }
      etdEl.disabled = false;
      const etaVal = etaEl.value;
      if (etaVal) {
        const etaDate = dateFromInputDateOnly(etaVal);
        if (etaDate) {
          const maxDate = new Date(etaDate); maxDate.setDate(maxDate.getDate() + 3);
          const toIso = d => d.toISOString().slice(0,10);
          etdEl.min = toIso(etaDate); etdEl.max = toIso(maxDate);
          if (etdEl.value) {
            const cur = dateFromInputDateOnly(etdEl.value);
            if (!cur || cur < etaDate || cur > maxDate) etdEl.value = '';
          }
        }
      } else { etdEl.min = ''; etdEl.max = ''; }
    }

    if (stayOverEl) stayOverEl.disabled = true;
    if (companyWrap && companyInput) { companyWrap.classList.add('hidden'); companyInput.disabled = true; companyInput.setAttribute('aria-hidden','true'); }
    if (vehicleMultiWrap) vehicleMultiWrap.classList.add('hidden');
    if (vehicleSingleWrap) vehicleSingleWrap.classList.remove('hidden');
    if (vehicleList) vehicleList.innerHTML = '';
    if (addVehicleBtn) { addVehicleBtn.disabled = true; addVehicleBtn.classList.add('btn-disabled'); }

    categoryEl?.addEventListener('change', (ev) => {
      const v = ev.target.value?.trim();
      updateSubCategoryForCategory(v);
      if (stayOverEl) {
        if (v === 'Pelawat') { stayOverEl.disabled = false; if (!stayOverEl.value) stayOverEl.value = 'No'; }
        else { stayOverEl.value = 'No'; stayOverEl.disabled = true; }
      }
      setCompanyFieldState(companyCategories.has(v));
      updateVehicleControlsForCategory(v);
      updateEtdState(v);
    });

    subCategoryEl?.addEventListener('change', showSubCategoryHelp);
    stayOverEl?.addEventListener('change', () => { const cat = categoryEl?.value?.trim() || ''; updateEtdState(cat); });
    addVehicleBtn?.addEventListener('click', () => { if (addVehicleBtn.disabled) return; if (!vehicleList) return; vehicleList.appendChild(createVehicleRow('')); });

    etaEl?.addEventListener('change', () => {
      const etaVal = etaEl.value;
      if (!etaVal) { if (etdEl) { etdEl.value = ''; etdEl.min = ''; etdEl.max = ''; } return; }
      const etaDate = dateFromInputDateOnly(etaVal);
      if (!etaDate) return;
      const maxDate = new Date(etaDate); maxDate.setDate(maxDate.getDate() + 3);
      const toIso = d => d.toISOString().slice(0,10);
      if (etdEl) { etdEl.min = toIso(etaDate); etdEl.max = toIso(maxDate); const cat = categoryEl?.value?.trim() || ''; updateEtdState(cat); }
    });

    const initCat = categoryEl?.value?.trim() || '';
    setCompanyFieldState(companyCategories.has(initCat));
    updateSubCategoryForCategory(initCat);
    updateVehicleControlsForCategory(initCat);
    updateEtdState(initCat);

    // submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showStatus('Memproses...', true);

      const rawUnit = document.getElementById('hostUnit')?.value || '';
      const hostUnit = normalizeUnitInput(rawUnit);

      const hostName = document.getElementById('hostName')?.value.trim() || '';
      const hostPhone = document.getElementById('hostPhone')?.value.trim() || '';

      const category = categoryEl?.value || '';
      const subCategory = subCategoryEl?.value || '';
      const entryDetails = document.getElementById('entryDetails')?.value.trim() || '';
      const companyName = document.getElementById('companyName')?.value.trim() || '';
      const visitorName = document.getElementById('visitorName')?.value.trim() || '';
      const visitorPhone = document.getElementById('visitorPhone')?.value.trim() || '';
      const stayOver = document.getElementById('stayOver')?.value || 'No';
      const etaVal = document.getElementById('eta')?.value || '';
      const etdVal = document.getElementById('etd')?.value || '';
      const vehicleType = document.getElementById('vehicleType')?.value || '';

      if (!hostUnit) { showStatus('Sila masukkan Unit rumah.', false); toast('Sila masukkan Unit rumah', false); return; }
      if (!isPatternValidUnit(hostUnit)) { showStatus('Format Unit tidak sah. Gunakan contoh A-12-03.', false); toast('Format Unit tidak sah', false); return; }
      if (!hostName) { showStatus('Sila lengkapkan Butiran Penghuni (Nama).', false); toast('Sila lengkapkan Nama penghuni', false); return; }
      if (!category) { showStatus('Sila pilih Kategori.', false); toast('Sila pilih kategori', false); return; }
      if (subCategoryMap[category] && !subCategory) { showStatus('Sila pilih pilihan bagi kategori ini.', false); toast('Sila pilih pilihan bagi kategori ini', false); return; }
      if (companyCategories.has(category) && !companyName) { showStatus('Sila masukkan Nama syarikat.', false); toast('Sila masukkan Nama syarikat', false); return; }
      if (!visitorName) { showStatus('Sila masukkan Nama Pelawat.', false); toast('Sila masukkan Nama Pelawat', false); return; }
      if (!etaVal) { showStatus('Sila pilih Tarikh ETA.', false); toast('Sila pilih ETA', false); return; }
      if (!validatePhone(visitorPhone)) { showStatus('Nombor telefon pelawat tidak sah.', false); toast('Nombor telefon pelawat tidak sah', false); return; }
      if (hostPhone && !validatePhone(hostPhone)) { showStatus('Nombor telefon penghuni tidak sah.', false); toast('Nombor telefon penghuni tidak sah', false); return; }

      const etaDate = dateFromInputDateOnly(etaVal);
      const etdDate = etdVal ? dateFromInputDateOnly(etdVal) : null;
      if (!etaDate) { showStatus('Tarikh ETA tidak sah.', false); toast('Tarikh ETA tidak sah', false); return; }
      if (etdVal && !etdDate) { showStatus('Tarikh ETD tidak sah.', false); toast('Tarikh ETD tidak sah', false); return; }
      if (etdDate) {
        const max = new Date(etaDate); max.setDate(max.getDate() + 3);
        if (etdDate < etaDate || etdDate > max) { showStatus('Tarikh ETD mesti antara ETA hingga 3 hari selepas ETA.', false); toast('Tarikh ETD mesti antara ETA hingga 3 hari selepas ETA', false); return; }
      }

      let vehicleNo = '';
      let vehicleNumbers = [];
      if (category === 'Pelawat Khas') {
        vehicleNumbers = getVehicleNumbersFromList();
        if (!vehicleNumbers.length) { showStatus('Sila masukkan sekurang-kurangnya satu nombor kenderaan untuk Pelawat Khas.', false); toast('Sila masukkan nombor kenderaan', false); return; }
      } else {
        vehicleNo = document.getElementById('vehicleNo')?.value.trim() || '';
      }

      const unitFound = units.includes(hostUnit);

      const payload = {
        hostUnit,
        hostUnitFound: unitFound,
        hostName,
        hostPhone: hostPhone || '',
        category,
        subCategory,
        entryDetails: entryDetails || '',
        companyName: companyName || '',
        visitorName,
        visitorPhone: visitorPhone || '',
        stayOver: (category === 'Pelawat') ? (stayOver === 'Yes' ? 'Yes' : 'No') : 'No',
        eta: Timestamp.fromDate(etaDate),
        etd: etdDate ? Timestamp.fromDate(etdDate) : null,
        vehicleNo: vehicleNo || '',
        vehicleNumbers: vehicleNumbers.length ? vehicleNumbers : [],
        vehicleType: vehicleType || '',
        subCategoryHelp: subCategoryHelpMap[subCategory] || '',
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      try {
        const col = collection(window.__FIRESTORE, 'responses');
        await addDoc(col, payload);
        showStatus('Pendaftaran berjaya. Terima kasih.', true);
        toast('Pendaftaran berjaya', true);
        form.reset();
        closeSuggestions(wrapper);
        setCompanyFieldState(false);
        updateSubCategoryForCategory('');
        if (vehicleMultiWrap) vehicleMultiWrap.classList.add('hidden');
        if (vehicleSingleWrap) vehicleSingleWrap.classList.remove('hidden');
        if (vehicleList) vehicleList.innerHTML = '';
        if (addVehicleBtn) { addVehicleBtn.disabled = true; addVehicleBtn.classList.add('btn-disabled'); }
        if (stayOverEl) { stayOverEl.disabled = true; stayOverEl.value = 'No'; }
        if (etdEl) { etdEl.min = ''; etdEl.max = ''; etdEl.value = ''; etdEl.disabled = true; }
      } catch (err) {
        console.error('visitor add error', err);
        showStatus('Gagal hantar. Sila cuba lagi atau hubungi pentadbir.', false);
        toast('Gagal hantar. Sila cuba lagi', false);
      }
    });

    clearBtn?.addEventListener('click', () => {
      form.reset();
      showStatus('', true);
      closeSuggestions(wrapper);
      setCompanyFieldState(false);
      updateSubCategoryForCategory('');
      if (vehicleMultiWrap) vehicleMultiWrap.classList.add('hidden');
      if (vehicleSingleWrap) vehicleSingleWrap.classList.remove('hidden');
      if (vehicleList) vehicleList.innerHTML = '';
      if (addVehicleBtn) { addVehicleBtn.disabled = true; addVehicleBtn.classList.add('btn-disabled'); }
      if (stayOverEl) { stayOverEl.disabled = true; stayOverEl.value = 'No'; }
      if (etdEl) { etdEl.min = ''; etdEl.max = ''; etdEl.value = ''; etdEl.disabled = true; }
    });
  })();
});
