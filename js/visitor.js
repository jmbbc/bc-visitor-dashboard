// js/visitor.js - lengkap: grouped autocomplete + normalization + agreement checkbox
import {
  collection, serverTimestamp, Timestamp, doc, setDoc, runTransaction, getDoc, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-functions.js";

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

async function ensureUnitImportMeta(){
  if (unitImportMetaTs) return { ts: unitImportMetaTs, label: unitImportMetaLabel };
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
  try { if (statusEl) statusEl.innerHTML = ''; } catch(e) {}
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

async function createResponseWithDedupe(payload){
  // Use Cloud Function (callable) to perform server-side transaction (avoids client permission issues)
  if (!window.__FIREBASE_APP) throw new Error('Firebase app not available');

  // Normalize ETA/ETD to ISO strings (callable serializes JSON cleanly)
  const safePayload = Object.assign({}, payload);
  try { if (safePayload.eta && safePayload.eta.toDate) safePayload.eta = safePayload.eta.toDate().toISOString(); } catch(e) {}
  try { if (safePayload.etd && safePayload.etd.toDate) safePayload.etd = safePayload.etd.toDate().toISOString(); } catch(e) {}
  // (server-side callable will compute dedupe key and run the transaction)

  const funcs = getFunctions(window.__FIREBASE_APP);
  const fn = httpsCallable(funcs, 'createResponseWithDedupe');
  try {
    const res = await fn({ payload: safePayload });
    if (res && res.data && res.data.success) return { success: true, id: res.data.id, fallback: false };
    throw new Error('function_failed');
  } catch (err) {
    // firebase functions throws HttpsError with code property
    const code = err && err.code ? err.code : (err && err.message ? err.message : 'server_error');
    // duplicate error returned from server-side transaction (explicit duplicate) -> bubble up
    if (String(code).toLowerCase().includes('already-exists') || String(err).toLowerCase().includes('duplicate')) {
      const e = new Error('duplicate'); e.code = 'DUPLICATE'; throw e;
    }

    // cooldown enforcement from server: don't attempt client fallback, surface to UI
    const codeStr = String(code).toLowerCase();
    const msgStr = String(err && (err.message || err)).toLowerCase();
    if (codeStr.includes('failed-precondition') || msgStr.includes('cooldown_until')) {
      const rawMsg = String(err && (err.message || err)) || '';
      const m = rawMsg.match(/cooldown_until:([^\s]+)/i);
      const iso = m && m[1] ? m[1] : null;
      const until = iso ? new Date(iso) : null;
      const e = new Error('cooldown');
      e.code = 'COOLDOWN';
      if (until && !isNaN(until.getTime())) { e.until = until; e.untilISO = iso; }
      throw e;
    }

    // If the callable failed for permission reasons (client can't touch dedupeKeys) or
    // the function is not deployed, fall back to a best-effort client-only write to
    // `responses` (no dedupe). This keeps the user's submission from being blocked.
    console.warn('createResponseWithDedupe callable failed — attempting client-only fallback', err);

    try {
      // wait for Firestore to be available in the page context
      await waitForFirestore(3000);
    } catch (waitErr) {
      // if firestore not available, rethrow the original error
      console.error('firestore unavailable for fallback', waitErr);
      throw err;
    }

    // Build a deterministic-ish id so we can still reference the submission if needed
    const fallbackId = `resp-${Date.now()}-${_shortId()}`;
    const ref = doc(window.__FIRESTORE, 'responses', fallbackId);

    // Use the original payload (keep timestamps as sent) and ensure createdAt/updatedAt are present
    const clientPayload = Object.assign({}, payload);
    if (!clientPayload.createdAt) clientPayload.createdAt = serverTimestamp();
    if (!clientPayload.updatedAt) clientPayload.updatedAt = serverTimestamp();

    try {
      await setDoc(ref, clientPayload);
      // indicate fallback was used
      return { success: true, id: fallbackId, fallback: true };
    } catch (writeErr) {
      console.error('fallback write to responses failed', writeErr);
      // return a richer error so callers can show a precise message
      const e = new Error('fallback_failed');
      e.code = writeErr.code || err.code || 'FALLBACK_FAILED';
      e.message = `Fallback write failed: ${writeErr?.message || writeErr} — original: ${err?.message || err}`;
      e.writeError = writeErr;
      e.originalError = err;
      throw e;
    }
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
  input.setAttribute('aria-label','Nombor kenderaan');
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

function showCategoryHelp(){
  const select = document.getElementById('category');
  const val = select?.value || '';
  const helpWrap = document.getElementById('categoryHelpWrap');
  const helpEl = document.getElementById('categoryHelp');
  if (!helpEl || !helpWrap) return;

  if (val && categoryHelpMap[val]){
    helpEl.textContent = categoryHelpMap[val];
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

  const lines = [
    'Pendaftaran Pelawat Baru',
    `Unit: ${payload.hostUnit || '-'}`,
    `Nama penghuni: ${payload.hostName || '-'}`,
    `Nombor telefon penghuni: ${payload.hostPhone || '-'}`,
    `Nama pelawat: ${payload.visitorName || '-'}`,
    `Nombor telefon pelawat: ${payload.visitorPhone || '-'}`,
    `Tarikh masuk: ${etaText}`,
    `Tarikh keluar: ${etdText}`,
    `Kenderaan: ${ (payload.vehicleNumbers && payload.vehicleNumbers.length) ? payload.vehicleNumbers.join('; ') : (payload.vehicleNo || '-') }`,
    `Kategori: ${payload.category || '-'}`,    const sample = { hostUnit:'A-12-03', hostName:'Test', hostPhone:'0123456789', visitorName:'Ahmad', visitorPhone:'0123456789', eta: new Date(), etd: new Date(), vehicleNo:'ABC123', vehicleNumbers:[], category:'Pelawat' };
    setTimeout(()=> openWhatsAppNotification(sample), 1500);
  ];
  const text = encodeURIComponent(lines.join('\n'));
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

  // Debug helper: if URL contains ?debug=1, show a visible test button to simulate WhatsApp open (useful for iPhone tests)
  try {
    const params = new URLSearchParams(window.location.search);
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
    } catch (err) { /* ignore */ }
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
  input?.addEventListener('blur', (e) => {
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
      } else {
        clearFieldError(input);
        updateUnitStatus(input);
        showStatus('', true);
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
    const categoryEl = document.getElementById('category');
    const subCategoryEl = document.getElementById('subCategory');
    const stayOverEl = document.getElementById('stayOver');
    const stayOverWrap = document.getElementById('stayOverWrap');
    const etaEl = document.getElementById('eta');
    const etdEl = document.getElementById('etd');

    const companyWrap = document.getElementById('companyWrap');
    const companyInput = document.getElementById('companyName');

    const vehicleSingleWrap = document.getElementById('vehicleSingleWrap');
    const vehicleMultiWrap = document.getElementById('vehicleMultiWrap');
    const vehicleList = document.getElementById('vehicleList');
    const addVehicleBtn = document.getElementById('addVehicleBtn');

    await updateUnitsLastUpdatedLabel();

    if (!form) { console.error('visitorForm missing'); return; }

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

    // update ETD (tarikh keluar) visibility & state based on category and stayOver
    function updateEtdState(cat) {
      if (!etdEl || !etaEl) return;
      // when category is empty/default, ETD is not applicable -> hide
      if (!cat) {
        const etdWrap = document.getElementById('etdWrap');
        if (etdWrap) { etdWrap.classList.add('hidden'); try { etdWrap.style.setProperty('display','none','important'); } catch(e){ etdWrap.style.display = 'none'; } etdWrap.setAttribute('aria-hidden','true'); }
        try { etdEl.tabIndex = -1; } catch(e) {}
        etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = '';
        return;
      }
      const etdWrap = document.getElementById('etdWrap');
      if (categoriesEtdDisabled.has(cat)) {
        // category-level rule: ETD not applicable
        etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = '';
        if (etdWrap) { etdWrap.classList.add('hidden'); try { etdWrap.style.setProperty('display','none','important'); } catch(e){ etdWrap.style.display = 'none'; } etdWrap.setAttribute('aria-hidden','true'); }
        try { etdEl.tabIndex = -1; } catch(e) {}
        return;
      }
      if (cat === 'Pelawat') {
        const stay = stayOverEl?.value || 'No';
        if (stay === 'Yes') {
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
          // user chose Tidak Bermalam (No) -> hide and disable ETD
          etdEl.disabled = true; etdEl.value = ''; etdEl.min = ''; etdEl.max = '';
          if (etdWrap) { etdWrap.classList.add('hidden'); try { etdWrap.style.setProperty('display','none','important'); } catch(e){ etdWrap.style.display = 'none'; } etdWrap.setAttribute('aria-hidden','true'); }
          try { etdEl.tabIndex = -1; } catch(e) {}
        }
        return;
      }
      etdEl.disabled = false;
      if (etdWrap) { etdWrap.classList.remove('hidden'); etdWrap.removeAttribute('aria-hidden'); try { etdWrap.style.removeProperty('display'); } catch(e){ etdWrap.style.display = ''; } }
      try { etdEl.tabIndex = 0; } catch(e) {}
      const etaVal = etaEl.value;
      if (etaVal) {
        const etaDate = dateFromInputDateOnly(etaVal);
        if (etaDate) {
          const maxDate = new Date(etaDate); maxDate.setDate(maxDate.getDate() + 2); // limit inclusive stay to max 3 days (ETA + 2)
          const toIso = d => { const yy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yy}-${mm}-${dd}`; };
          etdEl.min = toIso(etaDate); etdEl.max = toIso(maxDate);
          if (etdEl.value) {
            const cur = dateFromInputDateOnly(etdEl.value);
            if (!cur || cur < etaDate || cur > maxDate) etdEl.value = '';
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
      // show category helper note if available
      try { showCategoryHelp(); } catch(e) { /* ignore */ }
    });

    subCategoryEl?.addEventListener('change', showSubCategoryHelp);
    stayOverEl?.addEventListener('change', () => { const cat = categoryEl?.value?.trim() || ''; updateEtdState(cat); });
    addVehicleBtn?.addEventListener('click', () => { if (addVehicleBtn.disabled) return; if (!vehicleList) return; vehicleList.appendChild(createVehicleRow('')); });

    etaEl?.addEventListener('change', () => {
      const etaVal = etaEl.value;
      if (!etaVal) { if (etdEl) { etdEl.value = ''; etdEl.min = ''; etdEl.max = ''; } return; }
      const etaDate = dateFromInputDateOnly(etaVal);
      if (!etaDate) return;
      const maxDate = new Date(etaDate); maxDate.setDate(maxDate.getDate() + 2); // limit inclusive stay to max 3 days (ETA + 2)
      const toIso = d => { const yy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yy}-${mm}-${dd}`; };
      if (etdEl) { etdEl.min = toIso(etaDate); etdEl.max = toIso(maxDate); const cat = categoryEl?.value?.trim() || ''; updateEtdState(cat); }
    });

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
    try { showCategoryHelp(); } catch(e) { /* ignore */ }

    const submitBtn = document.getElementById('submitBtn');

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

      // basic validation
      if (!hostUnit) { showStatus('Sila masukkan Unit rumah.', false); return; }
      if (!isPatternValidUnit(hostUnit)) { showStatus('Format Unit tidak sah. Gunakan contoh A-12-03.', false); return; }
      if (!hostName) { showStatus('Sila lengkapkan Butiran Penghuni (Nama).', false); return; }
      if (!category) { showStatus('Sila pilih Kategori.', false); return; }
      if (subCategoryMap[category] && !subCategory) { showStatus('Sila pilih pilihan bagi kategori ini.', false); return; }
      if (companyCategories.has(category) && !companyName) { showStatus('Sila masukkan Nama syarikat.', false); return; }
      if (!visitorName) { showStatus('Sila masukkan Nama Pelawat.', false); return; }
      if (!etaVal) { showStatus('Sila pilih Tarikh masuk.', false); return; }
      if (!validatePhone(visitorPhone)) { showStatus('Nombor telefon pelawat tidak sah.', false); return; }
      if (hostPhone && !validatePhone(hostPhone)) { showStatus('Nombor telefon penghuni tidak sah.', false); return; }

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
      if (category === 'Pelawat Khas') {
        vehicleNumbers = getVehicleNumbersFromList().map(v => String(v).trim().toUpperCase());
        if (!vehicleNumbers.length) { showStatus('Sila masukkan sekurang-kurangnya satu nombor kenderaan untuk Pelawat Khas.', false); return; }
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
      } catch(e) { /* ignore if read fails */ }

      // Show notice for arrears category (non-blocking submission, but requires acknowledgement)
      if (unitSnapshot && typeof unitSnapshot.arrearsAmount === 'number') {
        const arrearsCat = computeArrearsCategory(unitSnapshot.arrearsAmount);
        if (arrearsCat && arrearsCat >= 2) {
          // get latest CSV import timestamp if available
          let metaTs = unitImportMetaTs || null;
          if (!metaTs) {
            try { const meta = await ensureUnitImportMeta(); metaTs = meta.ts || null; } catch(e) { /* ignore */ }
          }
          if (!metaTs) metaTs = unitSnapshot.lastUpdatedAt || null;
          const acknowledged = await showUnitNoticeModal({ category: arrearsCat, amount: unitSnapshot.arrearsAmount, eta: etaDate, etd: etdDate, visitorCategory: category, lastUpdatedAt: metaTs });
          if (!acknowledged) {
            showStatus('Pendaftaran dibatalkan.', false);
            return;
          }
        }
      }

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
      if (_dupCheck && _dupCheck.duplicate) {
        const mins = Math.ceil((_dupCheck.remainingMs || 0) / 60000);
        showStatus(`Pendaftaran serupa dihantar baru-baru ini — sila tunggu ${mins} minit sebelum cuba lagi.`, false);
        return;
      }

      // disable submit to prevent double click / double submit
      if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('btn-disabled'); }

      try {
        // attempt create with server-side dedupe transaction
        // create response (atomic) and dedupe key inside a transaction to avoid duplicates
        const resp = await createResponseWithDedupe(payload);

        // QUICK WA: attempt to open WhatsApp (app -> web). If blocked show action button for user gesture.
        try { openWhatsAppNotification(payload); } catch (e) { console.warn('WA open failed', e); }

        if (resp && resp.fallback) {
          // we succeeded but without dedupe enforcement (callable not available or blocked)
          showStatus('Pendaftaran berjaya (tanpa semakan duplikasi).', true);
          // mark in local cache so subsequent accidental resubmits are blocked by client
          try { clientMarkSubmission(_fingerprint); } catch(e) {}
        } else {
          showStatus('Pendaftaran berjaya. Terima kasih.', true);
          try { clientMarkSubmission(_fingerprint); } catch(e) {}
        }
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
        // hide ETA and ETD after successful submit (form reset -> default state)
        const etaWrapAfter = document.getElementById('etaWrap');
        if (etaWrapAfter) { try { etaWrapAfter.style.setProperty('display','none','important'); } catch(e) { etaWrapAfter.style.display='none'; } etaWrapAfter.classList.add('hidden'); etaWrapAfter.setAttribute('aria-hidden','true'); }
        if (etaEl) { etaEl.disabled = true; etaEl.value = ''; try { etaEl.tabIndex = -1; } catch(e) {} etaEl.required = false; }
        if (etdEl) { etdEl.min = ''; etdEl.max = ''; etdEl.value = ''; etdEl.disabled = true; try { etdEl.tabIndex = -1; } catch(e) {} }
      } catch (err) {
        console.error('visitor add error', err);
        // handle duplicate returned from transaction
        if (err && (err.code === 'DUPLICATE' || String(err).toLowerCase().includes('duplicate'))) {
          showStatus('Pendaftaran serupa telah wujud untuk tarikh ini — tidak dihantar.', false);
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
        if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('btn-disabled'); }
      }
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
      // hide ETA and ETD when form cleared
      const etaWrapClear = document.getElementById('etaWrap');
      if (etaWrapClear) { try { etaWrapClear.style.setProperty('display','none','important'); } catch(e) { etaWrapClear.style.display='none'; } etaWrapClear.classList.add('hidden'); etaWrapClear.setAttribute('aria-hidden','true'); }
      if (etaEl) { etaEl.disabled = true; etaEl.value = ''; try { etaEl.tabIndex = -1; } catch(e) {} etaEl.required = false; }
      if (etdEl) { etdEl.min = ''; etdEl.max = ''; etdEl.value = ''; etdEl.disabled = true; try { etdEl.tabIndex = -1; } catch(e) {} }
    });
  })();
});
