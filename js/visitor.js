// js/visitor.js - lengkap: grouped autocomplete + normalization + agreement checkbox
import {
  collection, serverTimestamp, Timestamp, doc, setDoc, runTransaction, getDoc, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* ---------- full units array (from your List.csv) ---------- */
const units = [
"A-1-1","A-1-2","A-1-3","A-1-4","A-1-5","A-1-6","A-1-7","A-1-8","A-1-9","A-1-10",
"A-2-1","A-2-2","A-2-3","A-2-4","A-2-5","A-2-6","A-2-7","A-2-8","A-2-9","A-2-10",
"A-3-1","A-3-2","A-3-3","A-3-4","A-3-5","A-3-6","A-3-7","A-3-8","A-3-9","A-3-10",
"A-4-1","A-4-2","A-4-3","A-4-4","A-4-5","A-4-6","A-4-7","A-4-8","A-4-9","A-4-10",
"A-5-1","A-5-2","A-5-3","A-5-4","A-5-5","A-5-6","A-5-7","A-5-8","A-5-9","A-5-10",
"A-6-1","A-6-2","A-6-3","A-6-4","A-6-5","A-6-6","A-6-7","A-6-8","A-6-9","A-6-10",
"A-7-1","A-7-2","A-7-3","A-7-4","A-7-5","A-7-6","A-7-7","A-7-8","A-7-9","A-7-10",
"A-8-1","A-8-2","A-8-3","A-8-4","A-8-5","A-8-6","A-8-7","A-8-8","A-8-9","A-8-10",
"A-9-1","A-9-2","A-9-3","A-9-4","A-9-5","A-9-6","A-9-7","A-9-8","A-9-9","A-9-10",
"A-10-1","A-10-2","A-10-3","A-10-4","A-10-5","A-10-6","A-10-7","A-10-8","A-10-9","A-10-10",
"A-11-1","A-11-2","A-11-3","A-11-4","A-11-5","A-11-6","A-11-7","A-11-8","A-11-9","A-11-10",
"A-12-1","A-12-2","A-12-3","A-12-4","A-12-5","A-12-6","A-12-7","A-12-8","A-12-9","A-12-10",
"A-13-1","A-13-2","A-13-3","A-13-4","A-13-5","A-13-6","A-13-7","A-13-8","A-13-9","A-13-10",
"A-14-1","A-14-2","A-14-3","A-14-4","A-14-5","A-14-6","A-14-7","A-14-8","A-14-9","A-14-10",
"B1-1-1","B1-1-2","B1-1-3","B1-1-4","B1-1-5","B1-1-6","B1-1-7","B1-1-8","B1-1-9","B1-1-10","B1-1-11","B1-1-12",
"B1-2-1","B1-2-2","B1-2-3","B1-2-4","B1-2-5","B1-2-6","B1-2-7","B1-2-8","B1-2-9","B1-2-10","B1-2-11","B1-2-12",
"B1-3-1","B1-3-2","B1-3-3","B1-3-4","B1-3-5","B1-3-6","B1-3-7","B1-3-8","B1-3-9","B1-3-10","B1-3-11","B1-3-12",
"B1-4-1","B1-4-2","B1-4-3","B1-4-4","B1-4-5","B1-4-6","B1-4-7","B1-4-8","B1-4-9","B1-4-10","B1-4-11","B1-4-12",
"B1-5-1","B1-5-2","B1-5-3","B1-5-4","B1-5-5","B1-5-6","B1-5-7","B1-5-8","B1-5-9","B1-5-10","B1-5-11","B1-5-12",
"B1-6-1","B1-6-2","B1-6-3","B1-6-4","B1-6-5","B1-6-6","B1-6-7","B1-6-8","B1-6-9","B1-6-10","B1-6-11","B1-6-12",
"B1-7-1","B1-7-2","B1-7-3","B1-7-4","B1-7-5","B1-7-6","B1-7-7","B1-7-8","B1-7-9","B1-7-10","B1-7-11","B1-7-12",
"B1-8-1","B1-8-2","B1-8-3","B1-8-4","B1-8-5","B1-8-6","B1-8-7","B1-8-8","B1-8-9","B1-8-10","B1-8-11","B1-8-12",
"B1-9-1","B1-9-2","B1-9-3","B1-9-4","B1-9-5","B1-9-6","B1-9-7","B1-9-8","B1-9-9","B1-9-10","B1-9-11","B1-9-12",
"B1-10-1","B1-10-2","B1-10-3","B1-10-4","B1-10-5","B1-10-6","B1-10-7","B1-10-8","B1-10-9","B1-10-10","B1-10-11","B1-10-12",
"B1-11-1","B1-11-2","B1-11-3","B1-11-4","B1-11-5","B1-11-6","B1-11-7","B1-11-8","B1-11-9","B1-11-10","B1-11-11","B1-11-12",
"B1-12-1","B1-12-2","B1-12-3","B1-12-4","B1-12-5","B1-12-6","B1-12-7","B1-12-8","B1-12-9","B1-12-10","B1-12-11","B1-12-12",
"B1-G-1","B1-G-2","B1-G-3","B1-G-4","B1-G-5","B1-G-6","B1-G-7","B1-G-8","B1-G-9","B1-G-10","B1-G-11","B1-G-12",
"B2-1-1","B2-1-2","B2-1-3","B2-1-4","B2-1-5","B2-1-6","B2-1-7","B2-1-8","B2-1-9","B2-1-10","B2-1-11","B2-1-12",
"B2-2-1","B2-2-2","B2-2-3","B2-2-4","B2-2-5","B2-2-6","B2-2-7","B2-2-8","B2-2-9","B2-2-10","B2-2-11","B2-2-12",
"B2-3-1","B2-3-2","B2-3-3","B2-3-4","B2-3-5","B2-3-6","B2-3-7","B2-3-8","B2-3-9","B2-3-10","B2-3-11","B2-3-12",
"B2-4-1","B2-4-2","B2-4-3","B2-4-4","B2-4-5","B2-4-6","B2-4-7","B2-4-8","B2-4-9","B2-4-10","B2-4-11","B2-4-12",
"B2-5-1","B2-5-2","B2-5-3","B2-5-4","B2-5-5","B2-5-6","B2-5-7","B2-5-8","B2-5-9","B2-5-10","B2-5-11","B2-5-12",
"B2-6-1","B2-6-2","B2-6-3","B2-6-4","B2-6-5","B2-6-6","B2-6-7","B2-6-8","B2-6-9","B2-6-10","B2-6-11","B2-6-12",
"B2-7-1","B2-7-2","B2-7-3","B2-7-4","B2-7-5","B2-7-6","B2-7-7","B2-7-8","B2-7-9","B2-7-10","B2-7-11","B2-7-12",
"B2-8-1","B2-8-2","B2-8-3","B2-8-4","B2-8-5","B2-8-6","B2-8-7","B2-8-8","B2-8-9","B2-8-10","B2-8-11","B2-8-12",
"B2-9-1","B2-9-2","B2-9-3","B2-9-4","B2-9-5","B2-9-6","B2-9-7","B2-9-8","B2-9-9","B2-9-10","B2-9-11","B2-9-12",
"B2-10-1","B2-10-2","B2-10-3","B2-10-4","B2-10-5","B2-10-6","B2-10-7","B2-10-8","B2-10-9","B2-10-10","B2-10-11","B2-10-12",
"B2-11-1","B2-11-2","B2-11-3","B2-11-4","B2-11-5","B2-11-6","B2-11-7","B2-11-8","B2-11-9","B2-11-10","B2-11-11","B2-11-12",
"B2-12-1","B2-12-2","B2-12-3","B2-12-4","B2-12-5","B2-12-6","B2-12-7","B2-12-8","B2-12-9","B2-12-10","B2-12-11","B2-12-12",
"B2-13-1","B2-13-2","B2-13-3","B2-13-4","B2-13-5","B2-13-6","B2-13-7","B2-13-8","B2-13-9","B2-13-10","B2-13-11","B2-13-12",
"B2-14-1","B2-14-2","B2-14-3","B2-14-4","B2-14-5","B2-14-6","B2-14-7","B2-14-8","B2-14-9","B2-14-10","B2-14-11","B2-14-12",
"B2-15-1","B2-15-2","B2-15-3","B2-15-4","B2-15-5","B2-15-6","B2-15-7","B2-15-8","B2-15-9","B2-15-10","B2-15-11","B2-15-12",
"B2-G-1","B2-G-2","B2-G-3","B2-G-4","B2-G-5","B2-G-6","B2-G-7","B2-G-8","B2-G-9","B2-G-10","B2-G-11","B2-G-12",
"B3-1-1","B3-1-2","B3-1-3","B3-1-4","B3-1-5","B3-1-6","B3-1-7","B3-1-8","B3-1-9","B3-1-10","B3-1-11","B3-1-12",
"B3-2-1","B3-2-2","B3-2-3","B3-2-4","B3-2-5","B3-2-6","B3-2-7","B3-2-8","B3-2-9","B3-2-10","B3-2-11","B3-2-12",
"B3-3-1","B3-3-2","B3-3-3","B3-3-4","B3-3-5","B3-3-6","B3-3-7","B3-3-8","B3-3-9","B3-3-10","B3-3-11","B3-3-12",
"B3-4-1","B3-4-2","B3-4-3","B3-4-4","B3-4-5","B3-4-6","B3-4-7","B3-4-8","B3-4-9","B3-4-10","B3-4-11","B3-4-12",
"B3-5-1","B3-5-2","B3-5-3","B3-5-4","B3-5-5","B3-5-6","B3-5-7","B3-5-8","B3-5-9","B3-5-10","B3-5-11","B3-5-12",
"B3-6-1","B3-6-2","B3-6-3","B3-6-4","B3-6-5","B3-6-6","B3-6-7","B3-6-8","B3-6-9","B3-6-10","B3-6-11","B3-6-12",
"B3-7-1","B3-7-2","B3-7-3","B3-7-4","B3-7-5","B3-7-6","B3-7-7","B3-7-8","B3-7-9","B3-7-10","B3-7-11","B3-7-12",
"B3-8-1","B3-8-2","B3-8-3","B3-8-4","B3-8-5","B3-8-6","B3-8-7","B3-8-8","B3-8-9","B3-8-10","B3-8-11","B3-8-12",
"B3-9-1","B3-9-2","B3-9-3","B3-9-4","B3-9-5","B3-9-6","B3-9-7","B3-9-8","B3-9-9","B3-9-10","B3-9-11","B3-9-12",
"B3-10-1","B3-10-2","B3-10-3","B3-10-4","B3-10-5","B3-10-6","B3-10-7","B3-10-8","B3-10-9","B3-10-10","B3-10-11","B3-10-12",
"B3-11-1","B3-11-2","B3-11-3","B3-11-4","B3-11-5","B3-11-6","B3-11-7","B3-11-8","B3-11-9","B3-11-10","B3-11-11","B3-11-12",
"B3-12-1","B3-12-2","B3-12-3","B3-12-4","B3-12-5","B3-12-6","B3-12-7","B3-12-8","B3-12-9","B3-12-10","B3-12-11","B3-12-12",
"B3-13-1","B3-13-2","B3-13-3","B3-13-4","B3-13-5","B3-13-6","B3-13-7","B3-13-8","B3-13-9","B3-13-10","B3-13-11","B3-13-12",
"B3-14-1","B3-14-2","B3-14-3","B3-14-4","B3-14-5","B3-14-6","B3-14-7","B3-14-8","B3-14-9","B3-14-10","B3-14-11","B3-14-12",
"B3-15-1","B3-15-2","B3-15-3","B3-15-4","B3-15-5","B3-15-6","B3-15-7","B3-15-8","B3-15-9","B3-15-10","B3-15-11","B3-15-12",
"B3-16-1","B3-16-2","B3-16-3","B3-16-4","B3-16-5","B3-16-6","B3-16-7","B3-16-8","B3-16-9","B3-16-10","B3-16-11","B3-16-12",
"B3-17-1","B3-17-2","B3-17-3","B3-17-4","B3-17-5","B3-17-6","B3-17-7","B3-17-8","B3-17-9","B3-17-10","B3-17-11","B3-17-12",
"B3-G-1","B3-G-2","B3-G-3","B3-G-4","B3-G-5","B3-G-6","B3-G-7","B3-G-8","B3-G-9","B3-G-10","B3-G-11","B3-G-12"
];

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

// live clock for visitor form header
let visitorTimeTicker = null;
let unitImportMetaTs = null;
let unitImportMetaLabel = '';
let unitMetaReadDenied = false;
let dedupeTransactionUnavailable = false;
let currentUnitSnapshot = null;
let currentUnitId = '';
let pendingWaPayload = null;

async function ensureUnitImportMeta(){
  if (unitImportMetaTs) return { ts: unitImportMetaTs, label: unitImportMetaLabel };
  if (unitMetaReadDenied) return { ts: null, label: '' };
  if (!window.__FIRESTORE) return { ts: null, label: '' };
  try {
    const metaRef = doc(window.__FIRESTORE, 'unitMeta', 'import');
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists()) {
      const data = metaSnap.data() || {};
      unitImportMetaTs = data.importedAt || data.updatedAt || data.lastUpdatedAt || null;
      unitImportMetaLabel = data.fileName ? ` (${data.fileName})` : '';
      return { ts: unitImportMetaTs, label: unitImportMetaLabel };
    }
  } catch (e) {
    const code = String(e && e.code ? e.code : '').toLowerCase();
    const msg = String(e && (e.message || e) ? (e.message || e) : '').toLowerCase();
    if (code.includes('permission') || msg.includes('insufficient permissions')) {
      unitMetaReadDenied = true;
      return { ts: null, label: '' };
    }
    console.warn('ensureUnitImportMeta failed', e);
  }
  return { ts: null, label: '' };
}

function toast(message, ok = true, opts = {}) {
  // opts.duration - ms to auto-dismiss (default 7000)
  const duration = typeof opts.duration === 'number' ? opts.duration : 7000;

  const el = document.createElement('div');
  el.className = `toast ${ok ? 'ok' : 'err'}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');

  const content = document.createElement('div');
  content.className = 'toast-content';
  content.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label','Tutup pemberitahuan');
  closeBtn.innerText = '×';

  closeBtn.addEventListener('click', () => {
    if (!el._removed) { el._removed = true; el.classList.add('fade'); setTimeout(()=> el.remove(), 220); }
  });

  el.appendChild(content);
  el.appendChild(closeBtn);
  // ensure toast container exists so toasts stack instead of overlapping
  let container = document.getElementById('toastContainer');
  if (!container) { container = document.createElement('div'); container.id = 'toastContainer'; document.body.appendChild(container); }
  container.appendChild(el);

  // show then schedule auto-dismiss
  // tiny delay so CSS transition can run
  setTimeout(()=> el.classList.add('show'), 10);

  let timer = setTimeout(()=> {
    if (!el._removed) { el._removed = true; el.classList.add('fade'); setTimeout(()=> el.remove(), 220); }
  }, duration);

  // pause on hover / focus
  el.addEventListener('mouseenter', () => { clearTimeout(timer); });
  el.addEventListener('mouseleave', () => { timer = setTimeout(()=> { if (!el._removed) { el._removed = true; el.classList.add('fade'); setTimeout(()=> el.remove(), 220); } }, 2000); });

  // accessible dismiss via Escape
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeBtn.click(); } });
  return el;
}

function clearAllToasts() {
  try {
    const toasts = Array.from(document.querySelectorAll('.toast'));
    toasts.forEach(t => { if (!t._removed) { t._removed = true; t.classList.add('fade'); setTimeout(()=> t.remove(), 220); } else { t.remove(); } });
  } catch (e) { /* ignore */ }
}

// Floating memo overlay shown before user can fill the form
function showFloatMemo(message, opts = {}){
  const storageKey = (opts && 'storageKey' in opts) ? opts.storageKey : 'visitorMemoDismissed';
  // Only skip showing if a storageKey is provided and previously dismissed
  try { if (storageKey && localStorage.getItem(storageKey) === '1') return; } catch(e) {}
  const overlay = document.createElement('div');
  overlay.id = 'visitorMemoOverlay';
  overlay.style.position = 'fixed'; overlay.style.inset = '0'; overlay.style.background = 'rgba(0,0,0,0.35)';
  overlay.style.zIndex = '99999'; overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
  const memo = document.createElement('div'); memo.className = 'card'; memo.setAttribute('role','dialog'); memo.setAttribute('aria-modal','true'); memo.setAttribute('aria-labelledby','visitorMemoTitle');
  memo.style.width = '520px'; memo.style.maxWidth = '95%'; memo.style.padding = '16px'; memo.style.position = 'relative'; memo.style.background = 'var(--card, #fff)'; memo.style.borderRadius = '12px'; memo.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)';
  // Allow scroll for long content
  memo.style.maxHeight = '80vh';
  memo.style.overflow = 'auto';
  const close = document.createElement('button'); close.id = 'visitorMemoClose'; close.setAttribute('aria-label','Tutup memo'); close.textContent = '×'; close.style.position = 'absolute'; close.style.right = '12px'; close.style.top = '10px'; close.style.border = '0'; close.style.background = 'transparent'; close.style.fontWeight = '700'; close.style.cursor = 'pointer';
  const title = document.createElement('h3'); title.id = 'visitorMemoTitle'; title.style.marginTop = '0'; title.textContent = 'Makluman';
  const body = document.createElement('div'); body.className = 'small'; body.style.whiteSpace = 'pre-wrap'; body.style.marginTop = '6px'; body.style.lineHeight = '1.5';
  // support HTML messages when caller passes opts.html = true
  if (opts && opts.html) {
    try { body.innerHTML = message || 'Sila baca makluman ini sebelum isi borang.'; } catch(e) { body.textContent = message || 'Sila baca makluman ini sebelum isi borang.'; }
  } else {
    body.textContent = message || 'Sila baca makluman ini sebelum isi borang.';
  }
  if (opts && opts.imageSrc) {
    const img = document.createElement('img');
    img.src = opts.imageSrc;
    img.alt = 'Maklumat tambahan';
    img.style.display = 'block';
    img.style.maxWidth = '100%';
    img.style.marginTop = '10px';
    img.style.borderRadius = '8px';
    img.loading = 'lazy';
    // Fallback: if the provided image fails to load, try a known asset path and then hide
    img.addEventListener('error', () => {
      try {
        if (img._triedFallback) { img.style.display = 'none'; return; }
        img._triedFallback = true;
        img.src = 'assets/visitor_parking_charges.jpeg';
      } catch(e) { img.style.display = 'none'; }
    });
    // Click-to-zoom: open image in full-screen overlay
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => {
      try {
        const fullOverlay = document.createElement('div');
        fullOverlay.style.position = 'fixed';
        fullOverlay.style.inset = '0';
        fullOverlay.style.background = 'rgba(0,0,0,0.8)';
        fullOverlay.style.zIndex = '100000';
        fullOverlay.style.display = 'flex';
        fullOverlay.style.alignItems = 'center';
        fullOverlay.style.justifyContent = 'center';

        const bigImg = document.createElement('img');
        bigImg.src = img.src;
        bigImg.alt = img.alt || 'Imej';
        bigImg.style.maxWidth = '95vw';
        bigImg.style.maxHeight = '95vh';
        bigImg.style.borderRadius = '8px';
        bigImg.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
        bigImg.style.cursor = 'zoom-out';

        // Close interactions: click anywhere or press Escape
        const closeOverlay = () => { try { fullOverlay.remove(); } catch(e) {} };
        fullOverlay.addEventListener('click', closeOverlay);
        fullOverlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
        fullOverlay.tabIndex = 0; // allow key events

        fullOverlay.appendChild(bigImg);
        document.body.appendChild(fullOverlay);
        setTimeout(() => { try { fullOverlay.focus(); } catch(e) {} }, 0);
      } catch(e) { /* ignore click zoom errors */ }
    });
    body.appendChild(img);
  }
  const ok = document.createElement('button'); ok.className = 'btn'; ok.textContent = 'Saya faham'; ok.style.marginTop = '10px';
  memo.appendChild(close); memo.appendChild(title); memo.appendChild(body); memo.appendChild(ok); overlay.appendChild(memo); document.body.appendChild(overlay);
  const block = opts.blockUntilClose !== false; let formEl = null; try { formEl = document.getElementById('visitorForm') || document.querySelector('form'); } catch(e) {}
  if (block && formEl) {
    const blocker = document.createElement('div'); blocker.id = 'visitorFormBlocker'; blocker.style.position = 'absolute';
    const rect = formEl.getBoundingClientRect(); blocker.style.left = rect.left + window.scrollX + 'px'; blocker.style.top = rect.top + window.scrollY + 'px'; blocker.style.width = rect.width + 'px'; blocker.style.height = rect.height + 'px';
    blocker.style.background = 'rgba(255,255,255,0.0)'; blocker.style.zIndex = '9999'; blocker.style.cursor = 'not-allowed'; blocker.setAttribute('aria-hidden','true'); document.body.appendChild(blocker);
  }
  function dismiss(){ try { if (storageKey) localStorage.setItem(storageKey, '1'); } catch(e) {} try { overlay.remove(); } catch(e) {} try { const b = document.getElementById('visitorFormBlocker'); if (b) b.remove(); } catch(e) {} }
  close.addEventListener('click', dismiss); ok.addEventListener('click', dismiss);
}

// Field-level helpers for showing validation visually
function setFieldError(el, message) {
  if (!el) return;
  try { el.setAttribute('aria-invalid', 'true'); } catch (e) {}
  el.classList.add('input-error');
  if (typeof message === 'string') {
    try { el.setCustomValidity(message); } catch(e) {}
  }
}

function clearFieldError(el) {
  if (!el) return;
  try { el.removeAttribute('aria-invalid'); } catch (e) {}
  el.classList.remove('input-error');
  try { el.setCustomValidity(''); } catch(e) {}
}

// show a small inline status box nearest the input: render SVG icons (check / cross) for states
function updateUnitStatus(el) {
  if (!el) return;
  try {
    const wrap = el.closest('.autocomplete-wrap');
    const status = wrap ? wrap.querySelector('#hostUnitStatus') : document.getElementById('hostUnitStatus');
    if (!status) return;
    const v = (el.value || '').trim();
    if (!v) { status.style.display = 'none'; status.classList.remove('ok','err'); status.innerHTML = ''; status.setAttribute('aria-hidden','true'); status.removeAttribute('aria-label'); return; }
    const norm = normalizeUnitInput(v);
    if (!isPatternValidUnit(norm)) {
      // syntactically invalid -> red cross icon
      status.style.display = 'inline-flex'; status.classList.remove('ok'); status.classList.add('err');
      status.setAttribute('aria-hidden','false');
      status.setAttribute('aria-label','Format unit tidak sah');
      status.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.41 4.29 19.71 2.88 18.29 9.18 12 2.88 5.71 4.29 4.29 10.59 10.59 16.88 4.29z"/></svg>';
      return;
    }
    // syntactically valid — check whether unit exists in list
    if (units.includes(norm)) {
      // syntactically valid AND exists in list -> green check icon
      status.style.display = 'inline-flex'; status.classList.remove('err'); status.classList.add('ok');
      status.setAttribute('aria-hidden','false');
      status.setAttribute('aria-label','Unit ditemui');
      status.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false"><path d="M9.3 16.29L4.71 11.7l1.41-1.41L9.3 13.46l8.59-8.59L19.3 6.3 9.3 16.29z"/></svg>';
    } else {
      // syntactically valid but not found -> red cross icon
      status.style.display = 'inline-flex'; status.classList.remove('ok'); status.classList.add('err');
      status.setAttribute('aria-hidden','false');
      status.setAttribute('aria-label','Unit tidak ditemui');
      status.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.41 4.29 19.71 2.88 18.29 9.18 12 2.88 5.71 4.29 4.29 10.59 10.59 16.88 4.29z"/></svg>';
    }
  } catch (e) { /* ignore */ }
}

function showStatus(msg, ok=true){
  // Always clear the inline status area. If msg is empty -> also clear any active toasts.
  const statusEl = document.getElementById('statusMsg');
  try { if (statusEl) statusEl.innerHTML = ''; } catch(e) { console.warn('Failed to clear status message', e); }
  if (!msg) {
    // remove any lingering toasts
    clearAllToasts();
    return;
  }
  // show a toast for non-empty messages
  toast(msg, ok);
}

function validatePhone(phone){
  if (!phone) return true;
  const p = phone.replace(/\s+/g,'').replace(/[^0-9+]/g,'');
  return p.length >= 7 && p.length <= 15;
}

function normalizePhoneInput(raw){
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 12);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,7)}${digits.slice(7)}`;
}

