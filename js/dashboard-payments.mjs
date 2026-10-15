import * as sdk from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import './firebase-init.js';
import {createUnusedParkingStore} from './parking-unused-store.mjs?v=20261015-merge-1';
import {createPaymentStore} from './payment-store.mjs?v=20261015-1';
import {parseRinggit} from './parking-payments.mjs';

if (new URLSearchParams(location.search).get('preview') !== '1') {
  const panel = document.createElement('div');
  panel.className = 'modal hidden';
  panel.id = 'registrationPaymentPanel';
  panel.hidden = true;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-labelledby','registrationPaymentTitle');
  panel.innerHTML = `<section class="card payment-dialog"><div class="payment-panel-head"><div><h3 id="registrationPaymentTitle">Pengesahan Bayaran Parkir</h3><p>Admin dan pengawal boleh merekod bayaran. Pelarasan caj serta pembatalan kekal untuk admin sahaja.</p></div><button type="button" class="btn-ghost" data-close aria-label="Tutup panel pembayaran">Tutup</button></div>
    <p data-role-note></p>
    <form data-load><label>ID pendaftaran <input name="registration" required readonly aria-readonly="true"></label> <button type="submit">Segar semula</button></form>
    <div class="payment-tabs" role="tablist" aria-label="Bahagian pembayaran"><button type="button" role="tab" id="paymentTabButton" aria-controls="paymentTabPanel" aria-selected="true" data-tab="payment">Bayaran</button><button type="button" role="tab" id="receiptsTabButton" aria-controls="receiptsTabPanel" aria-selected="false" data-tab="receipts">Sejarah resit <span data-receipt-count>0</span></button></div>
    <section id="paymentTabPanel" class="payment-tab-panel" role="tabpanel" aria-labelledby="paymentTabButton" data-pane="payment">
    <p data-summary role="status" aria-live="polite">Pilih pendaftaran untuk menyemak caj dan bayaran.</p>
    <form data-create hidden><h4>Keputusan admin</h4><label>Kategori akhir <select name="category" required><option value="1">Kategori 1</option><option value="2">Kategori 2</option><option value="3">Kategori 3</option></select></label> <label>Caj rasmi (RM) <input name="amount" required inputmode="decimal"></label> <label>Sebab keputusan <input name="reason" required minlength="3" maxlength="500"></label> <button>Muktamadkan Caj</button></form>
    <div class="payment-totals" data-totals hidden></div>
    <form data-record hidden><h4>Rekod pembayaran</h4><p class="payment-form-hint">Masukkan amaun sebenar yang diterima dan nombor resit pembayaran.</p><label>Nombor resit pembayaran <input name="reference" required placeholder="Contoh: BC20261007" autocomplete="off"></label> <label>Amaun diterima (RM) <input name="amount" required inputmode="decimal" placeholder="0.00"></label><div class="payment-form-actions"><button type="button" class="payment-cancel" data-cancel-payment>Batal</button><button type="submit">Simpan rekod bayaran</button></div></form>
    <form data-adjust hidden><label>Kategori akhir <select name="category" required><option value="1">Kategori 1</option><option value="2">Kategori 2</option><option value="3">Kategori 3</option></select></label> <label>Caj baharu (RM) <input name="amount" required inputmode="decimal"></label> <label>Sebab pelarasan <input name="reason" required maxlength="500"></label> <button>Laras caj</button></form><form data-unused hidden><h4>Tidak Menggunakan Parkir</h4><p>Admin telah mengesahkan seluruh permohonan tidak digunakan. Rekod dikekalkan untuk audit. Caj belum berbayar akan dibatalkan; counter dipulihkan jika sejarah lengkap. Caj permohonan selepasnya yang belum berbayar dikira semula jika sejarah lengkap. Rekod berbayar dan pelarasan manual memerlukan semakan. Plat sama dikira sekali; kenderaan utama/tambahan disusun semula.</p><label>ID pendaftaran <input data-unused-reference readonly aria-readonly="true"></label><label>Sebab / remark <textarea name="reason" required minlength="3" maxlength="400" rows="2"></textarea></label><label>Taip ID pendaftaran untuk sahkan <input name="confirmId" required autocomplete="off"></label><button type="submit">Sahkan Tidak Menggunakan Parkir</button></form>
    </section>
    <section id="receiptsTabPanel" class="payment-tab-panel" role="tabpanel" aria-labelledby="receiptsTabButton" data-pane="receipts" hidden>
    <div class="payment-receipts"><div data-receipts></div></div>
    <form data-split hidden><h4>Pembahagian resit terpilih</h4><p>Gantikan keseluruhan pembahagian. Satu baris: ID pendaftaran, amaun RM. Maksimum 8 pendaftaran.</p>
      <label>Pembahagian <textarea name="allocations" rows="4" required></textarea></label>
      <label>Sebab <input name="reason" required maxlength="500"></label> <button>Simpan pembahagian</button></form>
    <form data-void hidden><label>Sebab pembatalan resit <input name="reason" required maxlength="500"></label> <button>Batalkan rekod resit terpilih</button><p>Pembatalan rekod bukan pemulangan wang.</p></form>
    </section>
    <form data-cancel hidden><h4>Pembatalan sebelum masuk</h4><label>Sebab pembatalan <input name="reason" required minlength="3" maxlength="500"></label> <button>Batalkan Pendaftaran</button><p>Hari percuma dan cooldown permohonan ini akan dipulihkan. Admin sahaja.</p></form></section>`;
  document.body.append(panel);
  const find = s => panel.querySelector(s);
  const store = createPaymentStore({db:window.__FIRESTORE, auth:window.__AUTH, sdk});
  const unusedStore=createUnusedParkingStore({db:window.__FIRESTORE,auth:window.__AUTH,sdk});
  let registration = '', loaded = null, selected = null, isAdmin = false, allowed = false, busy = false;
  let previousFocus = null, previousBodyOverflow = '';
  const rm = n => (n/100).toFixed(2);
  const statuses = {paid:'Bayaran diterima',partial:'Bayaran sebahagian',unconfirmed:'Menunggu bayaran',no_charge:'Tiada caj',overpaid:'Lebihan bayaran'};
  const tell = message => {find('[data-summary]').textContent = message;};
  function clear() {
    registration = ''; loaded = null; selected = null;
    ['create','record','adjust','split','void','cancel','unused'].forEach(key => find(`[data-${key}]`).hidden = true);
    find('[data-receipts]').replaceChildren();
    find('[data-receipt-count]').textContent='0';
    find('[data-totals]').hidden=true;
  }
  async function load(id) {
    const loadingUser = window.__AUTH.currentUser;
    clear();
    const result = await store.readRegistration(id);
    if (window.__AUTH.currentUser !== loadingUser) return;
    registration = id; loaded = result;
    find('[data-unused-reference]').value=id;
    const hasCharge=!!result.charge,response=result.response||{},quote=response.parkingQuote||{};
    find('[data-create]').hidden = hasCharge || !isAdmin||response.parkingUnused===true;
    find('[data-record]').hidden = !hasCharge||response.parkingUnused===true;
    find('[data-adjust]').hidden = !hasCharge || !isAdmin;
    const eta=response.eta?.toDate?response.eta.toDate():null;
    find('[data-cancel]').hidden=!isAdmin||!eta||eta.getTime()<=Date.now()||['Checked In','Checked Out','Cancelled Before Entry'].includes(response.status);
    find('[data-unused]').hidden=!isAdmin||response.category!=='Pelawat'||String(response.stayOver).toLowerCase()!=='yes'||!['Pending','Pending Payment','Approved'].includes(response.status)||response.parkingUnused===true;
    if(response.parkingUnused)tell('Tidak menggunakan parkir: '+(response.parkingUnusedReason||''));
    if(panel.dataset.mode==='unused'){tell(response.parkingUnused?'Permohonan ini sudah ditanda tidak menggunakan parkir.':find('[data-unused]').hidden?'Tindakan ini tidak tersedia untuk status pendaftaran ini.':'Isi sebab dan taip ID pendaftaran tepat untuk mengesahkan. Rekod berbayar atau berresit akan ditolak.'); return; }
    if(response.parkingReviewReason==='automatic_ledger_pending'){['create','record','adjust'].forEach(key=>find('[data-'+key+']').hidden=true);tell('Caj sedang menunggu penyelarasan sejarah unit dan nombor kenderaan. Tunggu sehingga kiraan selesai sebelum merekod bayaran.');return;}
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
    const totals=find('[data-totals]');
    totals.replaceChildren();
    for(const [title,value] of [['Caj rasmi',result.charge.amountSen],['Bayaran diterima',result.paidSen],[result.overpaidSen>0?'Lebihan bayaran':'Baki bayaran',result.overpaidSen>0?result.overpaidSen:result.balanceSen]]){
      const tile=document.createElement('div'),label=document.createElement('span'),amount=document.createElement('strong');
      label.textContent=title;amount.textContent=`RM ${rm(value)}`;tile.append(label,amount);totals.append(tile);
    }
    totals.hidden=false;
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
    find('[data-receipt-count]').textContent=String(result.receipts.length);
  }
  find('[data-unused]').addEventListener('invalid',event=>{tell(event.target.name==='confirmId'?'Taip ID pendaftaran di ruangan pengesahan sebelum menyimpan.':'Isi sebab / remark sekurang-kurangnya 3 aksara.');},true);
  function handle(key, action) {
    find(`[data-${key}]`).addEventListener('submit', async event => {
      event.preventDefault(); if(busy || !allowed) return;
      tell('Sedang menyimpan… Sila tunggu pengesahan.');
      busy=true; panel.querySelectorAll('button').forEach(b=>b.disabled=true);
      const data = Object.fromEntries(new FormData(event.currentTarget));
      try {await action(data);}
      catch(error) {tell(error.code==='permission-denied'?'Tidak berjaya disimpan: Firebase menolak tindakan ini. Rekod belum berubah. Hubungi pentadbir untuk semakan peraturan akses.':error.message || 'Operasi gagal. Muat semula rekod sebelum mencuba lagi.');}
      finally {busy=false; panel.querySelectorAll('button').forEach(b=>b.disabled=!allowed);}
    });
  }
  window.addEventListener('dashboard:parking-usage-corrected',event=>{if(!busy&&!panel.hidden&&loaded?.response?.hostUnit===event.detail?.unit)load(registration).catch(error=>tell(error.message));});
  handle('load', data=>load(data.registration.trim()));
  handle('create',async data=>{const id=registration; await store.createCharge({registrationId:id,amountSen:parseRinggit(data.amount),finalCategory:Number(data.category),reason:data.reason}); await load(id);});
  handle('record',async data=>{const id=registration,reference=data.reference.trim().toUpperCase(),amountSen=parseRinggit(data.amount); await store.recordReceipt({registrationId:id,reference,amountSen}); await load(id); find('[data-record]').reset(); tell(`Berjaya disimpan: resit ${reference}, RM${rm(amountSen)}. ${statuses[loaded.status]} • baki RM${rm(loaded.balanceSen)}${loaded.overpaidSen?` • lebihan RM${rm(loaded.overpaidSen)}`:''}.`);});
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
  handle('unused',async data=>{const id=registration,unit=loaded.response.hostUnit;const result=await unusedStore.markUnused({registrationId:id,reason:data.reason,confirmId:data.confirmId});window.dispatchEvent(new CustomEvent('dashboard:parking-usage-corrected',{detail:{unit,registrationId:id}}));await load(id);tell('Berjaya disimpan. Rekod ditanda tidak menggunakan parkir. '+(result.restored?'Counter dipulihkan.':'Unit dihantar untuk semakan counter.')+' '+result.recalculated+' pendaftaran dikira semula. '+result.affected+' pendaftaran perlu semakan caj.');});
  handle('cancel',async data=>{const id=registration;if(loaded.response.parkingLedgerVersion){const unit=loaded.response.hostUnit;await unusedStore.markUnused({registrationId:id,reason:data.reason,confirmId:id});window.dispatchEvent(new CustomEvent('dashboard:parking-usage-corrected',{detail:{unit}}));await load(id);return;}await store.cancelBeforeEntry({registrationId:id,reason:data.reason});await load(id);});
  function closePanel(){
    if(panel.hidden||busy)return;
    panel.hidden=true;
    panel.classList.add('hidden');
    document.body.style.overflow=previousBodyOverflow;
    if(previousFocus?.isConnected)previousFocus.focus();
  }
  function focusPaymentField(){
    const field=panel.querySelector('[data-record]:not([hidden]) input[name="reference"]')
      ||panel.querySelector('[data-create]:not([hidden]) input[name="amount"]')
      ||panel.querySelector('[data-load] input[name="registration"]');
    (field||find('[data-close]')).focus({preventScroll:true});
  }
  function selectTab(active){
    panel.querySelectorAll('[data-tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.tab===active)));
    panel.querySelectorAll('[data-pane]').forEach(pane=>pane.hidden=pane.dataset.pane!==active);
  }
  find('[data-close]').addEventListener('click',closePanel);
  find('[data-cancel-payment]').addEventListener('click',closePanel);
  panel.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>selectTab(button.dataset.tab)));
  panel.addEventListener('click',event=>{if(event.target===panel)closePanel();});
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();closePanel();return;}
    if(event.key!=='Tab')return;
    const focusable=[...panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')].filter(node=>node.getClientRects().length);
    if(!focusable.length){event.preventDefault();return;}
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  window.addEventListener('dashboard:open-payment',async event=>{
    const id=String(event.detail?.registrationId || '').trim();
    const unusedMode=event.detail?.mode==='unused';
    panel.dataset.mode=unusedMode?'unused':'payment';
    find('#registrationPaymentTitle').textContent=unusedMode?'Tidak Menggunakan Parkir':'Pengesahan Bayaran Parkir';
    find('.payment-panel-head p').textContent=unusedMode?'Sahkan seluruh permohonan tidak digunakan dan rekodkan sebab untuk audit.':'Admin dan pengawal boleh merekod bayaran. Pelarasan caj serta pembatalan kekal untuk admin sahaja.';
    previousFocus=document.activeElement;
    previousBodyOverflow=document.body.style.overflow;
    panel.hidden=false;
    panel.classList.remove('hidden');
    selectTab('payment');
    document.body.style.overflow='hidden';
    find('[data-load] input[name="registration"]').value=id;
    if(!allowed){tell('Akaun ini tiada hak pembayaran. Log masuk sebagai admin atau pengawal.');find('[data-close]').focus({preventScroll:true});return;}
    try {await load(id);} catch(error) {tell(error.message || 'Rekod bayaran gagal dimuat.');}
    if(event.detail?.mode==='unused'&&!find('[data-unused]').hidden){find('[data-unused] textarea').focus();find('[data-unused]').scrollIntoView({block:'nearest'});}else focusPaymentField();
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
