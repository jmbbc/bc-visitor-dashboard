import * as sdk from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import {createPaymentStore} from './payment-store.mjs';
import {parseRinggit} from './parking-payments.mjs';

if (new URLSearchParams(location.search).get('preview') !== '1') {
  const host = document.getElementById('pageSummary');
  const panel = document.createElement('section');
  panel.className = 'card';
  panel.innerHTML = `<h3>Pengesahan Bayaran Parkir</h3>
    <p>Admin dan pengawal boleh merekod bayaran. Pelarasan caj serta pembatalan kekal untuk admin sahaja.</p>
    <p data-role-note></p>
    <form data-load><label>ID pendaftaran <input name="registration" required autocomplete="off"></label> <button>Muat rekod</button></form>
    <p data-summary role="status" aria-live="polite">Pilih pendaftaran untuk menyemak caj dan bayaran.</p>
    <form data-create hidden><label>Caj asal (RM) <input name="amount" required inputmode="decimal"></label> <button>Wujudkan caj</button></form>
    <form data-record hidden><label>Rujukan bank <input name="reference" required></label> <label>Amaun diterima (RM) <input name="amount" required inputmode="decimal"></label> <button>Rekod bayaran</button></form>
    <form data-adjust hidden><label>Caj baharu (RM) <input name="amount" required inputmode="decimal"></label> <label>Sebab pelarasan <input name="reason" required maxlength="500"></label> <button>Laras caj</button></form>
    <div data-receipts></div>
    <form data-split hidden><h4>Pembahagian resit terpilih</h4><p>Gantikan keseluruhan pembahagian. Satu baris: ID pendaftaran, amaun RM. Maksimum 8 pendaftaran.</p>
      <label>Pembahagian <textarea name="allocations" rows="4" required></textarea></label>
      <label>Sebab <input name="reason" required maxlength="500"></label> <button>Simpan pembahagian</button></form>
    <form data-void hidden><label>Sebab pembatalan resit <input name="reason" required maxlength="500"></label> <button>Batalkan rekod resit terpilih</button><p>Pembatalan rekod bukan pemulangan wang.</p></form>`;
  host.prepend(panel);
  const find = s => panel.querySelector(s);
  const store = createPaymentStore({db:window.__FIRESTORE, auth:window.__AUTH, sdk});
  let registration = '', loaded = null, selected = null, isAdmin = false, allowed = false, busy = false;
  const rm = n => (n/100).toFixed(2);
  const statuses = {paid:'Sudah bayar',partial:'Bayaran sebahagian',unconfirmed:'Belum disahkan bayar',no_charge:'Tiada caj',overpaid:'Lebihan bayaran'};
  const tell = message => {find('[data-summary]').textContent = message;};
  function clear() {
    registration = ''; loaded = null; selected = null;
    ['create','record','adjust','split','void'].forEach(key => find(`[data-${key}]`).hidden = true);
    find('[data-receipts]').replaceChildren();
  }
  async function load(id) {
    const loadingUser = window.__AUTH.currentUser;
    clear();
    const result = await store.readRegistration(id);
    if (window.__AUTH.currentUser !== loadingUser) return;
    registration = id; loaded = result;
    find('[data-create]').hidden = !!result || !isAdmin;
    find('[data-record]').hidden = !result;
    find('[data-adjust]').hidden = !result || !isAdmin;
    if (!result) {tell('Belum ada caj. Admin perlu mengesahkan dan mewujudkan caj dahulu.'); return;}
    tell(`${statuses[result.status]} • Caj RM${rm(result.charge.amountSen)} • Diperuntukkan RM${rm(result.paidSen)} • Baki RM${rm(result.balanceSen)} • Lebihan RM${rm(result.overpaidSen)}`);
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
  handle('create',async data=>{const id=registration; await store.createCharge({registrationId:id,amountSen:parseRinggit(data.amount)}); await load(id);});
  handle('record',async data=>{const id=registration; await store.recordReceipt({registrationId:id,reference:data.reference,amountSen:parseRinggit(data.amount)}); await load(id);});
  handle('adjust',async data=>{const id=registration; await store.adjustCharge({registrationId:id,amountSen:parseRinggit(data.amount),expectedAmountSen:loaded.charge.amountSen,reason:data.reason}); await load(id);});
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
