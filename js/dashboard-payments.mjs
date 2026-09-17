import * as sdk from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import {createPaymentStore} from './payment-store.mjs';
import {parseRinggit} from './parking-payments.mjs';

if (new URLSearchParams(location.search).get('preview') !== '1') {
  const host = document.getElementById('pageSummary');
  const panel = document.createElement('section');
  panel.className = 'card';
  panel.id = 'registrationPaymentPanel';
  panel.hidden = true;
  panel.innerHTML = `<div class="payment-panel-head"><div><h3>Pengesahan Bayaran Parkir</h3><p>Admin dan pengawal boleh merekod bayaran. Pelarasan caj serta pembatalan kekal untuk admin sahaja.</p></div><button type="button" class="btn-ghost" data-close aria-label="Tutup panel pembayaran">Tutup</button></div>
    <p data-role-note></p>
    <form data-load><label>ID pendaftaran <input name="registration" required autocomplete="off"></label> <button>Muat rekod</button></form>
    <p data-summary role="status" aria-live="polite">Pilih pendaftaran untuk menyemak caj dan bayaran.</p>
    <form data-create hidden><h4>Keputusan admin</h4><label>Kategori akhir <select name="category" required><option value="1">Kategori 1</option><option value="2">Kategori 2</option><option value="3">Kategori 3</option></select></label> <label>Caj rasmi (RM) <input name="amount" required inputmode="decimal"></label> <label>Sebab keputusan <input name="reason" required minlength="3" maxlength="500"></label> <button>Muktamadkan Caj</button></form>
    <form data-record hidden><label>Rujukan bank <input name="reference" required></label> <label>Amaun diterima (RM) <input name="amount" required inputmode="decimal"></label> <button>Rekod bayaran</button></form>
    <form data-adjust hidden><label>Kategori akhir <select name="category" required><option value="1">Kategori 1</option><option value="2">Kategori 2</option><option value="3">Kategori 3</option></select></label> <label>Caj baharu (RM) <input name="amount" required inputmode="decimal"></label> <label>Sebab pelarasan <input name="reason" required maxlength="500"></label> <button>Laras caj</button></form>
    <div data-receipts></div>
    <form data-split hidden><h4>Pembahagian resit terpilih</h4><p>Gantikan keseluruhan pembahagian. Satu baris: ID pendaftaran, amaun RM. Maksimum 8 pendaftaran.</p>
      <label>Pembahagian <textarea name="allocations" rows="4" required></textarea></label>
      <label>Sebab <input name="reason" required maxlength="500"></label> <button>Simpan pembahagian</button></form>
    <form data-void hidden><label>Sebab pembatalan resit <input name="reason" required maxlength="500"></label> <button>Batalkan rekod resit terpilih</button><p>Pembatalan rekod bukan pemulangan wang.</p></form>
    <form data-cancel hidden><h4>Pembatalan sebelum masuk</h4><label>Sebab pembatalan <input name="reason" required minlength="3" maxlength="500"></label> <button>Batalkan Pendaftaran</button><p>Hari percuma dan cooldown permohonan ini akan dipulihkan. Admin sahaja.</p></form>`;
  host.prepend(panel);
  const find = s => panel.querySelector(s);
  const store = createPaymentStore({db:window.__FIRESTORE, auth:window.__AUTH, sdk});
  let registration = '', loaded = null, selected = null, isAdmin = false, allowed = false, busy = false;
  const rm = n => (n/100).toFixed(2);
  const statuses = {paid:'Sudah bayar',partial:'Bayaran sebahagian',unconfirmed:'Belum disahkan bayar',no_charge:'Tiada caj',overpaid:'Lebihan bayaran'};
  const tell = message => {find('[data-summary]').textContent = message;};
  function clear() {
    registration = ''; loaded = null; selected = null;
    ['create','record','adjust','split','void','cancel'].forEach(key => find(`[data-${key}]`).hidden = true);
    find('[data-receipts]').replaceChildren();
  }
  async function load(id) {
    const loadingUser = window.__AUTH.currentUser;
    clear();
    const result = await store.readRegistration(id);
    if (window.__AUTH.currentUser !== loadingUser) return;
    registration = id; loaded = result;
    const hasCharge=!!result.charge,response=result.response||{},quote=response.parkingQuote||{};
    find('[data-create]').hidden = hasCharge || !isAdmin;
    find('[data-record]').hidden = !hasCharge;
    find('[data-adjust]').hidden = !hasCharge || !isAdmin;
    const eta=response.eta?.toDate?response.eta.toDate():null;
    find('[data-cancel]').hidden=!isAdmin||!eta||eta.getTime()<=Date.now()||['Checked In','Checked Out','Cancelled Before Entry'].includes(response.status);
    const originalAmount=Number(response.unitArrearsAmount),originalCategory=Number.isFinite(originalAmount)?(originalAmount<=1?1:originalAmount<=400?2:3):null;
    const selectedCategory=originalCategory||result.currentCategory||1;
    find('[data-create] select[name="category"]').value=String(selectedCategory);
    find('[data-adjust] select[name="category"]').value=String(selectedCategory);
    const categoryNote=originalCategory&&result.currentCategory&&originalCategory!==result.currentCategory?` • Kategori unit semasa ${result.currentCategory}; pendaftaran ini kekal Kategori ${originalCategory} seperti ketika dihantar.`:'';
    if(!hasCharge){
      const create=find('[data-create]');
      create.amount.value=Number.isSafeInteger(quote.mainTotalSen)?rm(quote.mainTotalSen):'';
      tell(`Belum ada caj rasmi.${Number.isSafeInteger(quote.mainTotalSen)?` Anggaran borang RM${rm(quote.mainTotalSen)}.`:''}${categoryNote}`);
      return;
    }
    find('[data-adjust] input[name="amount"]').value=rm(result.charge.amountSen);
    tell(`${statuses[result.status]} • Caj RM${rm(result.charge.amountSen)} • Diperuntukkan RM${rm(result.paidSen)} • Baki RM${rm(result.balanceSen)} • Lebihan RM${rm(result.overpaidSen)}${categoryNote}`);
    result.receipts.forEach(receipt => {
      const row = document.createElement('p');
      const label = document.createElement('span');
      label.textContent = `${receipt.reference} — jumlah resit RM${rm(receipt.amountSen)} (${receipt.state === 'active' ? 'Aktif' : 'Dibatalkan'}) `;
      row.append(label);
      if (isAdmin && receipt.state === 'active') {
        const button = document.createElement('button'); button.type='button'; button.textContent='Pilih resit';
        button.onclick=()=>{
          selected=receipt;
          const allocations=receipt.allocations || [{chargeId:receipt.chargeId,amountSen:receipt.amountSen}];
          find('[data-split] textarea').value=allocations.map(a=>`${a.chargeId}, ${rm(a.amountSen)}`).join('\n');
          find('[data-split]').hidden=false; find('[data-void]').hidden=false;
          tell(`Resit dipilih: ${receipt.reference} • RM${rm(receipt.amountSen)}`);
        };
        row.append(button);
      }
      find('[data-receipts]').append(row);
    });
  }
  function handle(key, action) {
    find(`[data-${key}]`).addEventListener('submit', async event => {
      event.preventDefault(); if(busy || !allowed) return;
      busy=true; panel.querySelectorAll('button').forEach(b=>b.disabled=true);
      const data = Object.fromEntries(new FormData(event.currentTarget));
      try {await action(data);}
      catch(error) {tell(error.message || 'Operasi gagal. Muat semula rekod sebelum mencuba lagi.');}
      finally {busy=false; panel.querySelectorAll('button').forEach(b=>b.disabled=!allowed);}
    });
  }
  handle('load', data=>load(data.registration.trim()));
  handle('create',async data=>{const id=registration; await store.createCharge({registrationId:id,amountSen:parseRinggit(data.amount),finalCategory:Number(data.category),reason:data.reason}); await load(id);});
  handle('record',async data=>{const id=registration; await store.recordReceipt({registrationId:id,reference:data.reference,amountSen:parseRinggit(data.amount)}); await load(id);});
  handle('adjust',async data=>{const id=registration; await store.adjustCharge({registrationId:id,amountSen:parseRinggit(data.amount),expectedAmountSen:loaded.charge.amountSen,finalCategory:Number(data.category),reason:data.reason}); await load(id);});
  handle('split',async data=>{
    const allocations=data.allocations.trim().split(/\r?\n/).map(line=>{
      const parts=line.split(','); if(parts.length!==2) throw new Error('Setiap baris perlu ID pendaftaran, amaun RM.');
      return {chargeId:parts[0].trim(),amountSen:parseRinggit(parts[1].trim())};
    });
    const id=registration;
    await store.allocateReceipt({reference:selected.reference,allocations,reason:data.reason,expectedAllocations:selected.allocations || [{chargeId:selected.chargeId,amountSen:selected.amountSen}]});
    await load(id);
  });
  handle('void',async data=>{const id=registration; await store.voidReceipt({reference:selected.reference,reason:data.reason}); await load(id);});
  handle('cancel',async data=>{const id=registration;await store.cancelBeforeEntry({registrationId:id,reason:data.reason});await load(id);});
  find('[data-close]').addEventListener('click',()=>{panel.hidden=true;});
  window.addEventListener('dashboard:open-payment',async event=>{
    const id=String(event.detail?.registrationId || '').trim();
    panel.hidden=false;
    panel.scrollIntoView({behavior:'smooth',block:'start'});
    find('[data-load] input[name="registration"]').value=id;
    if(!allowed){tell('Akaun ini tiada hak pembayaran. Log masuk sebagai admin atau pengawal.');return;}
    try {await load(id);} catch(error) {tell(error.message || 'Rekod bayaran gagal dimuat.');}
  });
  onAuthStateChanged(window.__AUTH,async user=>{
    clear(); allowed=false; isAdmin=false;
    try {
      const token=user && !user.isAnonymous ? await user.getIdTokenResult() : null;
      if (window.__AUTH.currentUser !== user) return;
      isAdmin=token?.claims.admin===true;
      allowed=isAdmin || token?.claims.guard===true;
    } catch { /* Fail closed; never use a role entered by the user. */ }
    find('[data-role-note]').textContent=allowed ? `Akses: ${isAdmin ? 'Admin' : 'Pengawal'}` : 'Akaun ini tiada hak pembayaran. Hubungi admin.';
    panel.querySelectorAll('button').forEach(b=>b.disabled=!allowed);
    tell('Pilih pendaftaran untuk menyemak caj dan bayaran.');
  });
}
