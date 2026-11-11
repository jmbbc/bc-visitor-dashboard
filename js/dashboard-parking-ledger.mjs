import * as sdk from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import './firebase-init.js';
import {createUnitParkingLedgerStore} from './parking-unit-ledger-store.mjs?v=20261015-type-1';
if(new URLSearchParams(location.search).get('preview')!=='1'){
 let stop=null,stopReviews=null,generation=0;
 onAuthStateChanged(window.__AUTH,async user=>{
  stop?.();stopReviews?.();stop=null;stopReviews=null;document.getElementById('parkingLedgerStatus')?.remove();const token=++generation;if(!user||(await user.getIdTokenResult()).claims.admin!==true||token!==generation)return;
  const store=createUnitParkingLedgerStore({db:window.__FIRESTORE,auth:window.__AUTH,sdk}),inFlight=new Set(),pending=new Map();
  const host=document.getElementById('pageUnitSummary'),status=document.createElement('section');status.id='parkingLedgerStatus';status.className='card';status.style.cssText='padding:14px;margin:12px 0';status.innerHTML='<h4>Penyelarasan caj parkir</h4><p class="small muted">Plat sama pada tarikh sama dikira sekali. Penyelarasan automatik berjalan semasa dashboard admin aktif.</p><div data-ledger-reviews></div>';host?.append(status);
  const retryResults = document.createElement('div');
  status.append(retryResults);
  const activeRetries = new Set();

  async function retryUnit(unit, button) {
   if (activeRetries.has(unit)) return;
   activeRetries.add(unit);
   button.disabled = true;
   const feedback = document.createElement('p');
   feedback.setAttribute('role', 'status');
   feedback.textContent = unit + ': Sedang menghantar permintaan…';
   retryResults.prepend(feedback);
   const ref = sdk.doc(window.__FIRESTORE, 'parkingLedgerQueue', unit);
   let unsubscribe;
   let timeout;
   const finish = message => {
    unsubscribe?.();
    clearTimeout(timeout);
    activeRetries.delete(unit);
    feedback.textContent = unit + ': ' + message;
    for (const retry of status.querySelectorAll('[data-retry-unit]')) {
     if (retry.dataset.retryUnit === unit) retry.disabled = false;
    }
   };
   try {
    await sdk.updateDoc(ref, {status:'pending', requestedAt:sdk.serverTimestamp()});
    if (token !== generation) return;
    feedback.textContent = unit + ': Penyelarasan dalam giliran…';
    timeout = setTimeout(() => finish('Keputusan belum diterima. Semak status semula sebentar lagi.'), 60000);
    unsubscribe = sdk.onSnapshot(ref, {includeMetadataChanges:true}, snapshot => {
     if (token !== generation) { unsubscribe?.(); clearTimeout(timeout); return; }
     if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
     const job = snapshot.data();
     if (!job) finish('Rekod giliran tidak ditemui.');
     else if (job.status === 'done') finish('Penyelarasan selesai.');
     else if (job.status === 'review') finish('Masih perlu semakan. ' + (job.message || ''));
    }, error => finish('Status tidak dapat dimuat. ' + error.message));
   } catch (error) {
    finish('Permintaan gagal. ' + error.message);
   }
  }

  stopReviews=sdk.onSnapshot(sdk.query(sdk.collection(window.__FIRESTORE,'parkingLedgerQueue'),sdk.where('status','==','review'),sdk.limit(20)),snapshot=>{
   const list=status.querySelector('[data-ledger-reviews]');list.replaceChildren();if(snapshot.empty){list.textContent='Tiada penyelarasan tertangguh untuk semakan.';return;}
   for(const item of snapshot.docs){const row=document.createElement('div'),label=document.createElement('p'),retry=document.createElement('button');label.textContent=item.id+': '+(item.data().message||'Caj berbayar atau pelarasan manual memerlukan semakan.');retry.className='btn-ghost';retry.textContent='Cuba penyelarasan semula';retry.dataset.retryUnit=item.id;retry.disabled=activeRetries.has(item.id);retry.addEventListener('click',()=>retryUnit(item.id,retry));row.append(label,retry);list.append(row);}if(snapshot.size===20){const note=document.createElement('p');note.textContent='Memaparkan maksimum 20 unit untuk semakan.';list.append(note);}
  },error=>{status.querySelector('[data-ledger-reviews]').textContent='Status penyelarasan tidak dapat dimuat: '+error.message;});
  async function process(unit,job){
   if(inFlight.has(unit)||token!==generation)return;inFlight.add(unit);
   try{const result=await store.reconcile({unit,queuedResponseId:job.responseId});if(!result.skipped)window.dispatchEvent(new CustomEvent('dashboard:parking-usage-corrected',{detail:{unit}}));}
   catch(error){
    console.warn('Penyelarasan caj unit memerlukan semakan:',unit,error.message);if(token!==generation)return;
    await sdk.runTransaction(window.__FIRESTORE,async tx=>{const ref=sdk.doc(window.__FIRESTORE,'parkingLedgerQueue',unit),current=await tx.get(ref);if(current.exists()&&current.data().status==='pending'&&current.data().responseId===job.responseId&&current.data().requestedAt?.isEqual(job.requestedAt))tx.update(ref,{status:'review',message:error.message,processedAt:sdk.serverTimestamp(),processedBy:user.uid});}).catch(()=>{});
   }finally{inFlight.delete(unit);const next=pending.get(unit);if(next&&(next.responseId!==job.responseId||!next.requestedAt?.isEqual(job.requestedAt)))process(unit,next);}
  }
  stop=sdk.onSnapshot(sdk.query(sdk.collection(window.__FIRESTORE,'parkingLedgerQueue'),sdk.where('status','==','pending'),sdk.limit(10)),snapshot=>{
   pending.clear();for(const item of snapshot.docs)pending.set(item.id,item.data());for(const [unit,job]of pending)process(unit,job);
  },error=>console.warn('Penyelarasan caj tidak tersedia:',error.message));
 });
}
