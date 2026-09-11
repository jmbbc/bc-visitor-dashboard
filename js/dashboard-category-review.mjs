import {collection,doc,getDocs,limit,query,runTransaction,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import {reconcileReviewWithLock} from './category-review-reconcile.mjs?v=20260911-1';

const panel=document.getElementById('parkingReviewAdminPanel');
if(panel&&window.__AUTH&&window.__FIRESTORE){
  const list=document.getElementById('parkingReviewList'),message=document.getElementById('parkingReviewMessage'),count=document.getElementById('parkingReviewPendingCount'),search=document.getElementById('parkingReviewSearch'),status=document.getElementById('parkingReviewStatus');
  let rows=[],adminUser=null;
  const dateValue=value=>value?.toDate?value.toDate().toISOString().slice(0,10):'';
  const asTimestamp=value=>Timestamp.fromDate(new Date(`${value}T00:00:00Z`));
  const malaysiaDateValue=value=>{
    const date=value?.toDate?value.toDate():null;if(!date)return '';
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const get=type=>parts.find(part=>part.type===type)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const reasonLabel=value=>({category_transition:'Kategori berubah dalam kitaran aktif',missing_category:'Kategori asal tidak lengkap',cycle_over_30_days:'Kitaran lama melebihi 30 hari'}[value]||value);
  const safe=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function render(){
    const term=search.value.trim().toUpperCase(),wanted=status.value;
    const visible=rows.filter(row=>(wanted==='all'||row.status===wanted)&&(!term||row.unitId.includes(term)));
    count.textContent=String(rows.filter(row=>row.status==='pending').length);list.replaceChildren();
    if(!visible.length){message.textContent=rows.length?'Tiada unit sepadan dengan penapis.':'Tiada unit dalam senarai semakan.';return;}
    message.textContent=`${visible.length} unit dipaparkan. Buka satu baris untuk menetapkan keputusan.`;
    visible.forEach(row=>{
      const item=document.createElement('details');item.className='parking-review-item';const resolved=row.status==='resolved';
      item.innerHTML=`<summary><span class="parking-review-unit">${safe(row.unitId)}</span><span class="parking-review-reason">${safe((row.reasons||[]).map(reasonLabel).join(' • '))}</span><span class="review-status ${resolved?'resolved':''}">${resolved?'Selesai':'Perlu semakan'}</span><span aria-hidden="true">⌄</span></summary><form class="parking-review-form"><label class="small">Kategori<select name="category" ${resolved?'disabled':''}><option value="1">Kategori 1</option><option value="2">Kategori 2</option><option value="3">Kategori 3</option></select></label><label class="small">Hari kenderaan utama<input name="days" type="number" min="0" required ${resolved?'disabled':''}></label><label class="small">Mula kitaran<input name="cycleStart" type="date" required ${resolved?'disabled':''}></label><label class="small">Akhir kenderaan utama<input name="lastMainEnd" type="date" required ${resolved?'disabled':''}></label><label class="small">Akhir penggunaan unit<input name="lastAnyEnd" type="date" required ${resolved?'disabled':''}></label>${resolved?`<div class="parking-review-audit">Keputusan: Kategori ${safe(row.finalCategory)}, ${safe(row.finalMainUsageDays)} hari. Sebab: ${safe(row.resolutionReason||'—')} • Oleh ${safe(row.resolvedByEmail||row.resolvedBy||'admin')}</div>`:`<label class="small review-reason-field">Sebab keputusan<textarea name="resolutionReason" rows="2" maxlength="500" required placeholder="Contoh: Disahkan berdasarkan rekod terakhir unit"></textarea></label><button class="btn review-save" type="submit">Simpan Keputusan</button>`}</form>`;
      const form=item.querySelector('form');form.category.value=String(row.finalCategory||row.suggestedCategory||1);form.days.value=String(row.finalMainUsageDays??row.suggestedMainUsageDays??0);form.cycleStart.value=dateValue(row.finalCycleStart||row.suggestedCycleStart);form.lastMainEnd.value=dateValue(row.finalLastMainEnd||row.suggestedLastMainEnd);form.lastAnyEnd.value=dateValue(row.finalLastAnyEnd||row.suggestedLastAnyEnd);
      if(!resolved)form.addEventListener('submit',event=>save(event,row));list.append(item);
    });
  }
  async function save(event,row){
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),data=Object.fromEntries(new FormData(form)),category=Number(data.category),days=Number(data.days);
    if(!Number.isInteger(days)||days<0)return;button.disabled=true;message.textContent=`Menyimpan keputusan ${row.unitId}…`;
    try{const queueRef=doc(window.__FIRESTORE,'parkingReviewQueue',row.unitId),lockRef=doc(window.__FIRESTORE,'overnightLocks',`unit-${row.unitId}`);
      await runTransaction(window.__FIRESTORE,async tx=>{const queueSnap=await tx.get(queueRef),lockSnap=await tx.get(lockRef);if(!queueSnap.exists()||queueSnap.data().status!=='pending')throw new Error('Unit ini telah disemak. Muat semula senarai.');if(lockSnap.exists()){const lock=lockSnap.data()||{},rebased=reconcileReviewWithLock({cycleStart:data.cycleStart,mainUsageDays:days,lastMainEnd:data.lastMainEnd,lastAnyEnd:data.lastAnyEnd},{stayOver:lock.stayOver,startDate:malaysiaDateValue(lock.startDate),endDate:malaysiaDateValue(lock.endDate),lastAnyEnd:malaysiaDateValue(lock.lastAnyEnd)});if(rebased.changed){const stale=new Error('Pendaftaran baharu ditemui. Nilai telah dikemas kini—semak dan tekan Simpan sekali lagi.');stale.code='STALE_REVIEW';stale.rebased=rebased;throw stale;}}const decision={parkingCategory:category,cycleStart:asTimestamp(data.cycleStart),mainUsageDays:days,lastMainEnd:asTimestamp(data.lastMainEnd),lastAnyEnd:asTimestamp(data.lastAnyEnd),parkingPolicyVersion:'2026-09-08',parkingReviewRequired:false,parkingReviewedAt:serverTimestamp(),parkingReviewedBy:adminUser.uid};if(lockSnap.exists())tx.update(lockRef,decision);else tx.set(lockRef,{unit:row.unitId,startDate:decision.cycleStart,endDate:decision.lastAnyEnd,category:'Pelawat',stayOver:'Yes',responseId:`admin-review-${row.unitId}`,updatedAt:serverTimestamp(),...decision});tx.update(queueRef,{status:'resolved',finalCategory:category,finalMainUsageDays:days,finalCycleStart:decision.cycleStart,finalLastMainEnd:decision.lastMainEnd,finalLastAnyEnd:decision.lastAnyEnd,resolutionReason:data.resolutionReason.trim(),resolvedBy:adminUser.uid,resolvedByEmail:adminUser.email||'',resolvedAt:serverTimestamp()});});await load();
    }catch(error){if(error.code==='STALE_REVIEW'&&error.rebased){form.cycleStart.value=error.rebased.cycleStart;form.days.value=String(error.rebased.mainUsageDays);form.lastMainEnd.value=error.rebased.lastMainEnd;form.lastAnyEnd.value=error.rebased.lastAnyEnd;}message.textContent=error.message||'Keputusan tidak dapat disimpan.';button.disabled=false;}
  }
  async function load(){if(!adminUser)return;message.textContent='Memuatkan senarai semakan…';try{const snap=await getDocs(query(collection(window.__FIRESTORE,'parkingReviewQueue'),limit(200)));rows=snap.docs.map(d=>({unitId:d.id,...d.data()})).sort((a,b)=>a.unitId.localeCompare(b.unitId));render();}catch(error){rows=[];count.textContent='—';list.replaceChildren();message.textContent=error.code==='permission-denied'?'Akses ditolak. Log masuk semula menggunakan akaun admin.':'Senarai semakan tidak dapat dimuatkan.';}}
  search.addEventListener('input',render);status.addEventListener('change',render);document.getElementById('parkingReviewRefresh').addEventListener('click',load);
  onAuthStateChanged(window.__AUTH,async user=>{panel.hidden=true;adminUser=null;rows=[];if(!user||user.isAnonymous)return;try{const token=await user.getIdTokenResult();if(window.__AUTH.currentUser!==user||token.claims.admin!==true)return;adminUser=user;panel.hidden=false;await load();}catch{/* Fail closed. */}});
}