function normalizeVehicleInput(raw){
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
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

function formatDateTimeLocal(ts){
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (!d || isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2,'0');
  const min = String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function computeArrearsCategory(amount){
  if (typeof amount !== 'number' || isNaN(amount)) return null;
  if (amount <= 1) return 1;
  if (amount <= 400) return 2;
  return 3;
}

function freeDaysForCategory(cat){
  if (cat === 1) return 3;
  if (cat === 2) return 1;
  return 0; // cat 3 and others default to none
}

function formatAmount(amount){
  if (typeof amount !== 'number' || !isFinite(amount)) return '0.00';
  try {
    return amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch (e) {
    return amount.toFixed(2);
  }
}

// Inline payment summary renderer (replaces popup)
let paymentSummaryRequestId = 0;

function renderPaymentUpdateNotice(lastUpdatedAt){
  if (!lastUpdatedAt) return '';
  const ts = formatDateTimeLocal(lastUpdatedAt) || '';
  const suffix = unitImportMetaLabel || '';
  return `
    <details class="payment-update-note">
      <summary>Nota Tunggakan dan Kemaskini Bayaran</summary>
      <div class="payment-update-note-body">
        <p>Kemaskini bagi rekod pembayaran dijalankan pada: <strong>${ts}${suffix}</strong>.</p>
        <p>Untuk makluman, senarai tunggakan yang dipaparkan di dalam lif ialah unit yang mempunyai tunggakan melebihi RM 400.00 ke atas. Unit yang ada tunggakan di bawah RM 400.00 masih dikira sebagai unit tunggakan, cuma tidak dipaparkan dalam senarai tersebut.</p>
        <p>Unit yang dikategorikan sebagai Tiada Tunggakan adalah unit yang menyelesaikan:</p>
        <ul>
          <li>Fi Penyelenggaraan sebelum bulan semasa.</li>
          <li>Insurans Kebakaran (selesai untuk tahun semasa).</li>
        </ul>
        <p><strong>Contoh:</strong><br>Bulan semasa: 31 Januari 2026<br>Fi penyelenggaraan: Fi Penyelenggaraan bulan Dis 2025 selesai</p>
        <p>Sebarang pembayaran atas talian (on-line), resit perlu dihantar melalui e-mail yang ditetapkan. Kegagalan membuat demikian akan menyebabkan rekod pembayaran tidak dapat dikemaskini.</p>
      </div>
    </details>
  `;
}

function resetPaymentSummary(msg){
  const summary = document.getElementById('paymentSummary');
  if (!summary) return;
  summary.innerHTML = msg || '<div class="muted-small">Pilih unit dan tarikh untuk melihat status tunggakan dan jumlah caj (jika ada).</div>';
}

function renderChargesSummary({ unit, unitSnapshot, etaDate, etdDate, category, stayOver = 'No', vehicleCount = 0, additionalVehicleEntries = [] }) {
  const summary = document.getElementById('paymentSummary');
  if (!summary) return;
  const hasSnapshot = !!unitSnapshot;
  const arrearsAmount = hasSnapshot ? unitSnapshot.arrearsAmount : null;
  const arrearsCat = hasSnapshot ? computeArrearsCategory(arrearsAmount) : null;
  const hasNegativeArrears = typeof arrearsAmount === 'number' && arrearsAmount < 0;
  const arrearsAmountFormatted = formatAmount(hasNegativeArrears ? 0 : arrearsAmount);
  const arrearsAmountDisplay = hasNegativeArrears ? 'RM 0.00 (Tiada tunggakan)' : `RM ${arrearsAmountFormatted}`;
  const isChargeableCategory = category === 'Pelawat' || category === 'Kontraktor';
  const isPelawatKhas = category === 'Pelawat Khas';
  const isPelawat = category === 'Pelawat';
  const isPelawatBermalam = isPelawat && stayOver === 'Yes';
  const extraVehicleCount = isPelawat ? Math.max(0, vehicleCount - 1) : 0;
  const additionalRateByCategory = { 1: 10, 2: 15, 3: 25 };
  const additionalRate = isPelawat ? (additionalRateByCategory[arrearsCat] || 0) : 0;
  const lastUpdatedAt = hasSnapshot ? (unitSnapshot.lastUpdatedAt || unitImportMetaTs || null) : (unitImportMetaTs || null);

  const fmtDate = (d) => {
    if (!d) return '-';
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };

  const fmtDateShort = (d) => {
    if (!d) return '-';
    const dd = d.getDate();
    const mm = d.getMonth() + 1;
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const unitHeader = (catLabel = '-') => [
    '<div class="pay-head">',
    '<div class="pay-title">Ringkasan Caj Parkir</div>',
    `<div class="pay-unit">Unit: <strong>${unit}</strong></div>`,
    `<div class="pay-category">${catLabel}</div>`,
    '</div>'
  ].join('');

  const infoRow = (label, value) => `<div class="pay-row"><span>${label}</span><strong>${value}</strong></div>`;

  if (!unit) {
    resetPaymentSummary();
    return;
  }

  if (!units.includes(unit)) {
    summary.innerHTML = '<div class="pay-alert">Unit tidak ditemui dalam senarai. Sila semak semula.</div>';
    return;
  }

  if (!hasSnapshot) {
    summary.innerHTML = '<div class="pay-alert">Memuat maklumat tunggakan unit...</div>';
    return;
  }

  if (!arrearsCat || arrearsCat === 1) {
    const free = freeDaysForCategory(1);
    const canChargeExtra = isPelawat && extraVehicleCount > 0;
    if (!canChargeExtra) {
      summary.innerHTML = [
        unitHeader('Kategori 1'),
        '<div class="pay-grid">',
        infoRow('Jumlah tunggakan', arrearsAmountDisplay),
        infoRow('Jumlah kenderaan', String(Math.max(1, vehicleCount || 0))),
        infoRow('Parkir percuma', `${free} hari`),
        infoRow('Kadar cas', 'RM 0.00 / hari'),
        '</div>',
        '<div class="pay-total-wrap">',
        '<div class="pay-note-line">Caj parkir pelawat: <strong>Percuma</strong></div>',
        '<div class="pay-grand-total">Jumlah perlu bayar: <strong>RM 0.00</strong></div>',
        '</div>',
        renderPaymentUpdateNotice(lastUpdatedAt)
      ].join('');
      return;
    }

    if (!etaDate) {
      summary.innerHTML = [
        unitHeader('Kategori 1'),
        '<div class="pay-grid">',
        infoRow('Jumlah tunggakan', arrearsAmountDisplay),
        infoRow('Jumlah kenderaan', String(Math.max(1, vehicleCount || 0))),
        infoRow('Parkir percuma', `${free} hari`),
        infoRow('Kadar kereta utama', 'RM 0.00 / hari'),
        infoRow('Kadar kenderaan tambahan', `RM ${additionalRate.toFixed(2)} / kereta / hari`),
        '</div>',
        '<div class="pay-note-line">Untuk Pelawat (Kategori 1), kenderaan utama percuma tetapi kenderaan tambahan dikenakan caj.</div>',
        '<div class="pay-note-line">Pilih tarikh masuk/keluar untuk kira caj sebenar.</div>',
        renderPaymentUpdateNotice(lastUpdatedAt)
      ].join('');
      return;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const start = etaDate;
    const end = etdDate || start;
    const totalDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
    const category1ExtraVehicleDetailLines = [];
    const extraVehicleAmount = additionalVehicleEntries.length
      ? additionalVehicleEntries.reduce((sum, item) => {
          const s = item.startDate || start;
          const e = item.endDate || s;
          const days = Math.max(1, Math.floor((e.getTime() - s.getTime()) / dayMs) + 1);
          const amount = days * additionalRate;
          category1ExtraVehicleDetailLines.push({
            plate: item.plate,
            start: s,
            days,
            amount
          });
          return sum + (days * additionalRate);
        }, 0)
      : (extraVehicleCount * totalDays * additionalRate);

    summary.innerHTML = [
      unitHeader('Kategori 1'),
      '<div class="pay-grid">',
      infoRow('Jumlah tunggakan', arrearsAmountDisplay),
      infoRow('Jumlah kenderaan', String(Math.max(1, vehicleCount || 0))),
      infoRow('Parkir percuma', `${free} hari`),
      infoRow('Kadar kereta utama', 'RM 0.00 / hari'),
      infoRow('Kadar kenderaan tambahan', `RM ${additionalRate.toFixed(2)} / kereta / hari`),
      infoRow('Julat tarikh', `${fmtDate(start)} hingga ${fmtDate(end)}`),
      '</div>',
      '<div class="pay-total-wrap">',
      `<div class="pay-grand-total">Jumlah perlu bayar: <strong>RM ${extraVehicleAmount.toFixed(2)}</strong></div>`,
      '<details class="pay-total-details">',
      '<summary>Lihat perincian bayaran</summary>',
      '<div class="pay-total-details-body">',
      '<details class="pay-charge-box">',
      `<summary><span class="pay-charge-title">Caj kenderaan utama</span><strong class="pay-charge-amount">RM 0.00</strong></summary>`,
      '<div class="pay-charge-body">',
      '<div class="pay-note-line">Kategori 1: kenderaan utama tidak dikenakan caj.</div>',
      '</div>',
      '</details>',
      '<details class="pay-charge-box">',
      `<summary><span class="pay-charge-title">Caj kenderaan tambahan</span><strong class="pay-charge-amount">RM ${extraVehicleAmount.toFixed(2)}</strong></summary>`,
      '<div class="pay-charge-body">',
      '<div class="pay-breakdown-title">Perincian bayaran</div>',
      `<div class="pay-note-line">${extraVehicleCount} kereta x hari penggunaan x RM ${additionalRate.toFixed(2)} = <strong>RM ${extraVehicleAmount.toFixed(2)}</strong></div>`,
      (category1ExtraVehicleDetailLines.length
        ? `<ul class="arrears-payment-list pay-daily-list">${category1ExtraVehicleDetailLines.map((item) => {
            const dayLines = [];
            for (let i = 0; i < item.days; i++) {
              const d = new Date(item.start.getTime());
              d.setDate(d.getDate() + i);
              dayLines.push(`<li>- ${fmtDateShort(d)} : <strong>RM ${additionalRate.toFixed(2)}</strong></li>`);
            }
            return `<li><strong>${item.plate}</strong><ul class="pay-plate-day-list">${dayLines.join('')}</ul></li>`;
          }).join('')}</ul>`
        : ''),
      '</div>',
      '</details>',
      '</div>',
      '</details>',
      '</div>',
      renderPaymentUpdateNotice(lastUpdatedAt)
    ].join('');
    return;
  }

  if (isPelawatKhas) {
    const pelawatKhasRateByCategory = { 1: 5, 2: 8, 3: 15 };
    const ratePerCar = pelawatKhasRateByCategory[arrearsCat] || 0;
    const dayMs = 24 * 60 * 60 * 1000;
    const start = etaDate || null;
    const end = etdDate || start;
    const totalDays = (start && end)
      ? Math.max(1, Math.floor((end.getTime() - start.getTime()) / dayMs) + 1)
      : 1;
    const totalCars = Math.max(1, vehicleCount || 0);
    const mainAmount = totalCars > 0 ? (ratePerCar * totalDays) : 0;
    const extraCars = Math.max(0, totalCars - 1);
    let extraAmount = 0;
    const extraPlateLines = [];

    if (additionalVehicleEntries.length > 0) {
      extraAmount = additionalVehicleEntries.reduce((sum, item) => {
        const s = item.startDate || start;
        const e = item.endDate || s;
        const days = (s && e) ? Math.max(1, Math.floor((e.getTime() - s.getTime()) / dayMs) + 1) : totalDays;
        const amount = days * ratePerCar;
        extraPlateLines.push({ plate: item.plate, days, amount });
        return sum + amount;
      }, 0);
    } else {
      extraAmount = extraCars * totalDays * ratePerCar;
      for (let i = 0; i < extraCars; i++) {
        extraPlateLines.push({ plate: `Kenderaan ${i + 2}`, days: totalDays, amount: totalDays * ratePerCar });
      }
    }

    const totalAmount = mainAmount + extraAmount;

    summary.innerHTML = [
      unitHeader(`Kategori ${arrearsCat}`),
      '<div class="pay-grid">',
      infoRow('Jumlah tunggakan', arrearsAmountDisplay),
      infoRow('Kategori kemasukan', 'Pelawat Khas'),
      infoRow('Jumlah kenderaan', String(totalCars)),
      infoRow('Kadar caj', `RM ${ratePerCar.toFixed(2)} / kereta / hari`),
      infoRow('Tarikh masuk', etaDate ? fmtDate(etaDate) : '-'),
      '</div>',
      '<div class="pay-total-wrap">',
      `<div class="pay-grand-total">Jumlah perlu bayar: <strong>RM ${totalAmount.toFixed(2)}</strong></div>`,
      '<details class="pay-total-details">',
      '<summary>Lihat perincian bayaran</summary>',
      '<div class="pay-total-details-body">',
      '<details class="pay-charge-box">',
      `<summary><span class="pay-charge-title">Caj kenderaan utama</span><strong class="pay-charge-amount">RM ${mainAmount.toFixed(2)}</strong></summary>`,
      '<div class="pay-charge-body">',
      `<div class="pay-note-line">1 kereta x ${totalDays} hari x RM ${ratePerCar.toFixed(2)} = <strong>RM ${mainAmount.toFixed(2)}</strong></div>`,
      '</div>',
      '</details>',
      '<details class="pay-charge-box">',
      `<summary><span class="pay-charge-title">Caj kenderaan tambahan</span><strong class="pay-charge-amount">RM ${extraAmount.toFixed(2)}</strong></summary>`,
      '<div class="pay-charge-body">',
      '<div class="pay-breakdown-title">Perincian bayaran</div>',
      (extraCars > 0
        ? `<div class="pay-note-line">${extraCars} kereta x hari penggunaan x RM ${ratePerCar.toFixed(2)} = <strong>RM ${extraAmount.toFixed(2)}</strong></div><ul class="arrears-payment-list pay-daily-list">${extraPlateLines.map((item) => `<li>${item.plate}: ${item.days} hari x RM ${ratePerCar.toFixed(2)} = <strong>RM ${item.amount.toFixed(2)}</strong></li>`).join('')}</ul>`
        : '<div class="pay-note-line">Tiada caj kenderaan tambahan.</div>'),
      '</div>',
      '</details>',
      '</div>',
      '</details>',
      '</div>',
      renderPaymentUpdateNotice(lastUpdatedAt)
    ].join('');
    return;
  }

  if (!isChargeableCategory) {
    summary.innerHTML = [
      unitHeader(`Kategori ${arrearsCat}`),
      '<div class="pay-grid">',
      infoRow('Jumlah tunggakan', arrearsAmountDisplay),
      infoRow('Kategori kemasukan', category || '-'),
      '</div>',
      '<div class="pay-note-line">Caj parkir hanya dikenakan untuk kategori Pelawat atau Kontraktor. Tiada caj dikira untuk kategori ini.</div>',
      renderPaymentUpdateNotice(lastUpdatedAt)
    ].join('');
    return;
  }

  if (!etaDate) {
    const extraNote = (isPelawat && extraVehicleCount > 0)
      ? `<div class="pay-note-line">Tambahan kenderaan pelawat: <strong>${extraVehicleCount}</strong> (kadar tambahan RM ${additionalRate.toFixed(2)} / kereta / hari).</div>`
      : '';
    summary.innerHTML = [
      unitHeader(`Kategori ${arrearsCat}`),
      '<div class="pay-grid">',
      infoRow('Jumlah tunggakan', arrearsAmountDisplay),
      infoRow('Jumlah kenderaan', String(Math.max(1, vehicleCount || 0))),
      infoRow('Parkir percuma', `${freeDaysForCategory(arrearsCat)} hari`),
      infoRow('Kadar cas', arrearsCat === 2 ? 'RM 5.00 / hari' : 'RM 15.00 / hari'),
      (isPelawat ? infoRow('Kadar kenderaan tambahan', `RM ${additionalRate.toFixed(2)} / kereta / hari`) : ''),
      '</div>',
      '<div class="pay-note-line">Pilih tarikh masuk/keluar untuk kira caj sebenar.</div>',
      extraNote,
      renderPaymentUpdateNotice(lastUpdatedAt)
    ].join('');
    return;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const start = etaDate;
  const end = etdDate || start;
  const totalDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
  const freeDays = Math.max(0, Math.min(freeDaysForCategory(arrearsCat), totalDays));
  const rate = arrearsCat === 2 ? 5 : 15;
  const chargedDays = Math.max(0, totalDays - freeDays);
  const firstVehicleAmount = chargedDays * rate;
  // For Pelawat Bermalam, additional vehicles use a separate rate by arrears category.
  let extraVehicleAmount = 0;
  let extraVehicleDetailLines = [];
  if (isPelawat && extraVehicleCount > 0) {
    if (additionalVehicleEntries.length > 0) {
      extraVehicleAmount = additionalVehicleEntries.reduce((sum, item) => {
        const s = item.startDate || start;
        const e = item.endDate || s;
        const days = Math.max(1, Math.floor((e.getTime() - s.getTime()) / dayMs) + 1);
        const amount = days * additionalRate;
        extraVehicleDetailLines.push({
          plate: item.plate,
          start: s,
          end: e,
          days,
          amount
        });
        return sum + amount;
      }, 0);
    } else {
      extraVehicleAmount = extraVehicleCount * totalDays * additionalRate;
    }
  }
  const totalAmount = firstVehicleAmount + extraVehicleAmount;

  const rows = [];
  for (let i=0; i<totalDays; i++) {
    const d = new Date(start.getTime()); d.setDate(d.getDate() + i);
    const label = i < freeDays ? 'Percuma' : `RM ${rate.toFixed(2)}`;
    rows.push(`<li>${fmtDate(d)} : <strong>${label}</strong></li>`);
  }

  summary.innerHTML = [
    unitHeader(`Kategori ${arrearsCat}`),
    '<div class="pay-grid">',
    infoRow('Jumlah tunggakan', arrearsAmountDisplay),
    infoRow('Jumlah kenderaan', String(Math.max(1, vehicleCount || 0))),
    infoRow('Parkir percuma', `${freeDays} hari`),
    infoRow('Kadar cas', `RM ${rate.toFixed(2)} / hari`),
    (isPelawat ? infoRow('Kadar kenderaan tambahan', `RM ${additionalRate.toFixed(2)} / kereta / hari`) : ''),
    infoRow('Julat tarikh', `${fmtDate(start)} hingga ${fmtDate(end)}`),
    '</div>',
    '<div class="pay-total-wrap">',
    `<div class="pay-grand-total">Jumlah perlu bayar: <strong>RM ${totalAmount.toFixed(2)}</strong></div>`,
    '<details class="pay-total-details">',
    '<summary>Lihat perincian bayaran</summary>',
    '<div class="pay-total-details-body">',
    '<details class="pay-charge-box">',
    `<summary><span class="pay-charge-title">Caj kenderaan utama</span><strong class="pay-charge-amount">RM ${firstVehicleAmount.toFixed(2)}</strong></summary>`,
    '<div class="pay-charge-body">',
    `<div class="pay-note-line">${chargedDays} hari bercaj x RM ${rate.toFixed(2)} = <strong>RM ${firstVehicleAmount.toFixed(2)}</strong></div>`,
    `<ul class="arrears-payment-list pay-daily-list">${rows.join('')}</ul>`,
    '</div>',
    '</details>',
    '<details class="pay-charge-box">',
    `<summary><span class="pay-charge-title">Caj kenderaan tambahan</span><strong class="pay-charge-amount">RM ${extraVehicleAmount.toFixed(2)}</strong></summary>`,
    '<div class="pay-charge-body">',
    '<div class="pay-breakdown-title">Perincian bayaran</div>',
    (isPelawat && extraVehicleCount > 0
      ? `<div class="pay-note-line">${extraVehicleCount} kereta x hari penggunaan x RM ${additionalRate.toFixed(2)} = <strong>RM ${extraVehicleAmount.toFixed(2)}</strong></div>${extraVehicleDetailLines.length ? `<ul class="arrears-payment-list pay-daily-list">${extraVehicleDetailLines.map((item) => {
          const dayLines = [];
          for (let i = 0; i < item.days; i++) {
            const d = new Date(item.start.getTime());
            d.setDate(d.getDate() + i);
            dayLines.push(`<li>- ${fmtDateShort(d)} : <strong>RM ${additionalRate.toFixed(2)}</strong></li>`);
          }
          return `<li><strong>${item.plate}</strong><ul class="pay-plate-day-list">${dayLines.join('')}</ul></li>`;
        }).join('')}</ul>` : ''}`
      : '<div class="pay-note-line">Tiada caj kenderaan tambahan.</div>'),
    '</div>',
    '</details>',
    '</div>',
    '</details>',
    '</div>',
    renderPaymentUpdateNotice(lastUpdatedAt)
  ].join('');
}

async function updatePaymentSummary(){
  const summary = document.getElementById('paymentSummary');
  const unitInput = document.getElementById('hostUnit');
  if (!summary || !unitInput) return;

  const unitVal = normalizeUnitInput(unitInput.value || '');
  const categoryEl = document.getElementById('category');
  const stayOverEl = document.getElementById('stayOver');
  const etaEl = document.getElementById('eta');
  const etdEl = document.getElementById('etd');
  const category = categoryEl?.value || '';
  const stayOver = stayOverEl?.value || 'No';
  const singleVehicleNo = normalizeVehicleInput(document.getElementById('vehicleNo')?.value || '');
  const multiVehicleNumbers = getVehicleNumbersFromList().map(v => normalizeVehicleInput(v)).filter(Boolean);
  const additionalVehicleEntriesRaw = (category === 'Pelawat Khas' || category === 'Pelawat') ? getAdditionalVehicleEntries() : [];
  const additionalVehicleEntries = additionalVehicleEntriesRaw.filter(v => v.plate && v.plate !== singleVehicleNo);
  const allowMultiVehicle = category === 'Pelawat Khas' || category === 'Pelawat';
  const combinedVehicleNumbers = allowMultiVehicle
    ? Array.from(new Set([...multiVehicleNumbers, singleVehicleNo].filter(Boolean)))
    : (singleVehicleNo ? [singleVehicleNo] : []);
  const vehicleCount = combinedVehicleNumbers.length;
  const etaDate = etaEl?.value ? dateFromInputDateOnly(etaEl.value) : null;
  // For Pelawat with Tidak Bermalam, treat ETD as ETA
  let etdDate = etdEl?.value ? dateFromInputDateOnly(etdEl.value) : null;
  if (category === 'Pelawat' && stayOver !== 'Yes') etdDate = etaDate;

  if (!unitVal) { resetPaymentSummary(); currentUnitId = ''; currentUnitSnapshot = null; return; }
  if (!units.includes(unitVal)) { renderChargesSummary({ unit: unitVal, unitSnapshot: null, etaDate, etdDate, category, stayOver, vehicleCount, additionalVehicleEntries }); return; }

  const reqId = ++paymentSummaryRequestId;
  if (currentUnitId !== unitVal) {
    summary.innerHTML = '<div class="small">Memuat maklumat unit...</div>';
    try {
      const snap = await (async () => {
        if (!window.__FIRESTORE) return null;
        const unitRef = doc(window.__FIRESTORE, 'units', unitVal);
        const udoc = await getDoc(unitRef);
        return (udoc && udoc.exists()) ? udoc.data() : null;
      })();
      if (reqId !== paymentSummaryRequestId) return; // stale
      currentUnitId = unitVal;
      currentUnitSnapshot = snap;
    } catch (e) {
      if (reqId !== paymentSummaryRequestId) return;
      console.warn('Gagal memuat unit snapshot', e);
      currentUnitSnapshot = null;
    }
  }

  if (reqId !== paymentSummaryRequestId) return;
  renderChargesSummary({ unit: unitVal, unitSnapshot: currentUnitSnapshot, etaDate, etdDate, category, stayOver, vehicleCount, additionalVehicleEntries });
}

function showUnitNoticeModal({ category, amount, eta, etd, visitorCategory, lastUpdatedAt }){
  return new Promise((resolve) => {
    try { const prev = document.getElementById('unitNoticeOverlay'); if (prev) prev.remove(); } catch(e) {}
    const overlay = document.createElement('div');
    overlay.id = 'unitNoticeOverlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.4)';
    overlay.style.zIndex = '100000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('role','dialog');
    card.setAttribute('aria-modal','true');
    card.setAttribute('aria-labelledby','unitNoticeTitle');
    card.style.background = 'var(--card, #fff)';
    card.style.padding = '18px';
    card.style.borderRadius = '12px';
    card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
    card.style.maxWidth = '520px';
    card.style.width = '94%';

    const title = document.createElement('h3');
    title.id = 'unitNoticeTitle';
    title.textContent = 'Makluman Tunggakan';
    title.style.marginTop = '0';

    const body = document.createElement('div');
    body.className = 'small';
    body.style.lineHeight = '1.55';
    const freeDays = freeDaysForCategory(category);
    const freeText = freeDays > 0 ? `${freeDays} hari` : 'Tiada';

    // calculate payment breakdown when ETA/ETD provided and only for Pelawat/Kontraktor
    let paymentHtml = '';
    try {
      const visitorAllowed = (visitorCategory && (visitorCategory === 'Pelawat' || visitorCategory === 'Kontraktor')) ? true : false;
      // helper: convert to Date (date-only) if possible
      const toDateOnly = (d) => {
        if (!d) return null;
        let dt = null;
        try { dt = (d && d.toDate) ? d.toDate() : (d instanceof Date ? d : new Date(d)); } catch(e) { dt = null; }
        if (!dt || isNaN(dt.getTime())) return null;
        const dd = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(),0,0,0,0);
        return dd;
      };
      const start = toDateOnly(eta);
      const end = toDateOnly(etd) || start;
      if (visitorAllowed && start && end && end.getTime() >= start.getTime() && (category === 2 || category === 3)) {
        // rates: category 2 -> RM5/day, category 3 -> RM15/day
        const rateMap = { 2: 5, 3: 15 };
        const rate = rateMap[category] || 0;
        const dayMs = 24 * 60 * 60 * 1000;
        const totalDays = Math.floor((end.getTime() - start.getTime()) / dayMs) + 1;
        const free = Math.max(0, Math.min(freeDays, totalDays));
        const chargedDays = Math.max(0, totalDays - free);
        let totalAmount = chargedDays * rate;

        // build per-day breakdown
        const rows = [];
        for (let i=0;i<totalDays;i++){
          const d = new Date(start.getTime()); d.setDate(d.getDate() + i);
          const dd = String(d.getDate()).padStart(2,'0');
          const mm = String(d.getMonth()+1).padStart(2,'0');
          const yyyy = d.getFullYear();
          const label = (i < free) ? 'Percuma' : `RM ${rate.toFixed(2)}`;
          rows.push(`${dd}/${mm}/${yyyy} = ${label}`);
        }

        paymentHtml = `\n<p class="arrears-payment"><strong>Perincian caj:</strong></p>\n<ul class="arrears-payment-list small muted" style="margin-top:6px">${rows.map(r => `<li style=\"margin-bottom:4px\">${r}</li>`).join('')}</ul>\n<p class="arrears-payment-total"><strong>Jumlah pembayaran : RM ${totalAmount.toFixed(2)}</strong></p>`;
      } else if (!visitorAllowed) {
        paymentHtml = `\n<p class="arrears-payment small muted"><em>Nota: Caj hanya dikenakan untuk kategori Pelawat atau Kontraktor.</em></p>`;
      }
    } catch(e) { /* ignore calculation errors */ }

    const updatedText = lastUpdatedAt ? (formatDateTimeLocal(lastUpdatedAt) || null) : null;

    body.innerHTML = [
      '<p>Untuk makluman, unit ini mempunyai tunggakan. (Sila rujuk kepada pihak pengurusan untuk dapatkan tunggakan terkini)</p>',
      `<p><strong>Jumlah hari yang di benarkan parkir percuma : ${freeText}</strong></p>`,
      `<p><strong>Kategori Unit Tunggakan : <span class="arrears-category">Kategori ${category}</span></strong></p>`,
      paymentHtml ? paymentHtml : '',
      updatedText ? `<p class="small muted" style="margin-top:6px">Tarikh kemas kini tunggakan: <strong>${updatedText}</strong></p>` : '',
      '<p>Sekiranya pemohon ingin meneruskan menggunakan perkhidmatan petak parkir pelawat, pihak pengurusan akan mengenakan caj berdasarkan jadual yang ditetapkan.</p>'
    ].join('');


    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.marginTop = '14px';
    actions.style.justifyContent = 'flex-end';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-ghost';
    cancel.textContent = 'Batal';
    cancel.addEventListener('click', () => { try { overlay.remove(); } catch(e) {} resolve(false); });

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn';
    ok.textContent = 'Saya faham, teruskan';
    ok.addEventListener('click', () => { try { overlay.remove(); } catch(e) {} resolve(true); });

    actions.appendChild(cancel);
    actions.appendChild(ok);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    try { ok.focus(); } catch(e) {}
  });
}

/* ---------- duplicate submission check ---------- */
/*
 * Transaction-based dedupe + create response
 * This creates a small dedupe key document (collection: 'dedupeKeys') and
 * the response document in the same transaction using deterministic ids.
 * This keeps reads to a minimum (one read for the dedupe key) and guarantees
 * uniqueness even under concurrent attempts.
 */
function _shortId(){ return Math.random().toString(36).slice(2,9); }

function getOrCreateAmendToken(hostUnitId, dateKey) {
  const key = `amendToken:${hostUnitId}:${dateKey}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const generated = `${_shortId()}${_shortId()}${Date.now().toString(36)}`;
    localStorage.setItem(key, generated);
    return generated;
  } catch (e) {
    return `${_shortId()}${_shortId()}`;
  }
}

function collectVehicleSetFromPayloadLike(src) {
  const arr = Array.isArray(src && src.vehicleNumbers) ? src.vehicleNumbers : [];
  const out = arr.map(v => normalizeVehicleInput(v)).filter(Boolean);
  if (!out.length && src && src.vehicleNo) {
    const v = normalizeVehicleInput(src.vehicleNo);
    if (v) out.push(v);
  }
  return out;
}

function _toDateOnly(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (!d || isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

async function createResponseWithDedupe(payload){
  if (!window.__FIRESTORE) throw new Error('Firestore not available');

  const etaDate = payload && payload.eta && payload.eta.toDate ? payload.eta.toDate() : null;
  if (!etaDate || isNaN(etaDate.getTime())) {
    const e = new Error('Invalid ETA');
    e.code = 'INVALID_ETA';
    throw e;
  }

  const dateKey = clientIsoDateOnlyKey(etaDate);
  const hostUnitId = String(payload.hostUnit || '').replace(/\s+/g, '');
  const phoneNorm = String(payload.visitorPhone || '').replace(/[^0-9+]/g, '');
  const nameKey = payload.visitorName ? String(payload.visitorName).trim().toLowerCase().replace(/\s+/g, '_').slice(0, 64) : '';
  const dedupeIdentity = phoneNorm || nameKey || 'noid';
  const dedupeKey = `dedupe-${dateKey}_${hostUnitId}_${dedupeIdentity}`;

  const responseId = `resp-${Date.now()}-${_shortId()}`;
  const dedupeRef = doc(window.__FIRESTORE, 'dedupeKeys', dedupeKey);
  const respRef = doc(window.__FIRESTORE, 'responses', responseId);

  async function writeDirectFallback() {
    const fallbackPayload = Object.assign({}, payload, {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await setDoc(respRef, fallbackPayload);
    return { success: true, id: responseId, fallback: true, amended: false };
  }

  const category = String(payload.category || '').trim();
  const stayOver = String(payload.stayOver || 'No').trim();
  // Apply anti-split lock for all Pelawat submissions (Bermalam and Tidak Bermalam).
  const enforcePelawatLock = category === 'Pelawat';
  const lockRef = doc(window.__FIRESTORE, 'overnightLocks', `unit-${hostUnitId}`);
  const etaStart = _toDateOnly(etaDate);
  const etdDate = payload && payload.etd && payload.etd.toDate ? payload.etd.toDate() : null;
  const etaEnd = _toDateOnly(etdDate) || etaStart;
  const amendToken = payload && payload.amendToken ? String(payload.amendToken) : getOrCreateAmendToken(hostUnitId, dateKey);

  if (dedupeTransactionUnavailable) {
    try {
      return await writeDirectFallback();
    } catch (fallbackErr) {
      const e = new Error('fallback_failed');
      e.code = String(fallbackErr && fallbackErr.code ? fallbackErr.code : 'FALLBACK_FAILED');
      e.message = fallbackErr && fallbackErr.message ? fallbackErr.message : 'Fallback write failed';
      throw e;
    }
  }

  try {
    let amended = false;
    let finalResponseId = responseId;
    await runTransaction(window.__FIRESTORE, async (tx) => {
      let targetRespId = responseId;
      let targetRespRef = respRef;

      const dedupeSnap = await tx.get(dedupeRef);
      if (dedupeSnap.exists()) {
        const existing = dedupeSnap.data() || {};
        const existingTs = existing.createdAt && existing.createdAt.toDate ? existing.createdAt.toDate() : null;
        if (existingTs) {
          const ageMs = Date.now() - existingTs.getTime();
          if (ageMs < CLIENT_DEDUPE_WINDOW_MIN * 60 * 1000) {
            if (existing.responseId && existing.amendToken === amendToken) {
              targetRespId = existing.responseId;
              targetRespRef = doc(window.__FIRESTORE, 'responses', targetRespId);
              amended = true;
              finalResponseId = targetRespId;
            } else {
              const err = new Error('duplicate');
              err.code = 'DUPLICATE';
              throw err;
            }
          }
        }
      }

      if (enforcePelawatLock && etaStart && etaEnd) {
        const lockSnap = await tx.get(lockRef);
        if (lockSnap.exists()) {
          const lock = lockSnap.data() || {};
          const lockStart = _toDateOnly(lock.startDate && lock.startDate.toDate ? lock.startDate.toDate() : lock.startDate);
          const lockEnd = _toDateOnly(lock.endDate && lock.endDate.toDate ? lock.endDate.toDate() : lock.endDate);
          if (lockStart && lockEnd) {
            const overlap = etaStart.getTime() <= lockEnd.getTime() && lockStart.getTime() <= etaEnd.getTime();
            if (overlap) {
              if (lock.responseId && lock.amendToken === amendToken) {
                targetRespId = lock.responseId;
                targetRespRef = doc(window.__FIRESTORE, 'responses', targetRespId);
                amended = true;
                finalResponseId = targetRespId;
              } else {
                const err = new Error('combine_vehicle_registration_required');
                err.code = 'COMBINE_REQUIRED';
                throw err;
              }
            }
          }
        }

        tx.set(lockRef, {
          unit: hostUnitId,
          startDate: Timestamp.fromDate(etaStart),
          endDate: Timestamp.fromDate(etaEnd),
          category,
          stayOver,
          responseId: targetRespId,
          amendToken,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      tx.set(dedupeRef, {
        responseId: targetRespId,
        hostUnit: payload.hostUnit || '',
        visitorPhone: payload.visitorPhone || '',
        visitorName: payload.visitorName || '',
        etaDate: dateKey,
        amendToken,
        createdAt: serverTimestamp()
      });

      const docPayload = Object.assign({}, payload, {
        amendToken,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (!amended) {
        tx.set(targetRespRef, docPayload);
      } else {
        const existingRespSnap = await tx.get(targetRespRef);
        if (!existingRespSnap.exists()) {
          const err = new Error('response_not_found_for_amend');
          err.code = 'AMEND_TARGET_NOT_FOUND';
          throw err;
        }
        const existingResp = existingRespSnap.data() || {};
        const existingVehicles = collectVehicleSetFromPayloadLike(existingResp);
        const incomingVehicles = collectVehicleSetFromPayloadLike(docPayload);
        const shouldMergeVehicles = String(docPayload.stayOver || 'No') === 'Yes';
        const mergedVehicles = shouldMergeVehicles
          ? Array.from(new Set([...existingVehicles, ...incomingVehicles]))
          : incomingVehicles;

        const amendedPayload = Object.assign({}, existingResp, docPayload, {
          createdAt: existingResp.createdAt || docPayload.createdAt,
          updatedAt: serverTimestamp(),
          amendToken,
          vehicleNumbers: mergedVehicles,
          vehicleNo: mergedVehicles.length ? mergedVehicles[0] : (docPayload.vehicleNo || '')
        });
        tx.update(targetRespRef, amendedPayload);
      }
    });
    return { success: true, id: finalResponseId, fallback: false, amended };
  } catch (err) {
    const code = err && err.code ? String(err.code) : '';
    const msg = String(err && (err.message || err)).toLowerCase();
    if (code === 'DUPLICATE' || msg.includes('duplicate') || msg.includes('already-exists')) {
      const e = new Error('duplicate'); e.code = 'DUPLICATE'; throw e;
    }
    if (code === 'COMBINE_REQUIRED' || msg.includes('combine_vehicle_registration_required')) {
      const e = new Error('combine_vehicle_registration_required');
      e.code = 'COMBINE_REQUIRED';
      throw e;
    }

    // Backward-compatible safety net: if new transaction paths are denied by old rules,
    // still allow a direct response write so users can submit while rules are being deployed.
    if (code.toLowerCase().includes('permission') || msg.includes('permission-denied')) {
      dedupeTransactionUnavailable = true;
      try {
        return await writeDirectFallback();
      } catch (fallbackErr) {
        const e = new Error('fallback_failed');
        e.code = String(fallbackErr && fallbackErr.code ? fallbackErr.code : 'FALLBACK_FAILED');
        e.message = fallbackErr && fallbackErr.message ? fallbackErr.message : 'Fallback write failed';
        throw e;
      }
    }

    const e = new Error('transaction_failed');
    e.code = code || 'TRANSACTION_FAILED';
    e.message = err && err.message ? err.message : 'Transaction failed';
    throw e;
  }
}

// Client-side duplicate protection: keep last-submission fingerprints in localStorage
// so we can prevent accidental immediate re-submits (improves UX). This is a
// convenience layer only; server-side checks are authoritative.
// Client-side guard: block rapid repeat submits within 2 minutes (matches server)
const CLIENT_DEDUPE_WINDOW_MIN = 2;
function clientIsoDateOnlyKey(d) {
  if (!d) return null;
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}

function clientFingerprintForSubmission({ etaDate, hostUnit, visitorPhone, visitorName }){
  const dateKey = etaDate ? clientIsoDateOnlyKey(etaDate) : 'null';
  const unitKey = (hostUnit || '').replace(/\s+/g, '') || 'null';
  const phone = (visitorPhone || '').replace(/[^0-9+]/g, '') || '';
  const nameKey = visitorName ? String(visitorName).trim().toLowerCase().replace(/\s+/g,'_').slice(0,64) : '';
  const idKey = phone || nameKey || 'noid';
  return `${dateKey}|${unitKey}|${idKey}`;
}

function clientIsDuplicateRecently(fingerprint){
  try {
    const key = `lastSubmission:${fingerprint}`;
    const raw = localStorage.getItem(key);
    if (!raw) return { duplicate: false };
    const ts = Number(raw);
    if (isNaN(ts)) return { duplicate: false };
    const age = Date.now() - ts;
    const windowMs = CLIENT_DEDUPE_WINDOW_MIN * 60 * 1000;
    if (age < windowMs) return { duplicate: true, age, remainingMs: windowMs - age };
    return { duplicate: false };
  } catch (e) { return { duplicate: false }; }
}

function clientMarkSubmission(fingerprint){
  try { localStorage.setItem(`lastSubmission:${fingerprint}`, String(Date.now())); } catch (e) { /* ignore */ }
}

/* ---------- vehicle helpers ---------- */
function createVehicleRow(value=''){
  const rowSeed = (value && typeof value === 'object') ? value : { plate: value };
  const wrapper = document.createElement('div');
  wrapper.className = 'vehicle-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'ABC1234';
  input.value = normalizeVehicleInput(rowSeed.plate || '');
  input.className = 'vehicle-input';
  input.setAttribute('aria-label','Nombor kenderaan');
  input.addEventListener('input', () => {
    input.value = normalizeVehicleInput(input.value);
    try { updatePaymentSummary(); } catch (e) { /* ignore */ }
  });

  const titleRow = document.createElement('div');
  titleRow.className = 'vehicle-row-title';

  const title = document.createElement('div');
  title.className = 'vehicle-row-heading';
  title.textContent = 'Kenderaan Tambahan (2)';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'vehicle-remove btn-ghost';
  removeBtn.textContent = '−';
  removeBtn.title = 'Keluarkan baris';
  removeBtn.setAttribute('aria-label','Keluarkan nombor kenderaan');
  removeBtn.addEventListener('click', () => {
    wrapper.remove();
    refreshVehicleRowIndices();
    try { updatePaymentSummary(); } catch (e) { /* ignore */ }
  });

  titleRow.appendChild(title);
  titleRow.appendChild(removeBtn);

  const visitorNameGroup = document.createElement('div');
  visitorNameGroup.className = 'vehicle-field-group';
  const visitorNameLabel = document.createElement('label');
  visitorNameLabel.className = 'vehicle-field-label';
  visitorNameLabel.textContent = 'Nama pelawat';
  const visitorNameInput = document.createElement('input');
  visitorNameInput.type = 'text';
  visitorNameInput.className = 'vehicle-visitor-name-input';
  visitorNameInput.placeholder = 'Nama pelawat';
  visitorNameInput.value = (rowSeed.visitorName || '').trim();
  visitorNameGroup.appendChild(visitorNameLabel);
  visitorNameGroup.appendChild(visitorNameInput);

  const visitorPhoneGroup = document.createElement('div');
  visitorPhoneGroup.className = 'vehicle-field-group';
  const visitorPhoneLabel = document.createElement('label');
  visitorPhoneLabel.className = 'vehicle-field-label';
  visitorPhoneLabel.textContent = 'Nombor telefon pelawat';
  const visitorPhoneInput = document.createElement('input');
  visitorPhoneInput.type = 'tel';
  visitorPhoneInput.inputMode = 'tel';
  visitorPhoneInput.className = 'vehicle-visitor-phone-input';
  visitorPhoneInput.placeholder = '012-3456789';
  visitorPhoneInput.value = normalizePhoneInput(rowSeed.visitorPhone || '');
  visitorPhoneGroup.appendChild(visitorPhoneLabel);
  visitorPhoneGroup.appendChild(visitorPhoneInput);

  const plateGroup = document.createElement('div');
  plateGroup.className = 'vehicle-field-group';
  const plateLabel = document.createElement('label');
  plateLabel.className = 'vehicle-field-label';
  plateLabel.textContent = 'Nombor Kenderaan';
  plateGroup.appendChild(plateLabel);
  plateGroup.appendChild(input);

  const dateWrap = document.createElement('div');
  dateWrap.className = 'vehicle-extra-date-wrap hidden';

  const startDate = document.createElement('input');
  startDate.type = 'date';
  startDate.className = 'vehicle-extra-start';
  startDate.setAttribute('aria-label','Tarikh masuk kenderaan tambahan');

  const endDate = document.createElement('input');
  endDate.type = 'date';
  endDate.className = 'vehicle-extra-end';
  endDate.setAttribute('aria-label','Tarikh keluar kenderaan tambahan');

  const inGroup = document.createElement('div');
  inGroup.className = 'vehicle-field-group';
  const inLabel = document.createElement('label');
  inLabel.className = 'vehicle-field-label';
  inLabel.textContent = 'Tarikh masuk';
  inGroup.appendChild(inLabel);
  inGroup.appendChild(startDate);

  const outGroup = document.createElement('div');
  outGroup.className = 'vehicle-field-group';
  const outLabel = document.createElement('label');
  outLabel.className = 'vehicle-field-label';
  outLabel.textContent = 'Tarikh keluar';
  outGroup.appendChild(outLabel);
  outGroup.appendChild(endDate);

  const syncLabel = document.createElement('label');
  syncLabel.className = 'vehicle-date-sync';
  const syncCheck = document.createElement('input');
  syncCheck.type = 'checkbox';
  syncCheck.className = 'vehicle-date-sync-check';
  syncCheck.checked = rowSeed.useMainDate !== false;
  const syncSwitch = document.createElement('span');
  syncSwitch.className = 'vehicle-date-sync-switch';
  syncSwitch.setAttribute('aria-hidden', 'true');
  const syncText = document.createElement('span');
  syncText.className = 'vehicle-date-sync-text';
  syncText.textContent = 'Guna tarikh sama seperti Kenderaan Pertama (1)';
  syncLabel.appendChild(syncCheck);
  syncLabel.appendChild(syncSwitch);
  syncLabel.appendChild(syncText);

  syncCheck.addEventListener('change', () => {
    refreshVehicleRowDateFields(wrapper);
    try { updatePaymentSummary(); } catch (e) { /* ignore */ }
  });

  startDate.addEventListener('change', () => {
    if (startDate.value && (!endDate.value || endDate.value < startDate.value)) endDate.value = startDate.value;
    refreshVehicleRowDateFields(wrapper);
    try { updatePaymentSummary(); } catch (e) { /* ignore */ }
  });

  endDate.addEventListener('change', () => {
    if (startDate.value && endDate.value && endDate.value < startDate.value) endDate.value = startDate.value;
    refreshVehicleRowDateFields(wrapper);
    try { updatePaymentSummary(); } catch (e) { /* ignore */ }
  });

  dateWrap.appendChild(inGroup);
  dateWrap.appendChild(outGroup);
  dateWrap.appendChild(syncLabel);

  wrapper.appendChild(titleRow);
  wrapper.appendChild(visitorNameGroup);
  wrapper.appendChild(visitorPhoneGroup);
  wrapper.appendChild(plateGroup);
  wrapper.appendChild(dateWrap);

  const rowNameInput = wrapper.querySelector('.vehicle-visitor-name-input');
  const rowPhoneInput = wrapper.querySelector('.vehicle-visitor-phone-input');
  if (rowPhoneInput) {
    rowPhoneInput.addEventListener('input', () => {
      rowPhoneInput.value = normalizePhoneInput(rowPhoneInput.value || '');
    });
  }

  startDate.value = rowSeed.startDate || '';
  endDate.value = rowSeed.endDate || '';
  refreshVehicleRowDateFields(wrapper);
  if (rowSeed.useMainDate === false && !syncCheck.disabled) {
    syncCheck.checked = false;
    refreshVehicleRowDateFields(wrapper);
    if (rowSeed.startDate) startDate.value = rowSeed.startDate;
    if (rowSeed.endDate) endDate.value = rowSeed.endDate;
    refreshVehicleRowDateFields(wrapper);
  }
  queueMicrotask(refreshVehicleRowIndices);
  return wrapper;
}

function refreshVehicleRowIndices() {
  const rows = Array.from(document.querySelectorAll('#vehicleList .vehicle-row'));
  rows.forEach((row, idx) => {
    const heading = row.querySelector('.vehicle-row-heading');
    if (heading) heading.textContent = `Kenderaan Tambahan (${idx + 2})`;
  });
}

function refreshVehicleRowDateFields(rowEl) {
  if (!rowEl) return;
  const wrap = rowEl.querySelector('.vehicle-extra-date-wrap');
  const startInput = rowEl.querySelector('.vehicle-extra-start');
  const endInput = rowEl.querySelector('.vehicle-extra-end');
  const syncCheck = rowEl.querySelector('.vehicle-date-sync-check');
  const syncRow = syncCheck ? syncCheck.closest('.vehicle-date-sync') : null;
  const outGroup = endInput ? endInput.closest('.vehicle-field-group') : null;
  if (!wrap || !startInput || !endInput) return;

  const category = (document.getElementById('category')?.value || '').trim();
  const stayOver = (document.getElementById('stayOver')?.value || 'No').trim();
  const enabled = category === 'Pelawat' || category === 'Pelawat Khas';

  if (!enabled) {
    wrap.style.display = 'none';
    wrap.classList.add('hidden');
    startInput.value = '';
    endInput.value = '';
    startInput.disabled = false;
    endInput.disabled = false;
    if (outGroup) outGroup.style.display = '';
    return;
  }

  const etaVal = document.getElementById('eta')?.value || '';
  const etdVal = document.getElementById('etd')?.value || etaVal;
  if (!etaVal) {
    // For Pelawat Khas, keep the date section visible as locked fields that follow Kenderaan Pertama.
    if (category === 'Pelawat Khas') {
      wrap.style.display = 'grid';
      wrap.classList.remove('hidden');
      if (syncCheck) {
        syncCheck.checked = true;
        syncCheck.disabled = true;
      }
      if (syncRow) syncRow.classList.add('is-locked');
      if (outGroup) outGroup.style.display = '';
      startInput.value = '';
      endInput.value = '';
      startInput.disabled = true;
      endInput.disabled = true;
      return;
    }
    wrap.style.display = 'none';
    wrap.classList.add('hidden');
    startInput.value = '';
    endInput.value = '';
    startInput.disabled = false;
    endInput.disabled = false;
    if (outGroup) outGroup.style.display = '';
    return;
  }

  wrap.style.display = 'grid';
  wrap.classList.remove('hidden');

  // Pelawat Tidak Bermalam and Pelawat Khas: additional vehicles follow Kenderaan Pertama dates.
  const noOvernight = category === 'Pelawat Khas' || stayOver !== 'Yes';
  if (noOvernight) {
    if (syncCheck) {
      syncCheck.checked = true;
      syncCheck.disabled = true;
    }
    if (syncRow) syncRow.classList.add('is-locked');
    startInput.value = etaVal;
    startInput.disabled = true;
    if (outGroup) outGroup.style.display = '';
    endInput.value = startInput.value;
    endInput.disabled = true;
    return;
  }

  if (syncCheck) syncCheck.disabled = false;
  if (syncRow) syncRow.classList.remove('is-locked');
  if (outGroup) outGroup.style.display = '';

  if (syncCheck && syncCheck.checked) {
    startInput.value = etaVal;
    endInput.value = etdVal || etaVal;
    startInput.disabled = true;
    endInput.disabled = true;
    return;
  }

  startInput.disabled = false;
  endInput.disabled = false;
  startInput.min = etaVal;
  startInput.max = etdVal || etaVal;
  endInput.min = startInput.value || etaVal;
  endInput.max = etdVal || etaVal;

  if (!startInput.value) startInput.value = etaVal;
  if (!endInput.value) endInput.value = etdVal || startInput.value;

  if (startInput.value < etaVal) startInput.value = etaVal;
  if ((etdVal || etaVal) && startInput.value > (etdVal || etaVal)) startInput.value = etdVal || etaVal;
  if (endInput.value < startInput.value) endInput.value = startInput.value;
  if ((etdVal || etaVal) && endInput.value > (etdVal || etaVal)) endInput.value = etdVal || etaVal;

  endInput.min = startInput.value;
}

function refreshAllVehicleDateFields() {
  document.querySelectorAll('#vehicleList .vehicle-row').forEach(row => refreshVehicleRowDateFields(row));
}

function getAdditionalVehicleEntries() {
  const rows = document.querySelectorAll('#vehicleList .vehicle-row');
  const out = [];
  const seen = new Set();
  rows.forEach(row => {
    const plate = normalizeVehicleInput(row.querySelector('.vehicle-input')?.value || '');
    if (!plate || seen.has(plate)) return;
    seen.add(plate);
    const sVal = row.querySelector('.vehicle-extra-start')?.value || '';
    const eVal = row.querySelector('.vehicle-extra-end')?.value || '';
    out.push({
      plate,
      startDate: sVal ? dateFromInputDateOnly(sVal) : null,
      endDate: eVal ? dateFromInputDateOnly(eVal) : null
    });
  });
  return out;
}

function getVehicleNumbersFromList(){
  const list = document.querySelectorAll('#vehicleList .vehicle-row .vehicle-input');
  const out = [];
  list.forEach(i => {
    const v = i.value.trim();
    if (v) out.push(v);
  });
  return out;
}

/* ---------- autocomplete improved: grouped results + limits ---------- */
let currentSuggestions = [];
let focusedIndex = -1;

const LIMIT_SEARCH = Infinity;      // no max total suggestions
const LIMIT_PER_GROUP = Infinity;   // no max items per group
const GROUP_KEY_REGEX = /^([A-Z0-9]+-\d{1,3})/; // group key extractor

function normQuery(q){
  let s = (q || '').trim().toUpperCase();
  // convert whitespace to hyphen (so 'A 12' -> 'A-12') and normalize common separators to hyphen
  s = s.replace(/\s+/g,'-').replace(/[_\.\/\\]+/g,'-').replace(/-{2,}/g,'-');
  // If user typed 'A12' or 'B1102' (letters followed by digits) convert to 'A-12' or 'B1-102'
  const m = s.match(/^([A-Z]{1,2})(\d+)$/);
  if (m) s = `${m[1]}-${m[2]}`;
  return s;
}

function matchUnitsGrouped(prefix){
  const p = normQuery(prefix);
  if (!p) return {};
  const groups = Object.create(null);
  let total = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (!u) continue;
    if (!u.toUpperCase().startsWith(p)) continue;
    const m = u.match(GROUP_KEY_REGEX);
    const g = m ? m[1] : u.split('-').slice(0,2).join('-');
    groups[g] = groups[g] || [];
    groups[g].push(u);
    total++;
  }
  return groups;
}

function flattenGroupsForRender(groups){
  const out = [];
  Object.keys(groups).forEach(gk => {
    out.push({ type: 'header', key: gk });
    groups[gk].forEach(it => out.push({ type: 'item', value: it }));
  });
  return out;
}

function createHeaderNode(text) {
  const d = document.createElement('div');
  d.className = 'autocomplete-item autocomplete-header';
  d.textContent = text;
  d.style.fontWeight = '700';
  d.style.padding = '6px 10px';
  d.setAttribute('aria-disabled','true');
  d.tabIndex = -1;
  return d;
}
function createItemNode(text, index) {
  const div = document.createElement('div');
  div.className = 'autocomplete-item';
  div.role = 'option';
  div.setAttribute('data-value', text);
  div.setAttribute('data-index', index);
  // set stable id for aria-activedescendant
  div.id = `unit-suggestion-${index}`;
  div.tabIndex = -1;
  div.textContent = text;
  return div;
}

function openSuggestionsGrouped(prefix, wrapperEl, inputEl) {
  const container = wrapperEl.querySelector('#unitSuggestions');
  container.innerHTML = '';
  const groups = matchUnitsGrouped(prefix);
  const flattened = flattenGroupsForRender(groups);

  if (flattened.length === 0) {
    container.innerHTML = '<div class="autocomplete-empty">Tiada padanan</div>';
    container.hidden = false;
    currentSuggestions = [];
    focusedIndex = -1;
    return;
  }

  let selectableIndex = 0;
  flattened.forEach((node) => {
    if (node.type === 'header') {
      container.appendChild(createHeaderNode(node.key));
    } else {
      container.appendChild(createItemNode(node.value, selectableIndex));
      selectableIndex++;
    }
  });

  container.hidden = false;
  // indicate to assistive tech we'll open
  if (inputEl) inputEl.setAttribute('aria-expanded', 'true');
  currentSuggestions = Array.from(container.querySelectorAll('.autocomplete-item[role="option"]')).map(el => el.getAttribute('data-value'));
  container.querySelectorAll('.autocomplete-item').forEach(el => el.setAttribute('aria-selected','false'));
  focusedIndex = -1;
}

function closeSuggestions(wrapperEl) {
  const container = wrapperEl.querySelector('#unitSuggestions');
  if (!container) return;
  container.hidden = true;
  container.innerHTML = '';
  currentSuggestions = [];
  focusedIndex = -1;
  // reset aria on input
  const inputEl = wrapperEl.querySelector('input');
  if (inputEl) {
    inputEl.setAttribute('aria-expanded', 'false');
    inputEl.removeAttribute('aria-activedescendant');
  }
}

function selectSuggestionByIndex(idx, inputEl, wrapperEl) {
  if (idx < 0 || idx >= currentSuggestions.length) return;
  const rawVal = currentSuggestions[idx];
  // normalize selection (ensures consistent formatting) and clear any previous error state
  const norm = normalizeUnitInput(rawVal);
  inputEl.value = norm || rawVal;
  clearFieldError(inputEl);
  // update the small status indicator after selection
  updateUnitStatus(inputEl);
  // user selected a valid result — clear any toasts (old errors) immediately
  clearAllToasts();
  closeSuggestions(wrapperEl);
  // update aria + screen reader state and focus so user sees the change clearly
  try { inputEl.setAttribute('aria-activedescendant', `unit-suggestion-${idx}`); } catch(e) {}
  inputEl.focus();
}

function navSetAriaSelected(listEl, focusedIdx) {
  const options = listEl.querySelectorAll('.autocomplete-item[role="option"]');
  options.forEach((el, idx) => el.setAttribute('aria-selected', idx === focusedIdx ? 'true' : 'false'));
  if (focusedIdx >= 0 && options[focusedIdx]) options[focusedIdx].scrollIntoView({block:'nearest'});
  // set aria-activedescendant on input if available
  const wrap = listEl.closest('.autocomplete-wrap');
  if (wrap) {
    const input = wrap.querySelector('input');
    if (input) {
      if (focusedIdx >= 0 && options[focusedIdx]) {
        input.setAttribute('aria-activedescendant', options[focusedIdx].id);
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }
  }
}

/* ---------- normalization & pattern check ---------- */
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
  // Accept forms like:
  //  - A-12-03  (blocks with digits)
  //  - B1-G-1   (blocks where middle segment can be letters like 'G')
  //  - B1-G     (group/prefix form)
  // Allow both two-part and three-part segments, each containing letters/digits.
  return /^[A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)?$/.test(val);
}

/* ---------- subcategory/company/etd logic ---------- */
const companyCategories = new Set(['Kontraktor','Penghantaran Barang','Pindah Rumah']);
// For certain categories ETD (tarikh keluar) isn't applicable — include Pelawat Khas
const categoriesEtdDisabled = new Set(['Kontraktor','Penghantaran Barang','Pindah Rumah', 'Pelawat Khas', 'Drop-off']);

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
  'Penghantaran Masuk': 'Penghantaran barang masuk ke dalam Banjaria Court',
  'Penghantaran Keluar': 'Penghantaran barang keluar ke dari Banjaria Court',
  'Pindah Masuk': 'Urusan pindah masuk ke Banjaria Court',
  'Pindah Keluar': 'Urusan pindah keluar dari Banjaria Court.',
  'Renovasi': 'Kerja-kerja pengubahsuaian (contoh: kerja yang melibatkan penggantian paip sinki, cat, jubin lantai).',
  'Telekomunikasi': 'Pemasangan baru bagi Astro, TM, Time, Maxis)',
  'Kerja Servis': 'Pemasangan baru atau servis seperti COWAY, Cucko, Air-Cond.',
  'Kawalan Serangga Perosak': 'Rawatan kawalan perosak. Pastikan kawasan yang terlibat dan langkah keselamatan diberi tahu.',
  'Kerja Pembaikan': 'Pembaikan seperti pendawaian, perkakasan elektrik, ',
  'Pemeriksaan': 'Pemeriksaan di rumah utiliti TNB, Air Selangor, TM, TIME,'
};

const categoryHelpMap = {
  'Pelawat': 'Pendaftaran untuk pelawat yang bermalam / tidak bermalam.',
  'Kontraktor': 'Pendaftaran untuk beri kebenaran kepada kontraktor untuk masuk ke Banjaria Court.',
  'Penghantaran Barang': 'Penggunaan lif yang minima (1x pengunaan sahaja).',
  'Pindah Rumah': 'Penggunaan lif berulang kali (mengunci lif bagi kerja pemindahan barang).',
  'Pelawat Khas': 'Pendaftaran untuk penghuni yang menganjurkan majlis yang melibatkan ramai pelawat.',
  'Drop-off': 'Pendaftaran untuk mengambil atau menghantar penghuni di dalam Banjaria Court. (Maksimum 15 minit waktu yang dibenarkan untuk berada di dalam Banjaria Court)'
};

// Render the Bahagian 2 category note using the same descriptions as the inline helper
function renderCategorySectionNote() {
  const note = document.getElementById('sectionCategoryNote');
  const noteWrap = document.getElementById('sectionCategoryInfo');
  if (!note) return;
  const select = document.getElementById('category');

  const items = [];
  if (select) {
    Array.from(select.options || []).forEach(opt => {
      const val = opt.value;
      if (!val) return;
      if (categoryHelpMap[val]) items.push([val, categoryHelpMap[val]]);
    });
  }
  if (!items.length) {
    Object.entries(categoryHelpMap).forEach(([key, text]) => items.push([key, text]));
  }

  if (!items.length) {
    note.textContent = '';
    note.setAttribute('aria-hidden', 'true');
    if (noteWrap) noteWrap.classList.add('hidden');
    return;
  }

  if (noteWrap) noteWrap.classList.remove('hidden');
  note.innerHTML = '';
  const ul = document.createElement('ul');
  ul.className = 'section-note-list';
  items.forEach(([label, text]) => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = label;
    li.appendChild(strong);
    li.appendChild(document.createTextNode(`: ${text}`));
    ul.appendChild(li);
  });
  note.appendChild(ul);
  note.removeAttribute('aria-hidden');
  if (noteWrap) {
    const summary = noteWrap.querySelector('summary');
    if (summary) {
      summary.textContent = 'Penerangan Kategori';
    }
  }
}

function setCompanyFieldState(show) {
  const companyWrap = document.getElementById('companyWrap');
  const companyInput = document.getElementById('companyName');
  if (!companyWrap || !companyInput) return;
  if (show) {
    companyWrap.classList.remove('hidden');
    try { companyWrap.style.removeProperty('display'); } catch(e) { companyWrap.style.display = ''; }
    companyInput.required = true;
    companyInput.disabled = false;
    companyInput.removeAttribute('aria-hidden');
    try { companyInput.tabIndex = 0; } catch(e) {}
  } else {
    companyWrap.classList.add('hidden');
    // enforce hiding with inline !important so other CSS can't override
    try { companyWrap.style.setProperty('display', 'none', 'important'); } catch(e) { companyWrap.style.display = 'none'; }
    companyInput.required = false;
    companyInput.disabled = true;
    companyInput.value = '';
    companyInput.setAttribute('aria-hidden','true');
    try { companyInput.tabIndex = -1; } catch(e) {}
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
  try { select.tabIndex = -1; } catch(e) {}
  wrap.classList.add('hidden');
  try { wrap.style.setProperty('display','none','important'); } catch(e) { wrap.style.display = 'none'; }
  wrap.setAttribute('aria-hidden','true');

  if (helpEl) { helpEl.textContent = ''; }
  if (helpWrap) { helpWrap.classList.add('hidden'); helpWrap.setAttribute('aria-hidden','true'); try { helpWrap.style.setProperty('display','none','important'); } catch(e) { helpWrap.style.display = 'none'; } }

    if (subCategoryMap[cat]) {
      subCategoryMap[cat].forEach(opt => { 
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    });
      wrap.classList.remove('hidden');
      wrap.removeAttribute('aria-hidden');
      // remove inline hiding to ensure visible again
      try { wrap.style.removeProperty('display'); } catch(e) { wrap.style.display = ''; }
    select.disabled = false;
    select.removeAttribute('aria-hidden');
    try { select.tabIndex = 0; } catch(e) {}
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
    try { helpWrap.style.removeProperty('display'); } catch(e) { helpWrap.style.display = ''; }
  } else {
    helpEl.textContent = '';
    helpWrap.classList.add('hidden');
    helpWrap.setAttribute('aria-hidden','true');
    try { helpWrap.style.setProperty('display','none','important'); } catch(e) { helpWrap.style.display = 'none'; }
  }
}

/* ---------- WhatsApp quick-send helpers (admin link) ---------- */
function normalizeForWaLink(raw){
  if (!raw) return null;
  let p = String(raw).trim().replace(/[\s\-().]/g,'');
  if (!p) return null;
  if (p.startsWith('+')) p = p.replace(/^\+/, '');
  else if (p.startsWith('0')) p = '6' + p.replace(/^0+/, '');
  return p; // e.g., 60123456789
}

// Build WhatsApp URLs for admin notification (returns both app and web URLs; does NOT open them)
function buildWhatsAppUrlForAdmin(payload){
  const adminNumber = '601172248614'; // updated admin number (Malaysia) without plus

  // Format date to local timezone (dd/mm/yyyy) instead of UTC
  const formatLocalDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const etaText = payload.eta ? formatLocalDate(payload.eta) : '-';
  const etdText = payload.etd ? formatLocalDate(payload.etd) : '-';
  const messageTimestamp = (() => {
    const ts = payload && payload.createdAt;
    if (ts && typeof ts.toDate === 'function') {
      try { return ts.toDate(); } catch (e) { /* ignore */ }
    }
    return new Date();
  })();
  const messageDateText = formatLocalDate(messageTimestamp);

  const normalizeArrearsCategory = (raw) => {
    if (raw === null || raw === undefined) return 1;
    if (typeof raw === 'number') {
      const n = Math.round(raw);
      return (n >= 1 && n <= 3) ? n : 1;
    }
    const s = String(raw).trim();
    const m = s.match(/(1|2|3)/);
    return m ? Number(m[1]) : 1;
  };

  const toDateOnly = (v) => {
    if (!v) return null;
    const d = v.toDate ? v.toDate() : new Date(v);
    if (!d || isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  };

  const computeChargeSummaryForWa = (p) => {
    const category = String(p.category || '');
    const arrearsCat = normalizeArrearsCategory(p.unitCategory);
    const vehicleList = Array.isArray(p.vehicleNumbers) && p.vehicleNumbers.length
      ? p.vehicleNumbers.filter(Boolean)
      : (p.vehicleNo ? [p.vehicleNo] : []);
    const totalCars = Math.max(1, vehicleList.length || 0);
    const extraCars = Math.max(0, totalCars - 1);
    const start = toDateOnly(p.eta);
    const end = toDateOnly(p.etd) || start;
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = (start && end) ? Math.max(1, Math.floor((end.getTime() - start.getTime()) / dayMs) + 1) : 1;

    if (category === 'Pelawat Khas') {
      const rateMap = { 1: 5, 2: 8, 3: 15 };
      const rate = rateMap[arrearsCat] || 0;
      const main = rate * totalDays;
      const extra = extraCars * rate * totalDays;
      const total = main + extra;
      return {
        arrearsCat,
        total,
        lines: [
          `Kadar Pelawat Khas: RM ${rate.toFixed(2)} / kereta / hari`,
          `Kenderaan utama: 1 x ${totalDays} hari x RM ${rate.toFixed(2)} = RM ${main.toFixed(2)}`,
          `Kenderaan tambahan: ${extraCars} x ${totalDays} hari x RM ${rate.toFixed(2)} = RM ${extra.toFixed(2)}`
        ]
      };
    }

    if (category === 'Pelawat') {
      const additionalRateMap = { 1: 10, 2: 15, 3: 25 };
      const additionalRate = additionalRateMap[arrearsCat] || 0;
      let main = 0;
      if (arrearsCat !== 1) {
        const free = freeDaysForCategory(arrearsCat);
        const baseRate = arrearsCat === 2 ? 5 : 15;
        const chargedDays = Math.max(0, totalDays - Math.max(0, Math.min(free, totalDays)));
        main = chargedDays * baseRate;
      }
      const extra = extraCars * totalDays * additionalRate;
      const total = main + extra;
      return {
        arrearsCat,
        total,
        lines: [
          `Kadar pelawat tambahan: RM ${additionalRate.toFixed(2)} / kereta / hari`,
          `Kenderaan utama: RM ${main.toFixed(2)}`,
          `Kenderaan tambahan: ${extraCars} x ${totalDays} hari x RM ${additionalRate.toFixed(2)} = RM ${extra.toFixed(2)}`
        ]
      };
    }

    if (category === 'Kontraktor') {
      let main = 0;
      if (arrearsCat !== 1) {
        const free = freeDaysForCategory(arrearsCat);
        const baseRate = arrearsCat === 2 ? 5 : 15;
        const chargedDays = Math.max(0, totalDays - Math.max(0, Math.min(free, totalDays)));
        main = chargedDays * baseRate;
      }
      return {
        arrearsCat,
        total: main,
        lines: [
          `Caj kontraktor: RM ${main.toFixed(2)}`
        ]
      };
    }

    return null;
  };

  const vehicles = (payload.vehicleNumbers && payload.vehicleNumbers.length)
    ? payload.vehicleNumbers
    : (payload.vehicleNo ? [payload.vehicleNo] : []);
  const vehiclesForWa = vehicles.length ? vehicles : ['-'];
  const blocks = vehiclesForWa.map((plate) => ([
    'Pendaftaran Pelawat Baru',
    `Tarikh : ${messageDateText}`,
    `Unit: ${payload.hostUnit || '-'}`,
    `Nama penghuni: ${payload.hostName || '-'}`,
    `Nombor telefon penghuni: ${payload.hostPhone || '-'}`,
    `Nama pelawat: ${payload.visitorName || '-'}`,
    `Nombor telefon pelawat: ${payload.visitorPhone || '-'}`,
    `Tarikh masuk: ${etaText}`,
    `Tarikh keluar: ${etdText}`,
    `Kenderaan: ${plate || '-'}`,
    `Kategori: ${payload.category || '-'}`
  ].join('\n')));
  const blockSeparator = '\n------------------------------\n';
  const text = encodeURIComponent(blocks.join(blockSeparator));
  // Web URL (works in browsers)
  const waWebUrl = `https://wa.me/${adminNumber}?text=${text}`;
  // App URL (prefer opening the WhatsApp app directly where supported). Include phone so recipient is prefilled.
  const waAppUrl = `whatsapp://send?phone=${adminNumber}&text=${text}`;
  return { waAppUrl, waWebUrl };
}

// Detect iOS user agent
function isIOS() {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  } catch (e) { return false; }
}

// Attempt to open a URL in a new window/tab and return whether it succeeded.
function openUrlInNewWindow(url){
  try {
    const newWin = window.open(url, '_blank');
    // Some browsers return null if popup blocked
    if (!newWin) return false;
    try { newWin.focus(); } catch(e) {}
    return true;
  } catch (e) {
    return false;
  }
}

// Try opening WhatsApp notification (app first, then web). If both fail, render a persistent button and helpful hint.
function openWhatsAppNotification(payload){
  try {
    const { waAppUrl, waWebUrl } = buildWhatsAppUrlForAdmin(payload);
    let opened = false;
    if (waAppUrl) {
      const ok = openUrlInNewWindow(waAppUrl);
      console.log('openWhatsAppNotification: attempted waAppUrl', waAppUrl, 'result=', ok);
      opened = opened || ok;
    }
    if (!opened && waWebUrl) {
      const ok2 = openUrlInNewWindow(waWebUrl);
      console.log('openWhatsAppNotification: attempted waWebUrl', waWebUrl, 'result=', ok2);
      opened = opened || ok2;
    }

    if (!opened) {
      const statusEl = document.getElementById('statusMsg');
      if (statusEl) {
        statusEl.innerHTML = '';
        const a = document.createElement('a');
        a.href = waWebUrl || waAppUrl || '#';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'btn btn-ghost';
        a.textContent = 'Hantar Notifikasi ke WhatsApp';
        a.setAttribute('aria-label', 'Buka WhatsApp untuk hantar notifikasi kepada pentadbir');
        statusEl.appendChild(a);

        // Guidance shown to all users when automatic open is blocked
        const hint = document.createElement('div');
        hint.className = 'small muted';
        hint.style.marginTop = '8px';
        hint.style.lineHeight = '1.35';
        hint.innerHTML = 'Jika WhatsApp tidak dibuka secara automatik (contoh: iPhone/Safari), <strong>tekan butang di atas</strong> untuk buka WhatsApp dan hantar mesej kepada pentadbir.';
        statusEl.appendChild(hint);
      }
    }
  } catch (e) { console.warn('openWhatsAppNotification failed', e); }
}

// For quick manual testing in the browser console (dev only)
window.openWhatsAppForTesting = function(payload){ try { openWhatsAppNotification(payload || {}); } catch(e) { console.warn('test open failed', e); } };

/* ---------- main init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('hostUnit');
  const wrapper = input?.closest('.autocomplete-wrap');
  const listEl = document.getElementById('unitSuggestions');
  const confirmAgreeEl = document.getElementById('confirmAgree');
  const waBtn = document.getElementById('waBtn');
  const waHint = document.getElementById('waHint');
  const repeatModeEl = document.getElementById('repeatMode');
  const repeatModeWrapEl = document.querySelector('.repeat-mode-wrap');
  const repeatModeInfoBtnEl = document.getElementById('repeatModeInfoBtn');
  const repeatModeHintEl = document.getElementById('repeatModeHint');
  const draftStateEl = document.getElementById('draftState');
  const progressBarEl = document.getElementById('formProgressBar');
  const progressLabelEl = document.getElementById('formProgressLabel');
  const progressTrackEl = document.querySelector('.form-progress-track');
  const VISITOR_DRAFT_KEY = 'visitorForm:draft:v2';
  const VISITOR_REPEAT_KEY = 'visitorForm:repeatMode';
  const VISITOR_LAST_SUBMISSION_KEY = 'visitorForm:lastSubmission:v1';
  let isMockSubmit = false;
  let draftTimer = null;

  function resetWhatsAppAction(){
    pendingWaPayload = null;
    if (waBtn) {
      waBtn.disabled = true;
      waBtn.classList.add('btn-disabled');
      waBtn.classList.remove('is-active','is-loading','is-success');
    }
    if (waHint) waHint.textContent = 'Aktif selepas borang dihantar.';
  }

  function enableWhatsAppAction(payload){
    pendingWaPayload = payload;
    if (waBtn) {
      waBtn.disabled = false;
      waBtn.classList.remove('btn-disabled','is-loading','is-success');
    }
    if (waHint) waHint.textContent = 'Tekan untuk buka WhatsApp dan hantar mesej (Langkah 2).';
  }

  function playButtonSuccessAnimation(btn){
    if (!btn) return;
    if (btn.classList.contains('loader-btn')) {
      btn.classList.remove('is-loading');
      btn.classList.add('is-success');
      return;
    }
    btn.classList.add('is-active');
  }

  function setDraftState(text, isError = false) {
    if (!draftStateEl) return;
    draftStateEl.textContent = text;
    draftStateEl.style.color = isError ? 'var(--danger, #ef4444)' : 'var(--muted, #6b7280)';
  }

  function saveRepeatModePreference() {
    if (!repeatModeEl) return;
    try { localStorage.setItem(VISITOR_REPEAT_KEY, repeatModeEl.checked ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function restoreRepeatModePreference() {
    if (!repeatModeEl) return;
    try {
      const raw = localStorage.getItem(VISITOR_REPEAT_KEY);
      if (raw === '0') repeatModeEl.checked = false;
      if (raw === '1') repeatModeEl.checked = true;
    } catch (e) { /* ignore */ }
  }

  function setRepeatHintOpen(open) {
    if (!repeatModeHintEl || !repeatModeInfoBtnEl || !repeatModeWrapEl) return;
    if (open) {
      repeatModeHintEl.hidden = false;
      repeatModeWrapEl.classList.add('is-hint-open');
      repeatModeInfoBtnEl.setAttribute('aria-expanded', 'true');
    } else {
      repeatModeHintEl.hidden = true;
      repeatModeWrapEl.classList.remove('is-hint-open');
      repeatModeInfoBtnEl.setAttribute('aria-expanded', 'false');
    }
  }

  function isVisibleEnabledField(el) {
    if (!el || el.disabled) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.closest('.hidden')) return false;
    return true;
  }

  function getProgressTargets() {
    const targets = ['hostUnit', 'hostName', 'category', 'visitorName', 'eta'];
    const subCategoryEl = document.getElementById('subCategory');
    if (subCategoryEl?.required && isVisibleEnabledField(subCategoryEl)) targets.push('subCategory');
    const companyEl = document.getElementById('companyName');
    if (companyEl?.required && isVisibleEnabledField(companyEl)) targets.push('companyName');
    return targets;
  }

  function updateProgress(totalDone, totalRequired) {
    const safeTotal = Math.max(1, totalRequired || 1);
    const pct = Math.max(0, Math.min(100, Math.round((totalDone / safeTotal) * 100)));
    if (progressBarEl) progressBarEl.style.width = `${pct}%`;
    if (progressLabelEl) progressLabelEl.textContent = `Kemajuan borang: ${pct}% (${totalDone}/${safeTotal})`;
    if (progressTrackEl) progressTrackEl.setAttribute('aria-valuenow', String(pct));
  }

  function updateFormProgress() {
    const targetIds = getProgressTargets();
    let done = 0;
    for (const id of targetIds) {
      const el = document.getElementById(id);
      if (!el || !isVisibleEnabledField(el)) continue;
      const value = (el.value || '').trim();
      if (!value) continue;
      if (id === 'hostUnit') {
        const normalized = normalizeUnitInput(value);
        if (normalized) done += 1;
        continue;
      }
      done += 1;
    }
    const confirmAgree = !!document.getElementById('confirmAgree')?.checked;
    const totalRequired = targetIds.length + 1;
    updateProgress(done + (confirmAgree ? 1 : 0), totalRequired);
  }

  function collectDraftData() {
    const vehicleRowsDetailed = Array.from(document.querySelectorAll('#vehicleList .vehicle-row')).map((row) => ({
      plate: normalizeVehicleInput(row.querySelector('.vehicle-input')?.value || ''),
      visitorName: (row.querySelector('.vehicle-visitor-name-input')?.value || '').trim(),
      visitorPhone: normalizePhoneInput(row.querySelector('.vehicle-visitor-phone-input')?.value || ''),
      startDate: row.querySelector('.vehicle-extra-start')?.value || '',
      endDate: row.querySelector('.vehicle-extra-end')?.value || '',
      useMainDate: !!row.querySelector('.vehicle-date-sync-check')?.checked
    }));
    const vehicleRows = vehicleRowsDetailed.map(v => v.plate).filter(Boolean);
    return {
      hostUnit: document.getElementById('hostUnit')?.value || '',
      hostName: document.getElementById('hostName')?.value || '',
      hostPhone: document.getElementById('hostPhone')?.value || '',
      category: document.getElementById('category')?.value || '',
      subCategory: document.getElementById('subCategory')?.value || '',
      entryDetails: document.getElementById('entryDetails')?.value || '',
      companyName: document.getElementById('companyName')?.value || '',
      visitorName: document.getElementById('visitorName')?.value || '',
      visitorPhone: document.getElementById('visitorPhone')?.value || '',
      stayOver: document.getElementById('stayOver')?.value || 'No',
      eta: document.getElementById('eta')?.value || '',
      etd: document.getElementById('etd')?.value || '',
      vehicleNo: document.getElementById('vehicleNo')?.value || '',
      vehicleType: document.getElementById('vehicleType')?.value || '',
      vehicleNumbers: vehicleRows,
      vehicleRowsDetailed,
      confirmAgree: !!document.getElementById('confirmAgree')?.checked,
      savedAt: Date.now()
    };
  }

  function scheduleDraftSave() {
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        const data = collectDraftData();
        localStorage.setItem(VISITOR_DRAFT_KEY, JSON.stringify(data));
        setDraftState('Draf disimpan automatik');
      } catch (e) {
        setDraftState('Gagal simpan draf', true);
      }
    }, 350);
  }

  function clearDraft() {
    try { localStorage.removeItem(VISITOR_DRAFT_KEY); } catch (e) { /* ignore */ }
    setDraftState('Draf automatik aktif');
  }

  function getSavedLastSubmission() {
    try {
      const raw = localStorage.getItem(VISITOR_LAST_SUBMISSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return (data && typeof data === 'object') ? data : null;
    } catch (e) {
      return null;
    }
  }

  function saveLastSubmission(data) {
    try { localStorage.setItem(VISITOR_LAST_SUBMISSION_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  function setAmendButtonState(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle('btn-disabled', !enabled);
  }

  // Debug helper: if URL contains ?debug=1, show a visible test button to simulate WhatsApp open (useful for iPhone tests)
  try {
    const params = new URLSearchParams(window.location.search);
    isMockSubmit = params.get('mockSubmit') === '1' || params.get('mock') === '1';
    if (params.get('debug') === '1' || params.get('debug') === 'true') {
      const statusEl = document.getElementById('statusMsg');
      if (statusEl) {
        const dbg = document.createElement('button');
        dbg.type = 'button';
        dbg.className = 'btn-ghost';
        dbg.textContent = 'Debug: Test WhatsApp';
        dbg.style.marginLeft = '8px';
        dbg.addEventListener('click', () => {
          const sample = { hostUnit: 'A-12-03', hostName: 'Test', hostPhone:'0123456789', visitorName:'Ahmad', visitorPhone:'0123456789', eta: new Date(), etd: new Date(), vehicleNo:'ABC123', vehicleNumbers:[], category:'Pelawat' };
          openWhatsAppNotification(sample);
        });
        statusEl.appendChild(dbg);
      }
    }
  } catch(e) {}

  restoreRepeatModePreference();
  setDraftState('Draf automatik aktif');
  repeatModeEl?.addEventListener('change', () => {
    saveRepeatModePreference();
    scheduleDraftSave();
  });
  repeatModeInfoBtnEl?.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = repeatModeInfoBtnEl.getAttribute('aria-expanded') === 'true';
    setRepeatHintOpen(!isOpen);
  });
  document.addEventListener('click', (e) => {
    if (!repeatModeWrapEl) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!repeatModeWrapEl.contains(target)) setRepeatHintOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setRepeatHintOpen(false);
  });

  // Show floating memo before allowing form fill (once per browser)
  try {
    // Show every time: pass storageKey: null so it doesn't persist dismissal
    const memoText = [
      '<p>Pihak Pengurusan akan mula melaksanakan <strong>Pelaksanaan SOP Kemasukan Pelawat & Kontraktor</strong>, seperti yang dibincangkan didalam <strong>EGM 3.0</strong> pada <strong>22 Nov 2025</strong>.</p>',
      '<p>Unit pelawat / kontraktor yang mempunyai tunggakan akan dikenakan caj bagi penggunaan parkir pelawat. Berikut adalah ringkasan jadual bagi kadar caj penggunaan lot parkir pelawat :-</p>',
      '<ol>',
      '<li><span class="memo-cat-1"><strong>Kategori 1</strong></span><br> Tunggakan: Tiada<br> Caj parkir pelawat: <strong>Percuma - 3 hari pertama</strong><br> Jika ingin sambung - dikenakan pembayaran atau tempoh bertenang 3 hari sebelum boleh daftar masuk.</li>',
      '<li><span class="memo-cat-2"><strong>Kategori 2</strong></span><br> Tunggakan: RM 1.00 hingga RM 400.00<br> Caj parkir pelawat: <strong>Percuma untuk 1 hari pertama; caj bermula pada hari ke-2</strong><br> Jika ingin sambung - dikenakan bayaran atau tempoh bertenang 3 hari sebelum boleh daftar masuk.</li>',
      '<li><span class="memo-cat-3"><strong>Kategori 3</strong></span><br> Tunggakan: RM 400.00 ke atas<br> Caj parkir pelawat: <strong>RM 15/hari</strong>. Rujuk jadual untuk jumlah pembayaran.</li>',
      '</ol>',
      '<p>Untuk makluman, senarai tunggakan yang di paparkan di dalam lif, adalah senarai unit yang mempunyai tunggakan <strong>melebihi RM 400.00</strong> dan ke atas. Unit yang ada tunggakan di bawah RM 400.00 masih di kira sebagai unit yang ada tunggakan cuma tidak dipaparkan didalam senarai tersebut.</p>',
      '<p>Unit yang dikategorikan sebagai <strong>Tiada Tunggakan</strong> adalah unit yang selesaikan:</p>',
      '<ul><li>Fi Penyelenggaraan sebelum bulan semasa.</li><li>Insurans Kebakaran (selesai untuk tahun semasa).</li></ul>',
      '<p>Contoh :-<br>Bulan semasa : <strong>31 Januari 2026</strong><br>Fi penyelenggaraan : <strong>Fi Penyelenggaraan bulan Dis 2025 selesai</strong></p>',
      '<p>Sebarang pembayaran secara atas talian (on-line), resit perlu dihantar melalui e-mail yang ditetapkan. Kegagalan untuk membuat demikian, akan menyebabkan rekod pembayaran tidak dapat dikemaskini.</p>',
      '<p>Sila pastikan maklumat yang disi adalah tepat untuk meneruskan. Tekan "X" atau "Saya faham" untuk meneruskan.</p>'
    ].join('');
    showFloatMemo(memoText, { storageKey: null, blockUntilClose: true, imageSrc: 'assets/visitor_parking_charges.jpeg', html: true });
  } catch(e) { /* ignore */ }

  // input handlers
  input?.addEventListener('input', (e) => {
    const v = e.target.value || '';
    const q = normQuery(v);
    if (!q) { closeSuggestions(wrapper); return; }
    openSuggestionsGrouped(q, wrapper, input);
  });

  // Populate Bahagian 2 note from shared category helper text
  try { renderCategorySectionNote(); } catch (e) { /* ignore */ }

  // clear unit error quickly if user types a syntactically valid unit
  input?.addEventListener('input', (e) => {
    try{
      // dynamically update the small status indicator as user types
      updateUnitStatus(input);
      const val = e.target.value || '';
      const norm = normalizeUnitInput(val);
      if (isPatternValidUnit(norm)) {
        // once user types a syntactically valid value, clear earlier visual error state
        clearFieldError(input);
        // clear inline status / toast so UI is less noisy
        showStatus('', true);
      }
      if (pendingWaPayload) resetWhatsAppAction();
    } catch (err) { /* ignore */ }
  });

  const hostPhoneEl = document.getElementById('hostPhone');
  const visitorPhoneEl = document.getElementById('visitorPhone');
  const vehicleNoEl = document.getElementById('vehicleNo');

  hostPhoneEl?.addEventListener('input', () => {
    hostPhoneEl.value = normalizePhoneInput(hostPhoneEl.value);
    scheduleDraftSave();
    updateFormProgress();
  });

  visitorPhoneEl?.addEventListener('input', () => {
    visitorPhoneEl.value = normalizePhoneInput(visitorPhoneEl.value);
    scheduleDraftSave();
    updateFormProgress();
  });

  vehicleNoEl?.addEventListener('input', () => {
    vehicleNoEl.value = normalizeVehicleInput(vehicleNoEl.value);
    scheduleDraftSave();
    updatePaymentSummary();
  });

  // keyboard navigation
  input?.addEventListener('keydown', (e) => {
    if (!listEl || listEl.hidden) return;
    const options = listEl.querySelectorAll('.autocomplete-item[role="option"]');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
      navSetAriaSelected(listEl, focusedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, 0);
      navSetAriaSelected(listEl, focusedIndex);
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && options[focusedIndex]) {
        e.preventDefault();
        selectSuggestionByIndex(focusedIndex, input, wrapper);
      }
    } else if (e.key === 'Escape') {
      closeSuggestions(wrapper);
    }
  });

  // click on suggestion (delegation)
  listEl?.addEventListener('click', (ev) => {
    const item = ev.target.closest('.autocomplete-item[role="option"]');
    if (!item) return;
    const idx = parseInt(item.getAttribute('data-index'), 10);
    selectSuggestionByIndex(idx, input, wrapper);
  });

  // blur: close after short delay to allow click
  input?.addEventListener('blur', () => setTimeout(()=> closeSuggestions(wrapper), 150));

  // normalization on blur
  input?.addEventListener('blur', async (e) => {
    const norm = normalizeUnitInput(e.target.value || '');
    e.target.value = norm;
    if (norm && !isPatternValidUnit(norm)) {
      setFieldError(input, 'Format tidak sah. Gunakan contohnya A-12-03.');
      updateUnitStatus(input);
      showStatus('Unit rumah: format tidak sah. Gunakan contoh A-12-03.', false);
    } else {
      // clear any previous native validity
      if (norm && !units.includes(norm)) {
        // unit looks ok syntactically but not found in the list — treat as an error and prevent submit
        setFieldError(input, 'Unit tidak ditemui dalam senarai');
        updateUnitStatus(input);
        try { input.focus(); } catch(e) {}
        showStatus('Unit tidak ditemui dalam senarai; pastikan ia betul.', false);
        currentUnitId = '';
        currentUnitSnapshot = null;
        resetPaymentSummary('Unit tidak ditemui dalam senarai.');
      } else {
        clearFieldError(input);
        updateUnitStatus(input);
        showStatus('', true);
        if (norm && units.includes(norm)) {
          await updatePaymentSummary();
        } else {
          resetPaymentSummary();
        }
      }
    }
  });

  // ensure light theme only (dark mode removed)
  document.documentElement.classList.remove('dark');

  // start a small live clock in the page header (visitor form) so users don't need to refresh
  try {
    const dateEl = document.getElementById('visitorDate');
    const timeEl = document.getElementById('visitorTime');
    const startClock = () => {
      if (visitorTimeTicker) clearInterval(visitorTimeTicker);
      // set immediately
      const now = new Date();
      if (dateEl) dateEl.textContent = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`;
      if (timeEl) timeEl.textContent = now.toLocaleTimeString();
      visitorTimeTicker = setInterval(()=>{
        const n = new Date();
        if (timeEl) timeEl.textContent = n.toLocaleTimeString();
        // update date if day boundary changed
        if (dateEl) dateEl.textContent = `${String(n.getDate()).padStart(2,'0')}/${String(n.getMonth()+1).padStart(2,'0')}/${n.getFullYear()}`;
      }, 1000);
    };
    startClock();
    // stop the ticker on unload
    window.addEventListener('beforeunload', ()=> { try { if (visitorTimeTicker) clearInterval(visitorTimeTicker); visitorTimeTicker = null; } catch(e){} });
  } catch (e) { console.warn('visitor clock start failed', e); }

  async function updateUnitsLastUpdatedLabel(){
    const target = document.getElementById('unitUpdateValue');
    if (!target) return;
    try { target.textContent = 'Memuat...'; } catch(e) {}
    if (!window.__FIRESTORE) { target.textContent = 'Tidak diketahui'; return; }
    let ts = null;
    let label = '';
    try {
      const meta = await ensureUnitImportMeta();
      ts = meta.ts; label = meta.label;
    } catch(e) { console.warn('Gagal dapatkan unitMeta/import', e); }

    if (!ts) {
      try {
        const qRef = query(collection(window.__FIRESTORE, 'units'), orderBy('lastUpdatedAt','desc'), limit(1));
        const snap = await getDocs(qRef);
        snap.forEach(d => {
          const data = d.data() || {};
          if (data.lastUpdatedAt) ts = data.lastUpdatedAt;
        });
      } catch (e) {
        console.warn('Gagal dapatkan tarikh kemas kini units', e);
      }
    }

    target.textContent = ts ? ((formatDateTimeLocal(ts) || 'Tidak diketahui') + label) : 'Tidak diketahui';
  }

  (async () => {
    try { await waitForFirestore(); } catch (err) {
      console.error('Firestore init failed', err);
      showStatus('Initialisasi Firestore gagal. Sila hubungi pentadbir.', false);
      return;
    }

    const form = document.getElementById('visitorForm');
    const clearBtn = document.getElementById('clearBtn');
    const amendLastBtn = document.getElementById('amendLastBtn');
    const categoryEl = document.getElementById('category');
    const subCategoryEl = document.getElementById('subCategory');
    const stayOverEl = document.getElementById('stayOver');
    const stayOverWrap = document.getElementById('stayOverWrap');
    const visitorNameElMain = document.getElementById('visitorName');
    const visitorPhoneElMain = document.getElementById('visitorPhone');
    const etaEl = document.getElementById('eta');
    const etdEl = document.getElementById('etd');
    const etdNoteEl = document.getElementById('etdNote');
    const defaultEtdNote = 'Tarikh keluar boleh dipilih sehingga 2 hari selepas Tarikh masuk (maks. 3 hari termasuk tarikh masuk)';
    const renovasiEtdNote = '1. Untuk kerja Renovasi, pemohon perlu mengisi 2 borang iaitu :-<br>a) Permit to Work (PTW) di pejabat pengurusan. Caj deposit RM 250 akan dikenakan.<br>b) Borang kebenaran masuk secara online untuk rekod keselamatan.<br><br>2. Untuk tarikh keluar, sila pilih tarikh anggaran bila kerja-kerja Renovasi selesai sama seperti tarikh yang diisi di dalam Borang Permit to Work (PTW).';

    function setEtdNote(mode) {
      if (!etdNoteEl) return;
      if (mode === 'renovasi') {
        etdNoteEl.innerHTML = renovasiEtdNote;
        etdNoteEl.classList.remove('hidden');
        return;
      }
      if (mode === 'pelawat-bermalam') {
        etdNoteEl.textContent = defaultEtdNote;
        etdNoteEl.classList.remove('hidden');
        return;
      }
      etdNoteEl.classList.add('hidden');
    }

    const companyWrap = document.getElementById('companyWrap');
    const companyInput = document.getElementById('companyName');

    const vehicleSingleWrap = document.getElementById('vehicleSingleWrap');
    const vehicleMultiWrap = document.getElementById('vehicleMultiWrap');
    const vehicleList = document.getElementById('vehicleList');
    const addVehicleBtn = document.getElementById('addVehicleBtn');
    const getAdditionalVehicleLimit = (cat) => (cat === 'Pelawat' ? 2 : Number.POSITIVE_INFINITY);

    function refreshAddVehicleButtonState(catOverride) {
      if (!addVehicleBtn || !vehicleList) return;
      const cat = (typeof catOverride === 'string') ? catOverride : (categoryEl?.value?.trim() || '');
      const allowMulti = cat === 'Pelawat Khas' || cat === 'Pelawat';
      if (!allowMulti) {
        addVehicleBtn.disabled = true;
        addVehicleBtn.classList.add('btn-disabled');
        return;
      }
      const limit = getAdditionalVehicleLimit(cat);
      const count = vehicleList.querySelectorAll('.vehicle-row').length;
      const atLimit = Number.isFinite(limit) && count >= limit;
      // For Pelawat, keep button clickable and show a toast when user tries to exceed limit.
      if (cat === 'Pelawat') {
        addVehicleBtn.disabled = false;
        addVehicleBtn.classList.remove('btn-disabled');
      } else {
        addVehicleBtn.disabled = atLimit;
        addVehicleBtn.classList.toggle('btn-disabled', atLimit);
      }
      if (Number.isFinite(limit)) {
        if (cat === 'Pelawat' && atLimit) {
          addVehicleBtn.title = `Maksimum ${limit} kenderaan tambahan untuk Pelawat. Pilih Pelawat Khas untuk tambah lagi.`;
        } else {
          addVehicleBtn.title = atLimit
            ? `Maksimum ${limit} kenderaan tambahan untuk kategori ini.`
            : `Tambah kenderaan tambahan (maksimum ${limit}).`;
        }
      } else {
        addVehicleBtn.title = 'Tambah nombor kenderaan';
      }
    }
    resetWhatsAppAction();

    await updateUnitsLastUpdatedLabel();
    setAmendButtonState(amendLastBtn, !!getSavedLastSubmission());

    if (!form) { console.error('visitorForm missing'); return; }

    function refreshVehicleVisitorMeta() {
      const name = (visitorNameElMain?.value || '').trim() || '-';
      const phone = (visitorPhoneElMain?.value || '').trim() || '-';
      document.querySelectorAll('.vehicle-visitor-name-input').forEach((el) => {
        if (!el.value || el.value === '-') el.value = name === '-' ? '' : name;
      });
      document.querySelectorAll('.vehicle-visitor-phone-input').forEach((el) => {
        if (!el.value || el.value === '-') el.value = phone === '-' ? '' : phone;
      });
    }

    function captureRepeatPreset() {
      return {
        hostUnit: normalizeUnitInput(document.getElementById('hostUnit')?.value || ''),
        hostName: (document.getElementById('hostName')?.value || '').trim(),
        hostPhone: (document.getElementById('hostPhone')?.value || '').trim(),
        category: categoryEl?.value || '',
        subCategory: subCategoryEl?.value || '',
        companyName: (document.getElementById('companyName')?.value || '').trim()
      };
    }

    function buildAdditionalVehicleRows(source, mainVehicleNo) {
      const rowsDetailed = Array.isArray(source?.vehicleRowsDetailed) && source.vehicleRowsDetailed.length
        ? source.vehicleRowsDetailed
        : (Array.isArray(source?.vehicleNumbers) ? source.vehicleNumbers.map(v => ({ plate: v })) : []);
      const inferredFirstPlate = (() => {
        for (const item of rowsDetailed) {
          const seed = (item && typeof item === 'object') ? item : { plate: item };
          const plate = normalizeVehicleInput(seed.plate || '');
          if (plate) return plate;
        }
        return '';
      })();
      const mainPlate = normalizeVehicleInput(mainVehicleNo || '') || inferredFirstPlate;
      const seen = new Set();
      const out = [];
      rowsDetailed.forEach((item) => {
        const seed = (item && typeof item === 'object') ? item : { plate: item };
        const plate = normalizeVehicleInput(seed.plate || '');
        if (!plate) return;
        if (mainPlate && plate === mainPlate) return;
        if (seen.has(plate)) return;
        seen.add(plate);
        out.push(Object.assign({}, seed, { plate }));
      });
      return out;
    }

    function loadSubmissionIntoForm(s) {
      if (!s || typeof s !== 'object') return false;
      try {
        const hostUnitEl = document.getElementById('hostUnit');
        const hostNameEl = document.getElementById('hostName');
        const hostPhoneEl = document.getElementById('hostPhone');
        const entryDetailsEl = document.getElementById('entryDetails');
        const companyEl = document.getElementById('companyName');
        const visitorNameEl = document.getElementById('visitorName');
        const visitorPhoneEl = document.getElementById('visitorPhone');
        const vehicleNoEl = document.getElementById('vehicleNo');
        const vehicleTypeEl = document.getElementById('vehicleType');

        if (hostUnitEl) hostUnitEl.value = normalizeUnitInput(s.hostUnit || '');
        if (hostNameEl) hostNameEl.value = s.hostName || '';
        if (hostPhoneEl) hostPhoneEl.value = normalizePhoneInput(s.hostPhone || '');
        if (entryDetailsEl) entryDetailsEl.value = s.entryDetails || '';
        if (companyEl) companyEl.value = s.companyName || '';
        if (visitorNameEl) visitorNameEl.value = s.visitorName || '';
        if (visitorPhoneEl) visitorPhoneEl.value = normalizePhoneInput(s.visitorPhone || '');
        if (vehicleTypeEl && s.vehicleType) vehicleTypeEl.value = s.vehicleType;

        if (categoryEl && s.category) {
          categoryEl.value = s.category;
          categoryEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (subCategoryEl && s.subCategory) {
          subCategoryEl.value = s.subCategory;
          subCategoryEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (stayOverEl && s.stayOver) {
          stayOverEl.value = s.stayOver;
          stayOverEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (etaEl && s.eta) {
          etaEl.disabled = false;
          etaEl.value = s.eta;
          etaEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (etdEl) etdEl.value = s.etd || '';

        const rowsSeedForMain = Array.isArray(s.vehicleRowsDetailed) && s.vehicleRowsDetailed.length
          ? s.vehicleRowsDetailed
          : (Array.isArray(s.vehicleNumbers) ? s.vehicleNumbers.map(v => ({ plate: v })) : []);
        const mainVehicleNo = normalizeVehicleInput(s.vehicleNo || (Array.isArray(s.vehicleNumbers) ? (s.vehicleNumbers[0] || '') : '') || ((rowsSeedForMain[0] && rowsSeedForMain[0].plate) || ''));
        if (vehicleNoEl) vehicleNoEl.value = mainVehicleNo;
        if ((Array.isArray(s.vehicleNumbers) || Array.isArray(s.vehicleRowsDetailed)) && vehicleList) {
          vehicleList.innerHTML = '';
          const maxAdditional = getAdditionalVehicleLimit(String(s.category || '').trim());
          const rowsDetailed = buildAdditionalVehicleRows(s, mainVehicleNo);
          rowsDetailed.slice(0, maxAdditional).forEach(v => vehicleList.appendChild(createVehicleRow(v)));
          refreshAddVehicleButtonState(String(s.category || '').trim());
        }

        if (confirmAgreeEl) confirmAgreeEl.checked = true;
        scheduleDraftSave();
        updateFormProgress();
        refreshVehicleVisitorMeta();
        try { updatePaymentSummary(); } catch (e) { /* ignore */ }
        return true;
      } catch (e) {
        return false;
      }
    }

    function restoreDraftIfAny() {
      let raw = '';
      try { raw = localStorage.getItem(VISITOR_DRAFT_KEY) || ''; } catch (e) { raw = ''; }
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        if (!d || typeof d !== 'object') return;
        const hasMeaningfulData = !!((d.hostUnit || d.hostName || d.visitorName || d.category || d.eta));
        if (!hasMeaningfulData) return;

        const hostUnitEl = document.getElementById('hostUnit');
        const hostNameEl = document.getElementById('hostName');
        const hostPhoneEl2 = document.getElementById('hostPhone');
        const entryDetailsEl = document.getElementById('entryDetails');
        const companyEl = document.getElementById('companyName');
        const visitorNameEl = document.getElementById('visitorName');
        const visitorPhoneEl2 = document.getElementById('visitorPhone');
        const stayOverEl2 = document.getElementById('stayOver');
        const etaEl2 = document.getElementById('eta');
        const etdEl2 = document.getElementById('etd');
        const vehicleNoEl2 = document.getElementById('vehicleNo');
        const vehicleTypeEl = document.getElementById('vehicleType');

        if (hostUnitEl) hostUnitEl.value = normalizeUnitInput(d.hostUnit || '');
        if (hostNameEl) hostNameEl.value = d.hostName || '';
        if (hostPhoneEl2) hostPhoneEl2.value = normalizePhoneInput(d.hostPhone || '');
        if (entryDetailsEl) entryDetailsEl.value = d.entryDetails || '';
        if (visitorNameEl) visitorNameEl.value = d.visitorName || '';
        if (visitorPhoneEl2) visitorPhoneEl2.value = normalizePhoneInput(d.visitorPhone || '');
        const rowsSeedForMain = Array.isArray(d.vehicleRowsDetailed) && d.vehicleRowsDetailed.length
          ? d.vehicleRowsDetailed
          : (Array.isArray(d.vehicleNumbers) ? d.vehicleNumbers.map(v => ({ plate: v })) : []);
        const mainVehicleNo = normalizeVehicleInput(d.vehicleNo || (Array.isArray(d.vehicleNumbers) ? (d.vehicleNumbers[0] || '') : '') || ((rowsSeedForMain[0] && rowsSeedForMain[0].plate) || ''));
        if (vehicleNoEl2) vehicleNoEl2.value = mainVehicleNo;
        if (vehicleTypeEl && d.vehicleType) vehicleTypeEl.value = d.vehicleType;

        if (categoryEl && d.category) {
          categoryEl.value = d.category;
          categoryEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (subCategoryEl && d.subCategory) {
          subCategoryEl.value = d.subCategory;
          subCategoryEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (companyEl) companyEl.value = d.companyName || '';
        if (stayOverEl2 && d.stayOver) {
          stayOverEl2.value = d.stayOver;
          stayOverEl2.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (etaEl2 && d.eta) {
          etaEl2.disabled = false;
          etaEl2.value = d.eta;
          etaEl2.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (etdEl2 && d.etd) etdEl2.value = d.etd;

        if ((Array.isArray(d.vehicleNumbers) || Array.isArray(d.vehicleRowsDetailed)) && vehicleList) {
          vehicleList.innerHTML = '';
          const catNow = categoryEl?.value || '';
          const allowMulti = catNow === 'Pelawat Khas' || catNow === 'Pelawat';
          if (allowMulti) {
            const maxAdditional = getAdditionalVehicleLimit(String(catNow || '').trim());
            const rowsDetailed = buildAdditionalVehicleRows(d, mainVehicleNo);
            rowsDetailed.slice(0, maxAdditional).forEach(v => vehicleList.appendChild(createVehicleRow(v)));
            refreshAddVehicleButtonState(catNow);
          }
        }

        if (confirmAgreeEl) confirmAgreeEl.checked = !!d.confirmAgree;
        updateUnitStatus(document.getElementById('hostUnit'));
        refreshVehicleVisitorMeta();
        updatePaymentSummary();
        updateFormProgress();
        setDraftState('Draf dipulihkan automatik');
      } catch (e) {
        setDraftState('Draf rosak dan diabaikan', true);
      }
    }

    form.addEventListener('input', (ev) => {
      const t = ev.target;
      if (t && t.matches && t.matches('#vehicleList .vehicle-row .vehicle-input')) {
        t.value = normalizeVehicleInput(t.value);
      }
      scheduleDraftSave();
      updateFormProgress();
    });

    form.addEventListener('change', () => {
      scheduleDraftSave();
      updateFormProgress();
    });

    visitorNameElMain?.addEventListener('input', refreshVehicleVisitorMeta);
    visitorPhoneElMain?.addEventListener('input', refreshVehicleVisitorMeta);
    visitorNameElMain?.addEventListener('change', refreshVehicleVisitorMeta);
    visitorPhoneElMain?.addEventListener('change', refreshVehicleVisitorMeta);

    amendLastBtn?.addEventListener('click', () => {
      const saved = getSavedLastSubmission();
      if (!saved) {
        showStatus('Tiada hantaran terakhir untuk dipinda.', false);
        setAmendButtonState(amendLastBtn, false);
        return;
      }
      const ok = loadSubmissionIntoForm(saved);
      if (!ok) {
        showStatus('Gagal muat data hantaran terakhir.', false);
        return;
      }
      showStatus('Data hantaran terakhir dimuat. Sila kemas kini butiran dan tekan Hantar ke sistem.', true);
      try { document.getElementById('vehicleNo')?.focus(); } catch (e) { /* ignore */ }
    });

    // Prevent backdated ETA on the client: set min to today so datepicker blocks past dates
    try {
      const todayIsoDate = clientIsoDateOnlyKey(new Date());
      if (etaEl) etaEl.min = todayIsoDate;
      // remember the date when the user opened the form so we can accept it even if they
      // submit after midnight (avoid false 'backdated' errors when crossing midnight)
      try { window.__VISITOR_FORM_OPEN_DATE_KEY = todayIsoDate; } catch (e) { /* ignore */ }
    } catch (e) { /* ignore if date input not available */ }

    function updateVehicleControlsForCategory(cat) {
      if (!vehicleSingleWrap || !vehicleMultiWrap || !addVehicleBtn || !vehicleList) return;
      const allowMulti = cat === 'Pelawat Khas' || cat === 'Pelawat';
      if (allowMulti) {
        vehicleSingleWrap.classList.remove('hidden');
        vehicleMultiWrap.classList.remove('hidden');
        // Keep additional list empty by default; user adds rows explicitly via + button.
        if (!vehicleList.querySelector('.vehicle-row')) vehicleList.innerHTML = '';
        const limit = getAdditionalVehicleLimit(cat);
        const rows = Array.from(vehicleList.querySelectorAll('.vehicle-row'));
        if (Number.isFinite(limit) && rows.length > limit) {
          rows.slice(limit).forEach(r => r.remove());
        }
        refreshAddVehicleButtonState(cat);
        refreshAllVehicleDateFields();
      } else {
        const firstMulti = normalizeVehicleInput(getVehicleNumbersFromList()[0] || '');
        const vehicleNoEl = document.getElementById('vehicleNo');
        if (vehicleNoEl && firstMulti) vehicleNoEl.value = firstMulti;
        vehicleSingleWrap.classList.remove('hidden');
        vehicleMultiWrap.classList.add('hidden');
        addVehicleBtn.disabled = true;
        addVehicleBtn.classList.add('btn-disabled');
        vehicleList && (vehicleList.innerHTML = '');
      }
    }

    // update ETD (tarikh keluar) visibility & state based on category and stayOver
    function updateEtdState(cat) {
      if (!etdEl || !etaEl) return;
      const subCategoryVal = subCategoryEl?.value?.trim() || '';
      const allowEtdForRenovasi = cat === 'Kontraktor' && subCategoryVal === 'Renovasi';
      // when category is empty/default, ETD is not applicable -> hide
      if (!cat) {
        setEtdNote(null);
        const etdWrap = document.getElementById('etdWrap');
        if (etdWrap) { etdWrap.classList.add('hidden'); try { etdWrap.style.setProperty('display','none','important'); } catch(e){ etdWrap.style.display = 'none'; } etdWrap.setAttribute('aria-hidden','true'); }
        try { etdEl.tabIndex = -1; } catch(e) {}
        etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = '';
        return;
      }
      const etdWrap = document.getElementById('etdWrap');
      if (categoriesEtdDisabled.has(cat) && !allowEtdForRenovasi) {
        // category-level rule: ETD not applicable
        setEtdNote(null);
        etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = '';
        if (etdWrap) { etdWrap.classList.add('hidden'); try { etdWrap.style.setProperty('display','none','important'); } catch(e){ etdWrap.style.display = 'none'; } etdWrap.setAttribute('aria-hidden','true'); }
        try { etdEl.tabIndex = -1; } catch(e) {}
        return;
      }
      if (cat === 'Pelawat') {
        const stay = stayOverEl?.value || 'No';
        if (stay === 'Yes') {
          setEtdNote('pelawat-bermalam');
          etdEl.disabled = false;
          if (etdWrap) { etdWrap.classList.remove('hidden'); etdWrap.removeAttribute('aria-hidden'); try { etdWrap.style.removeProperty('display'); } catch(e){ etdWrap.style.display = ''; } }
          try { etdEl.tabIndex = 0; } catch(e) {}
          const etaVal = etaEl.value;
          if (etaVal) {
            const etaDate = dateFromInputDateOnly(etaVal);
            if (etaDate) {
              const maxDate = new Date(etaDate); maxDate.setDate(maxDate.getDate() + 2); // limit inclusive stay to max 3 days (ETA + 2)
              const toIso = d => { const yy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yy}-${mm}-${dd}`; };
              // Ensure ETD min is not earlier than today — don't allow backdated ETD
              try {
                const todayIso = clientIsoDateOnlyKey(new Date());
                const todayDate = dateFromInputDateOnly(todayIso);
                const minDate = (todayDate && etaDate && etaDate > todayDate) ? etaDate : todayDate || etaDate;
                etdEl.min = toIso(minDate);
              } catch(e) {
                etdEl.min = toIso(etaDate);
              }
              etdEl.max = toIso(maxDate);
            }
          }
        } else {
          setEtdNote(null);
          // user chose Tidak Bermalam (No) -> show ETD but lock to ETA value
          etdEl.disabled = true;
          if (etdWrap) { etdWrap.classList.remove('hidden'); etdWrap.removeAttribute('aria-hidden'); try { etdWrap.style.removeProperty('display'); } catch(e){ etdWrap.style.display = ''; } }
          try { etdEl.tabIndex = -1; } catch(e) {}
          const etaVal = etaEl.value;
          if (etaVal) {
            etdEl.value = etaVal;
            etdEl.min = etaVal;
            etdEl.max = etaVal;
          } else {
            etdEl.value = '';
            etdEl.min = '';
            etdEl.max = '';
          }
        }
        return;
      }
      setEtdNote(allowEtdForRenovasi ? 'renovasi' : null);
      etdEl.disabled = false;
      if (etdWrap) { etdWrap.classList.remove('hidden'); etdWrap.removeAttribute('aria-hidden'); try { etdWrap.style.removeProperty('display'); } catch(e){ etdWrap.style.display = ''; } }
      try { etdEl.tabIndex = 0; } catch(e) {}
      const etaVal = etaEl.value;
      if (etaVal) {
        const etaDate = dateFromInputDateOnly(etaVal);
        if (etaDate) {
          const toIso = d => { const yy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yy}-${mm}-${dd}`; };
          const maxDate = allowEtdForRenovasi ? null : new Date(etaDate);
          if (maxDate) maxDate.setDate(maxDate.getDate() + 2); // limit inclusive stay to max 3 days (ETA + 2) unless Renovasi exception
          etdEl.min = toIso(etaDate);
          etdEl.max = maxDate ? toIso(maxDate) : '';
          if (etdEl.value) {
            const cur = dateFromInputDateOnly(etdEl.value);
            if (!cur || cur < etaDate || (maxDate && cur > maxDate)) etdEl.value = '';
          }
        }
      } else { etdEl.min = ''; etdEl.max = ''; }
    }

    // hide and disable stayOver by default; only show when category === 'Pelawat'
    if (stayOverEl) {
      stayOverEl.disabled = true;
      try { stayOverEl.tabIndex = -1; } catch(e) {}
    }
    if (stayOverWrap) { stayOverWrap.classList.add('hidden'); try { stayOverWrap.style.setProperty('display','none','important'); } catch(e) { stayOverWrap.style.display ='none'; } stayOverWrap.setAttribute('aria-hidden','true'); }
    if (companyWrap && companyInput) { companyWrap.classList.add('hidden'); companyInput.disabled = true; companyInput.setAttribute('aria-hidden','true'); }
    if (vehicleMultiWrap) vehicleMultiWrap.classList.add('hidden');
    if (vehicleSingleWrap) vehicleSingleWrap.classList.remove('hidden');
    if (vehicleList) vehicleList.innerHTML = '';
    if (addVehicleBtn) { addVehicleBtn.disabled = true; addVehicleBtn.classList.add('btn-disabled'); }

    categoryEl?.addEventListener('change', (ev) => {
      const v = ev.target.value?.trim() || '';

      // If empty/default -> hide sub-category and company (and stayOver). For Pelawat Khas, we still need ETA (tarikh masuk) but ETD not applicable.
      if (!v) {
        // ensure sub-category select is cleared and disabled when not applicable
        const subWrap = document.getElementById('subCategoryWrap');
        const subSel = document.getElementById('subCategory');
        if (subSel) {
          subSel.innerHTML = '<option value="">— Pilih —</option>';
          subSel.disabled = true;
          subSel.required = false;
          subSel.setAttribute('aria-hidden', 'true');
          try { subSel.tabIndex = -1; } catch(e) {}
        }
        if (subWrap) { subWrap.classList.add('hidden'); subWrap.setAttribute('aria-hidden', 'true'); try { subWrap.style.setProperty('display','none','important'); } catch(e) { subWrap.style.display = 'none'; } }
        const subHelp = document.getElementById('subCategoryHelpWrap');
        if (subHelp) { subHelp.classList.add('hidden'); subHelp.setAttribute('aria-hidden', 'true'); try { subHelp.style.setProperty('display','none','important'); } catch(e) { subHelp.style.display = 'none'; } }
        // hide/disable company input
        setCompanyFieldState(false);
        // hide stayOver
        if (stayOverWrap) { try { stayOverWrap.style.setProperty('display','none','important'); } catch(e) { stayOverWrap.style.display='none'; } stayOverWrap.classList.add('hidden'); stayOverWrap.setAttribute('aria-hidden','true'); }
        if (stayOverEl) { stayOverEl.disabled = true; try { stayOverEl.tabIndex = -1; } catch(e) {} }
        // hide ETA / ETD when category is default or not applicable
        const etaWrapEl = document.getElementById('etaWrap');
        if (etaWrapEl) { try { etaWrapEl.style.setProperty('display','none','important'); } catch(e) { etaWrapEl.style.display = 'none'; } etaWrapEl.classList.add('hidden'); etaWrapEl.setAttribute('aria-hidden','true'); }
        if (etaEl) { etaEl.disabled = true; etaEl.value = ''; try { etaEl.tabIndex = -1; } catch(e) {} etaEl.required = false; }
        const etdWrapEl = document.getElementById('etdWrap');
        if (etdWrapEl) { try { etdWrapEl.style.setProperty('display','none','important'); } catch(e) { etdWrapEl.style.display = 'none'; } etdWrapEl.classList.add('hidden'); etdWrapEl.setAttribute('aria-hidden','true'); }
        if (etdEl) { etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = ''; try { etdEl.tabIndex = -1; } catch(e) {} }
      } else if (v === 'Pelawat') {
        // Pelawat: hide sub-category and company (stayOver is applicable)
        const subWrap = document.getElementById('subCategoryWrap');
        const subSel = document.getElementById('subCategory');
        if (subSel) {
          subSel.innerHTML = '<option value="">— Pilih —</option>';
          subSel.disabled = true;
          subSel.required = false;
          subSel.setAttribute('aria-hidden', 'true');
          try { subSel.tabIndex = -1; } catch(e){}
        }
        if (subWrap) { subWrap.classList.add('hidden'); try { subWrap.style.setProperty('display','none','important'); } catch(e) { subWrap.style.display='none'; } subWrap.setAttribute('aria-hidden','true'); }
        setCompanyFieldState(false);
        // show stayOver
        if (stayOverWrap) { stayOverWrap.classList.remove('hidden'); stayOverWrap.removeAttribute('aria-hidden'); try { stayOverWrap.style.removeProperty('display'); } catch(e) { stayOverWrap.style.display = ''; } }
        if (stayOverEl) { stayOverEl.disabled = false; try { stayOverEl.tabIndex = 0; } catch(e) {} }
        // show ETA for Pelawat
        const etaWrapEl2 = document.getElementById('etaWrap');
        if (etaWrapEl2) { etaWrapEl2.classList.remove('hidden'); etaWrapEl2.removeAttribute('aria-hidden'); try { etaWrapEl2.style.removeProperty('display'); } catch(e) { etaWrapEl2.style.display=''; } }
        if (etaEl) { etaEl.disabled = false; try { etaEl.tabIndex = 0; } catch(e) {} etaEl.required = true; }
        // ETD visibility will be handled by updateEtdState (depends on stayOver)
      } else if (v === 'Pelawat Khas') {
        // Pelawat Khas: show ETA (required), hide ETD (not applicable)
        const subWrap = document.getElementById('subCategoryWrap');
        const subSel = document.getElementById('subCategory');
        if (subSel) {
          subSel.innerHTML = '<option value="">— Pilih —</option>';
          subSel.disabled = true;
          subSel.required = false;
          subSel.setAttribute('aria-hidden', 'true');
          try { subSel.tabIndex = -1; } catch(e){}
        }
        if (subWrap) { subWrap.classList.add('hidden'); try { subWrap.style.setProperty('display','none','important'); } catch(e) { subWrap.style.display='none'; } subWrap.setAttribute('aria-hidden','true'); }
        setCompanyFieldState(false);
        // hide stayOver for Pelawat Khas (not applicable)
        if (stayOverWrap) {
          try { stayOverWrap.style.setProperty('display','none','important'); } catch(e) { stayOverWrap.style.display='none'; }
          stayOverWrap.classList.add('hidden');
          stayOverWrap.setAttribute('aria-hidden','true');
        }
        if (stayOverEl) {
          stayOverEl.value = 'No';
          stayOverEl.disabled = true;
          try { stayOverEl.tabIndex = -1; } catch(e) {}
        }
        // show ETA; ensure required
        const etaWrapPK = document.getElementById('etaWrap');
        if (etaWrapPK) { etaWrapPK.classList.remove('hidden'); etaWrapPK.removeAttribute('aria-hidden'); try { etaWrapPK.style.removeProperty('display'); } catch(e) { etaWrapPK.style.display = ''; } }
        if (etaEl) { etaEl.disabled = false; try { etaEl.tabIndex = 0; } catch(e) {} etaEl.required = true; }
        // hide ETD explicitly (Pelawat Khas not overnight)
        const etdWrapPK = document.getElementById('etdWrap');
        if (etdWrapPK) { try { etdWrapPK.style.setProperty('display','none','important'); } catch(e) { etdWrapPK.style.display = 'none'; } etdWrapPK.classList.add('hidden'); etdWrapPK.setAttribute('aria-hidden','true'); }
        if (etdEl) { etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = ''; try { etdEl.tabIndex = -1; } catch(e) {} }
      } else {
        // for other categories, populate sub-category (if available) and show company when required
        updateSubCategoryForCategory(v);
        setCompanyFieldState(companyCategories.has(v));
        // hide stayOver for non-Pelawat categories
        if (stayOverWrap) { try { stayOverWrap.style.setProperty('display','none','important'); } catch(e) { stayOverWrap.style.display='none'; } stayOverWrap.classList.add('hidden'); stayOverWrap.setAttribute('aria-hidden','true'); }
        if (stayOverEl) { stayOverEl.disabled = true; try { stayOverEl.tabIndex = -1; } catch(e) {} }
        // show ETA for other categories
        const etaWrapEl3 = document.getElementById('etaWrap');
        if (etaWrapEl3) { etaWrapEl3.classList.remove('hidden'); etaWrapEl3.removeAttribute('aria-hidden'); try { etaWrapEl3.style.removeProperty('display'); } catch(e) { etaWrapEl3.style.display=''; } }
        if (etaEl) { etaEl.disabled = false; try { etaEl.tabIndex = 0; } catch(e) {} etaEl.required = true; }
      }

      if (stayOverEl) { /* stayOver logic preserved from before */ }
      updateVehicleControlsForCategory(v);
      updateEtdState(v);
      refreshAllVehicleDateFields();
      updatePaymentSummary();
      try { renderCategorySectionNote(); } catch(e) { /* ignore */ }
    });

    subCategoryEl?.addEventListener('change', () => { showSubCategoryHelp(); const cat = categoryEl?.value?.trim() || ''; updateEtdState(cat); updatePaymentSummary(); });
    stayOverEl?.addEventListener('change', () => { const cat = categoryEl?.value?.trim() || ''; updateEtdState(cat); updateVehicleControlsForCategory(cat); refreshAllVehicleDateFields(); updatePaymentSummary(); });
    addVehicleBtn?.addEventListener('click', () => {
      if (addVehicleBtn.disabled) return;
      if (!vehicleList) return;
      const cat = categoryEl?.value?.trim() || '';
      const limit = getAdditionalVehicleLimit(cat);
      const count = vehicleList.querySelectorAll('.vehicle-row').length;
      if (Number.isFinite(limit) && count >= limit) {
        if (cat === 'Pelawat') {
          showStatus('Untuk tambah lebih banyak kenderaan, sila pilih kategori Pelawat Khas.', false);
        } else {
          showStatus(`Maksimum ${limit} kenderaan tambahan untuk kategori ini.`, false);
        }
        refreshAddVehicleButtonState(cat);
        return;
      }
      vehicleList.appendChild(createVehicleRow(''));
      refreshVehicleVisitorMeta();
      refreshAddVehicleButtonState(cat);
      updatePaymentSummary();
    });

    // Safety net: recalculate charges for any vehicle-list field edits or row mutations.
    vehicleList?.addEventListener('input', (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (t.matches('.vehicle-input, .vehicle-extra-start, .vehicle-extra-end')) {
        try { updatePaymentSummary(); } catch (e) { /* ignore */ }
      }
    });
    vehicleList?.addEventListener('change', (ev) => {
      const t = ev.target;
      if (!(t instanceof Element)) return;
      if (t.matches('.vehicle-input, .vehicle-extra-start, .vehicle-extra-end')) {
        try { updatePaymentSummary(); } catch (e) { /* ignore */ }
      }
    });
    if (vehicleList && typeof MutationObserver !== 'undefined') {
      const vehicleListObserver = new MutationObserver(() => {
        refreshAddVehicleButtonState();
        try { updatePaymentSummary(); } catch (e) { /* ignore */ }
      });
      vehicleListObserver.observe(vehicleList, { childList: true });
    }

    etaEl?.addEventListener('change', () => {
      const etaVal = etaEl.value;
      if (!etaVal) { if (etdEl) { etdEl.value = ''; etdEl.min = ''; etdEl.max = ''; } return; }
      const etaDate = dateFromInputDateOnly(etaVal);
      if (!etaDate) return;
      const maxDate = new Date(etaDate); maxDate.setDate(maxDate.getDate() + 2); // limit inclusive stay to max 3 days (ETA + 2)
      const toIso = d => { const yy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yy}-${mm}-${dd}`; };
      if (etdEl) { etdEl.min = toIso(etaDate); etdEl.max = toIso(maxDate); const cat = categoryEl?.value?.trim() || ''; updateEtdState(cat); }
      refreshAllVehicleDateFields();
      updatePaymentSummary();
    });

    etdEl?.addEventListener('change', () => { refreshAllVehicleDateFields(); updatePaymentSummary(); });

    const initCat = categoryEl?.value?.trim() || '';
    // If initial category is empty/default or Pelawat or Pelawat Khas, hide both sub-category and company
    if (!initCat || initCat === 'Pelawat' || initCat === 'Pelawat Khas') {
      // hide sub-category and helper
      const subWrapInit = document.getElementById('subCategoryWrap');
      const subSelInit = document.getElementById('subCategory');
      if (subSelInit) { subSelInit.innerHTML = '<option value="">— Pilih —</option>'; subSelInit.disabled = true; subSelInit.required = false; subSelInit.setAttribute('aria-hidden','true'); }
      if (subWrapInit) { subWrapInit.classList.add('hidden'); subWrapInit.setAttribute('aria-hidden','true'); try { subWrapInit.style.setProperty('display','none','important'); } catch(e) { subWrapInit.style.display = 'none'; } }
      const subHelpInit = document.getElementById('subCategoryHelpWrap');
      if (subHelpInit) { subHelpInit.classList.add('hidden'); subHelpInit.setAttribute('aria-hidden','true'); try { subHelpInit.style.setProperty('display','none','important'); } catch(e) { subHelpInit.style.display = 'none'; } }

      // hide company
      setCompanyFieldState(false);
      // ensure Bermalam is hidden unless initCat is Pelawat
      if (initCat === 'Pelawat') {
        if (stayOverWrap) { stayOverWrap.classList.remove('hidden'); stayOverWrap.removeAttribute('aria-hidden'); try { stayOverWrap.style.removeProperty('display'); } catch(e) { stayOverWrap.style.display=''; } }
        if (stayOverEl) { stayOverEl.disabled = false; try { stayOverEl.tabIndex = 0; } catch(e) {} }
      } else {
        if (stayOverWrap) { try { stayOverWrap.style.setProperty('display','none','important'); } catch(e) { stayOverWrap.style.display='none'; } stayOverWrap.classList.add('hidden'); stayOverWrap.setAttribute('aria-hidden','true'); }
        if (stayOverEl) { stayOverEl.disabled = true; try { stayOverEl.tabIndex = -1; } catch(e) {} }
      }
      // handle ETA/ETD initial visibility depending on initial category
      if (!initCat) {
        // initial empty -> hide both
        const etaWrapInit = document.getElementById('etaWrap');
        if (etaWrapInit) { try { etaWrapInit.style.setProperty('display','none','important'); } catch(e) { etaWrapInit.style.display='none'; } etaWrapInit.classList.add('hidden'); etaWrapInit.setAttribute('aria-hidden','true'); }
        if (etaEl) { etaEl.disabled = true; etaEl.value = ''; try { etaEl.tabIndex = -1; } catch(e) {} etaEl.required = false; }
        const etdWrapInit = document.getElementById('etdWrap');
        if (etdWrapInit) { try { etdWrapInit.style.setProperty('display','none','important'); } catch(e) { etdWrapInit.style.display='none'; } etdWrapInit.classList.add('hidden'); etdWrapInit.setAttribute('aria-hidden','true'); }
        if (etdEl) { etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = ''; try { etdEl.tabIndex = -1; } catch(e) {} }
      } else if (initCat === 'Pelawat Khas') {
        // Pelawat Khas initial -> show ETA required, hide ETD
        const etaWrapInitPK = document.getElementById('etaWrap');
        if (etaWrapInitPK) { etaWrapInitPK.classList.remove('hidden'); etaWrapInitPK.removeAttribute('aria-hidden'); try { etaWrapInitPK.style.removeProperty('display'); } catch(e) { etaWrapInitPK.style.display=''; } }
        if (etaEl) { etaEl.disabled = false; try { etaEl.tabIndex = 0; } catch(e) {} etaEl.required = true; }
        const etdWrapInitPK = document.getElementById('etdWrap');
        if (etdWrapInitPK) { try { etdWrapInitPK.style.setProperty('display','none','important'); } catch(e) { etdWrapInitPK.style.display='none'; } etdWrapInitPK.classList.add('hidden'); etdWrapInitPK.setAttribute('aria-hidden','true'); }
        if (etdEl) { etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = ''; try { etdEl.tabIndex = -1; } catch(e) {} }
      } else if (initCat === 'Pelawat') {
        // Pelawat -> show ETA and stayOver handled above
        const etaWrapInit2 = document.getElementById('etaWrap');
        if (etaWrapInit2) { etaWrapInit2.classList.remove('hidden'); etaWrapInit2.removeAttribute('aria-hidden'); try { etaWrapInit2.style.removeProperty('display'); } catch(e) { etaWrapInit2.style.display=''; } }
        if (etaEl) { etaEl.disabled = false; try { etaEl.tabIndex = 0; } catch(e) {} etaEl.required = true; }
      } else {
        // other non-empty category -> eta visible and required
        const etaWrapInit3 = document.getElementById('etaWrap');
        if (etaWrapInit3) { etaWrapInit3.classList.remove('hidden'); etaWrapInit3.removeAttribute('aria-hidden'); try { etaWrapInit3.style.removeProperty('display'); } catch(e) { etaWrapInit3.style.display=''; } }
        if (etaEl) { etaEl.disabled = false; try { etaEl.tabIndex = 0; } catch(e) {} etaEl.required = true; }
      }
    } else {
      setCompanyFieldState(companyCategories.has(initCat));
      updateSubCategoryForCategory(initCat);
    }
    updateVehicleControlsForCategory(initCat);
    updateEtdState(initCat);
    refreshAllVehicleDateFields();
    refreshVehicleVisitorMeta();
    try { renderCategorySectionNote(); } catch(e) { /* ignore */ }
    updatePaymentSummary();
    restoreDraftIfAny();
    updateFormProgress();

    const submitBtn = document.getElementById('submitBtn');

    // submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showStatus('', true);

      const focusFieldWithStatus = (fieldId, message) => {
        const el = document.getElementById(fieldId);
        if (el) {
          try { el.focus(); } catch (err) { /* ignore */ }
          try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (err) { /* ignore */ }
        }
        showStatus(message, false);
      };

      if (isMockSubmit) {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.classList.add('btn-disabled');
          submitBtn.classList.remove('is-success');
        }
        setTimeout(() => {
          playButtonSuccessAnimation(submitBtn);
          enableWhatsAppAction({ mock: true });
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('btn-disabled');
          }
        }, 550);
        return;
      }

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

      // basic validation
      if (!hostUnit) { focusFieldWithStatus('hostUnit', 'Sila masukkan Unit rumah.'); return; }
      if (!isPatternValidUnit(hostUnit)) { focusFieldWithStatus('hostUnit', 'Format Unit tidak sah. Gunakan contoh A-12-03.'); return; }
      if (!hostName) { focusFieldWithStatus('hostName', 'Sila lengkapkan Butiran Penghuni (Nama).'); return; }
      if (!category) { focusFieldWithStatus('category', 'Sila pilih Kategori.'); return; }
      if (subCategoryMap[category] && !subCategory) { focusFieldWithStatus('subCategory', 'Sila pilih pilihan bagi kategori ini.'); return; }
      if (companyCategories.has(category) && !companyName) { focusFieldWithStatus('companyName', 'Sila masukkan Nama syarikat.'); return; }
      if (!visitorName) { focusFieldWithStatus('visitorName', 'Sila masukkan Nama Pelawat.'); return; }
      if (!etaVal) { focusFieldWithStatus('eta', 'Sila pilih Tarikh masuk.'); return; }
      if (!validatePhone(visitorPhone)) { focusFieldWithStatus('visitorPhone', 'Nombor telefon pelawat tidak sah.'); return; }
      if (hostPhone && !validatePhone(hostPhone)) { focusFieldWithStatus('hostPhone', 'Nombor telefon penghuni tidak sah.'); return; }

      const etaDate = dateFromInputDateOnly(etaVal);
      const etdDate = etdVal ? dateFromInputDateOnly(etdVal) : null;
      if (!etaDate) { showStatus('Tarikh masuk tidak sah.', false); return; }
      // Client-side prevention for backdated ETA (date-only compare)
      // Allow the date that the user selected when the form was opened to still be accepted
      try {
        const formOpenKey = window.__VISITOR_FORM_OPEN_DATE_KEY || clientIsoDateOnlyKey(new Date());
        const etaKey = clientIsoDateOnlyKey(etaDate);
        if (etaKey < formOpenKey) {
          showStatus('Tarikh masuk mestilah sama atau selepas tarikh anda mula mengisi borang.', false);
          return;
        }
      } catch (e) { /* ignore comparison failures */ }
      if (etdVal && !etdDate) { showStatus('Tarikh keluar tidak sah.', false); return; }
      if (etdDate) {
        // disallow backdated etd even if eta allowed — ETD must not be before today
        try {
          const todayKey = clientIsoDateOnlyKey(new Date());
          const etdKey = clientIsoDateOnlyKey(etdDate);
          if (etdKey < todayKey) {
            showStatus('Tarikh keluar mestilah hari ini atau kemudian — tarikh lampau tidak dibenarkan.', false);
            return;
          }
        } catch(e) { /* ignore */ }
        const max = new Date(etaDate); max.setDate(max.getDate() + 2); // limit inclusive stay to max 3 days (ETA + 2)
        if (etdDate < etaDate || etdDate > max) { showStatus('Tarikh keluar mesti antara Tarikh masuk hingga 2 hari selepas Tarikh masuk (maks. 3 hari termasuk tarikh masuk).', false); return; }
      }

      // agreement checkbox
      if (!(confirmAgreeEl && confirmAgreeEl.checked)) {
        if (confirmAgreeEl) confirmAgreeEl.focus();
        showStatus('Sila tandakan "Saya setuju" untuk meneruskan.', false);
        return;
      }

      // vehicle handling
      let vehicleNo = '';
      let vehicleNumbers = [];
      const allowMultiVehicle = category === 'Pelawat Khas' || category === 'Pelawat';
      if (allowMultiVehicle) {
        const fromList = getVehicleNumbersFromList().map(v => String(v).trim().toUpperCase()).filter(Boolean);
        const fromSingle = (document.getElementById('vehicleNo')?.value || '').trim().toUpperCase();
        vehicleNumbers = Array.from(new Set([...fromList, fromSingle].filter(Boolean)));
        if (category === 'Pelawat' && vehicleNumbers.length > 3) {
          showStatus('Kategori Pelawat hanya dibenarkan maksimum 3 kenderaan (1 utama + 2 tambahan).', false);
          return;
        }
        if (category === 'Pelawat Khas' && !vehicleNumbers.length) { showStatus('Sila masukkan sekurang-kurangnya satu nombor kenderaan untuk Pelawat Khas.', false); return; }
        vehicleNo = vehicleNumbers.length ? vehicleNumbers[0] : '';
      } else {
        vehicleNo = (document.getElementById('vehicleNo')?.value || '').trim().toUpperCase();
      }

      const unitFound = units.includes(hostUnit);
      if (!unitFound) { const el = document.getElementById('hostUnit'); setFieldError(el, 'Unit tidak ditemui dalam senarai'); try { el.focus(); } catch(e) {} updateUnitStatus(el); showStatus('Unit tidak ditemui dalam senarai; pastikan ia betul.', false); return; }

      // try to attach current unit metadata (snapshot) from units/{id} if available
      let unitSnapshot = null;
      try {
        const unitRef = doc(window.__FIRESTORE, 'units', hostUnit);
        const udoc = await getDoc(unitRef);
        if (udoc && udoc.exists()) unitSnapshot = udoc.data();
        currentUnitId = hostUnit;
        currentUnitSnapshot = unitSnapshot;
        updatePaymentSummary();
      } catch(e) { /* ignore if read fails */ }

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

      const lastSubmissionSnapshot = {
        hostUnit,
        hostName,
        hostPhone: hostPhone || '',
        category,
        subCategory,
        entryDetails: entryDetails || '',
        companyName: companyName || '',
        visitorName,
        visitorPhone: visitorPhone || '',
        stayOver: (category === 'Pelawat') ? (stayOver === 'Yes' ? 'Yes' : 'No') : 'No',
        eta: etaVal || '',
        etd: etdVal || '',
        vehicleNo: vehicleNo || '',
        vehicleNumbers: vehicleNumbers.length ? vehicleNumbers : (vehicleNo ? [vehicleNo] : []),
        vehicleType: vehicleType || '',
        savedAt: Date.now()
      };

      // if units/{hostUnit} exists, snapshot category/arrears into payload for future reference
      if (unitSnapshot) {
        payload.unitCategory = unitSnapshot.category || '';
        payload.unitArrears = !!unitSnapshot.arrears;
        if (typeof unitSnapshot.arrearsAmount === 'number') payload.unitArrearsAmount = unitSnapshot.arrearsAmount;
        if (unitSnapshot.lastUpdatedAt) payload.unitLastUpdatedAt = unitSnapshot.lastUpdatedAt;
      }

      // client-side duplicate guard: prevent same submission within short window
      const _fingerprint = clientFingerprintForSubmission({ etaDate, hostUnit, visitorPhone, visitorName });
      const _dupCheck = clientIsDuplicateRecently(_fingerprint);
      if (category !== 'Pelawat' && _dupCheck && _dupCheck.duplicate) {
        const mins = Math.ceil((_dupCheck.remainingMs || 0) / 60000);
        showStatus(`Pendaftaran serupa dihantar baru-baru ini — sila tunggu ${mins} minit sebelum cuba lagi.`, false);
        return;
      }

      // disable submit to prevent double click / double submit
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('btn-disabled');
        submitBtn.classList.remove('is-success');
      }

      try {
        // attempt create with server-side dedupe transaction
        // create response (atomic) and dedupe key inside a transaction to avoid duplicates
        const resp = await createResponseWithDedupe(payload);
        if (resp && resp.fallback) {
          // we succeeded but without dedupe enforcement (callable not available or blocked)
          // mark in local cache so subsequent accidental resubmits are blocked by client
          try { clientMarkSubmission(_fingerprint); } catch(e) {}
        } else {
          try { clientMarkSubmission(_fingerprint); } catch(e) {}
        }
        if (resp && resp.amended) {
          showStatus('Pendaftaran sedia ada berjaya dikemaskini dengan butiran kenderaan baharu.', true);
        }
        saveLastSubmission(lastSubmissionSnapshot);
        setAmendButtonState(amendLastBtn, true);
        enableWhatsAppAction(payload);
        playButtonSuccessAnimation(submitBtn);
        const repeatPreset = (repeatModeEl && repeatModeEl.checked) ? captureRepeatPreset() : null;
        form.reset();
        // clear any visual error state left on the hostUnit input after reset
        try { clearFieldError(document.getElementById('hostUnit')); updateUnitStatus(document.getElementById('hostUnit')); } catch(e) {}
        closeSuggestions(wrapper);
        if (confirmAgreeEl) confirmAgreeEl.checked = false;
        setCompanyFieldState(false);
        updateSubCategoryForCategory('');
        if (vehicleMultiWrap) vehicleMultiWrap.classList.add('hidden');
        if (vehicleSingleWrap) vehicleSingleWrap.classList.remove('hidden');
        if (vehicleList) vehicleList.innerHTML = '';
        if (addVehicleBtn) { addVehicleBtn.disabled = true; addVehicleBtn.classList.add('btn-disabled'); }
        if (stayOverEl) { stayOverEl.disabled = true; stayOverEl.value = 'No'; }
        resetPaymentSummary();
        // hide ETA and ETD after successful submit (form reset -> default state)
        const etaWrapAfter = document.getElementById('etaWrap');
        if (etaWrapAfter) { try { etaWrapAfter.style.setProperty('display','none','important'); } catch(e) { etaWrapAfter.style.display='none'; } etaWrapAfter.classList.add('hidden'); etaWrapAfter.setAttribute('aria-hidden','true'); }
        if (etaEl) { etaEl.disabled = true; etaEl.value = ''; try { etaEl.tabIndex = -1; } catch(e) {} etaEl.required = false; }
        if (etdEl) { etdEl.min = ''; etdEl.max = ''; etdEl.value = ''; etdEl.disabled = true; try { etdEl.tabIndex = -1; } catch(e) {} }

        if (repeatPreset) {
          const hostUnitEl = document.getElementById('hostUnit');
          const hostNameEl = document.getElementById('hostName');
          const hostPhoneEl2 = document.getElementById('hostPhone');
          const companyEl = document.getElementById('companyName');
          if (hostUnitEl) hostUnitEl.value = repeatPreset.hostUnit;
          if (hostNameEl) hostNameEl.value = repeatPreset.hostName;
          if (hostPhoneEl2) hostPhoneEl2.value = normalizePhoneInput(repeatPreset.hostPhone);
          if (categoryEl) {
            categoryEl.value = repeatPreset.category;
            categoryEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (subCategoryEl && repeatPreset.subCategory) {
            subCategoryEl.value = repeatPreset.subCategory;
            subCategoryEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (companyEl) companyEl.value = repeatPreset.companyName || '';
          setDraftState('Sedia untuk pendaftaran seterusnya');
        } else {
          clearDraft();
        }
        updateFormProgress();
      } catch (err) {
        console.error('visitor add error', err);
        // handle duplicate returned from transaction
        if (err && (err.code === 'DUPLICATE' || String(err).toLowerCase().includes('duplicate'))) {
          showStatus('Pendaftaran serupa telah wujud untuk tarikh ini — tidak dihantar.', false);
        } else if (err && err.code === 'COMBINE_REQUIRED') {
          showStatus('Pendaftaran Pelawat untuk unit dan julat tarikh ini telah wujud dari peranti lain. Sila kemas kini rekod asal pada peranti yang sama, atau hubungi pentadbir untuk bantuan pindaan.', false, { duration: 12000 });
        } else if (err && err.code === 'COOLDOWN') {
          try {
            const d = err.until instanceof Date ? err.until : (err.untilISO ? new Date(err.untilISO) : null);
            let dateText = '';
            if (d && !isNaN(d.getTime())) {
              const dd = String(d.getDate()).padStart(2,'0');
              const mm = String(d.getMonth()+1).padStart(2,'0');
              const yyyy = d.getFullYear();
              // If time present and not midnight UTC, include local time
              const includeTime = d.getHours() !== 0 || d.getMinutes() !== 0;
              const timeText = includeTime ? ` ${d.toLocaleTimeString()}` : '';
              dateText = `${dd}/${mm}/${yyyy}${timeText}`;
            }
            const msg = dateText
              ? `Unit ini dalam tempoh bertenang sehingga ${dateText}. Sila cuba semula selepas tarikh ini atau hubungi pentadbir.`
              : 'Unit ini dalam tempoh bertenang. Sila cuba semula kemudian atau hubungi pentadbir.';
            showStatus(msg, false, { duration: 12000 });
          } catch (e) {
            showStatus('Unit ini dalam tempoh bertenang. Sila cuba semula kemudian atau hubungi pentadbir.', false);
          }
        } else if (err && (String(err.code || '').toLowerCase().includes('permission') || String(err.code || '').toLowerCase().includes('internal') || String(err.code || '').toLowerCase().includes('fallback') || String(err).toLowerCase().includes('fallback'))) {
          // permission or internal server errors — provide a clearer action for the user
          console.warn('Server / fallback error during submission:', err);
          showStatus('Gagal hantar — masalah pelayan atau kebenaran. Sila hubungi pentadbir.', false);
        } else {
          showStatus('Gagal hantar. Sila cuba lagi atau hubungi pentadbir.', false);
        }
      } finally {
        // always re-enable submit btn after attempt
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('btn-disabled');
        }
      }
    });

    waBtn?.addEventListener('click', () => {
      if (isMockSubmit && !pendingWaPayload) {
        pendingWaPayload = { mock: true };
        enableWhatsAppAction(pendingWaPayload);
      }
      if (!pendingWaPayload) return;
      waBtn.classList.remove('is-success');
      if (isMockSubmit) {
        setTimeout(() => {
          playButtonSuccessAnimation(waBtn);
        }, 450);
        return;
      }
      playButtonSuccessAnimation(waBtn);
      try { openWhatsAppNotification(pendingWaPayload); } catch (e) { console.warn('WA open failed', e); }
    });

    // clear handler
    clearBtn?.addEventListener('click', () => {
      form.reset();
      try { clearFieldError(document.getElementById('hostUnit')); updateUnitStatus(document.getElementById('hostUnit')); } catch(e) {}
      showStatus('', true);
      closeSuggestions(wrapper);
      if (confirmAgreeEl) confirmAgreeEl.checked = false;
      setCompanyFieldState(false);
      updateSubCategoryForCategory('');
      if (vehicleMultiWrap) vehicleMultiWrap.classList.add('hidden');
      if (vehicleSingleWrap) vehicleSingleWrap.classList.remove('hidden');
      if (vehicleList) vehicleList.innerHTML = '';
      if (addVehicleBtn) { addVehicleBtn.disabled = true; addVehicleBtn.classList.add('btn-disabled'); }
      if (stayOverEl) { stayOverEl.disabled = true; stayOverEl.value = 'No'; }
      resetPaymentSummary();
      resetWhatsAppAction();
      try { submitBtn?.classList.remove('is-active','is-loading','is-success'); } catch(e) {}
      // hide ETA and ETD when form cleared
      const etaWrapClear = document.getElementById('etaWrap');
      if (etaWrapClear) { try { etaWrapClear.style.setProperty('display','none','important'); } catch(e) { etaWrapClear.style.display='none'; } etaWrapClear.classList.add('hidden'); etaWrapClear.setAttribute('aria-hidden','true'); }
      if (etaEl) { etaEl.disabled = true; etaEl.value = ''; try { etaEl.tabIndex = -1; } catch(e) {} etaEl.required = false; }
      if (etdEl) { etdEl.min = ''; etdEl.max = ''; etdEl.value = ''; etdEl.disabled = true; try { etdEl.tabIndex = -1; } catch(e) {} }
      refreshVehicleVisitorMeta();
      clearDraft();
      updateFormProgress();
    });
  })();
});
