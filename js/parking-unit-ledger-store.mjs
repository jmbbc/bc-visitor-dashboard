import {buildUnitParkingLedger} from './parking-unit-ledger.mjs?v=20261015-type-1';
import {malaysiaDate} from './charge-explanation-model.mjs';
const sameTime=(a,b)=>a&&b&&a.seconds===b.seconds&&a.nanoseconds===b.nanoseconds;
export function createUnitParkingLedgerStore({db,auth,sdk}){
 const {doc,collection,query,where,limit,getDocs,getDoc,runTransaction,serverTimestamp,Timestamp}=sdk;
 return {async reconcile({unit,unusedId=null,reason='',confirmId=null,queuedResponseId=null}){
  const user=auth.currentUser;if(!user||(await user.getIdTokenResult()).claims.admin!==true)throw Error('Admin sahaja.');
  if(!unit||!/^[A-Za-z0-9-]{1,40}$/.test(unit))throw Error('Unit tidak sah.');
  if(unusedId&&(confirmId!==unusedId||reason.trim().length<3||reason.trim().length>400))throw Error('Isi remark 3–400 aksara dan taip ID pendaftaran tepat.');
  const history=await getDocs(query(collection(db,'responses'),where('hostUnit','==',unit),limit(101)));if(history.size>100)throw Error('Lebih 100 rekod; perlu semakan teknikal.');
  const queueRef=doc(db,'parkingLedgerQueue',unit),initialQueue=queuedResponseId?await getDoc(queueRef):null;
  if(queuedResponseId&&initialQueue.exists()&&initialQueue.data().status!=='pending')return {skipped:true};
  if(queuedResponseId&&(!initialQueue.exists()||initialQueue.data().responseId!==queuedResponseId))throw Error('Permintaan pengiraan berubah. Cuba semula.');
  if(unusedId){const receipts=await Promise.all([getDocs(query(collection(db,'parkingReceipts'),where('chargeId','==',unusedId),limit(1))),getDocs(query(collection(db,'parkingReceipts'),where('relatedChargeIds','array-contains',unusedId),limit(1)))]);if(receipts.some(x=>x.size))throw Error('Rekod mempunyai resit; perlu semakan bayaran berasingan.');}
  return runTransaction(db,async tx=>{
   const snapshots=await Promise.all(history.docs.map(d=>tx.get(d.ref))),rows=snapshots.filter(s=>s.exists()).map(s=>({...s.data(),id:s.id}));
   const lockRef=doc(db,'overnightLocks','unit-'+unit),reviewRef=doc(db,'parkingReviewQueue',unit);
   const [lock,review,queue]=await Promise.all([tx.get(lockRef),tx.get(reviewRef),tx.get(queueRef)]);
   if(auth.currentUser!==user)throw Error('Sesi berubah.');if(!lock.exists())throw Error('Counter unit tiada.');
   if(!rows.some(r=>r.id===lock.data().responseId)&&!String(lock.data().responseId).startsWith('admin-review-'))throw Error('Sejarah unit berubah atau tidak lengkap.');
   if(queuedResponseId&&queue.exists()&&queue.data().status!=='pending')return {skipped:true};
   if(queuedResponseId&&(!queue.exists()||queue.data().responseId!==queuedResponseId||!sameTime(queue.data().requestedAt,initialQueue.data().requestedAt)))throw Error('Permintaan pengiraan berubah. Cuba semula.');
   const target=rows.find(r=>r.id===(unusedId||queuedResponseId));if(!target)throw Error('Pendaftaran tidak ditemui.');if(target.category!=='Pelawat'||String(target.stayOver).toLowerCase()!=='yes')throw Error('Pendaftaran bukan parkir pelawat bermalam.');
   if(unusedId&&(target.category!=='Pelawat'||String(target.stayOver).toLowerCase()!=='yes'||(!target.parkingUnused&&!['Pending','Pending Payment','Approved'].includes(target.status))))throw Error('Pendaftaran tidak layak ditanda tidak digunakan.');
   if(review.exists()&&review.data().status==='pending'&&!review.data().reasons?.every(r=>r==='parking_usage_correction'))throw Error('Selesaikan semakan kategori/kitaran sedia ada dahulu.');
   const from=malaysiaDate(target.eta),ledger=buildUnitParkingLedger(rows,{unit,from,excludedId:unusedId});
   const candidates=ledger.plans.filter(p=>p.exempt?malaysiaDate(p.record.etd||p.record.eta)>=from:p.lines.some(l=>l.date>=from)),ids=[...new Set([...candidates.map(p=>p.record.id),...(unusedId?[unusedId]:[])])];
   const chargeSnaps=await Promise.all(ids.map(id=>tx.get(doc(db,'parkingCharges',id)))),charges=new Map(ids.map((id,i)=>[id,chargeSnaps[i].exists()?chargeSnaps[i].data():null]));
   const journals=new Map();await Promise.all(ids.map(async id=>{const c=charges.get(id);if(c?.lastChangeId){const s=await tx.get(doc(db,'parkingCharges',id,'changes',c.lastChangeId));journals.set(id,s.exists()?s.data():null);}}));
   const by=user.uid,stamp=serverTimestamp(),date=s=>Timestamp.fromDate(new Date(s+'T00:00:00+08:00'));
   const protectedCharge=c=>c&&(!Number.isSafeInteger(c.paidSen)||c.paidSen!==0||c.lastReceiptId||['paid','partial','overpaid'].includes(c.paymentStatus));
   const saveCharge=(id,old,amount,notes)=>{const ref=doc(db,'parkingCharges',id);if(old&&(old.amountSen!==amount||old.lastChangeId)){const change=doc(collection(ref,'changes'));tx.set(change,{beforeSen:old.amountSen,afterSen:amount,reason:notes,by,at:stamp});tx.update(ref,{amountSen:amount,paymentStatus:amount===0?'no_charge':'unconfirmed',lastChangeId:change.id});}else if(!old)tx.set(ref,{registrationId:id,amountSen:amount,paidSen:0,paymentStatus:amount===0?'no_charge':'unconfirmed',createdBy:by,createdAt:stamp});};
   if(unusedId){const c=charges.get(unusedId);if(protectedCharge(c))throw Error('Bayaran sudah direkod; pembetulan perlu semakan.');saveCharge(unusedId,c,0,'Tidak menggunakan parkir: '+reason.trim());tx.update(doc(db,'responses',unusedId),{status:'Cancelled Before Entry',parkingUnused:true,parkingUnusedReason:reason.trim(),parkingUnusedBy:by,parkingUnusedAt:stamp,parkingReviewRequired:false,parkingReviewReason:'',updatedAt:stamp});}
   let recalculated=0;const unresolved=[];
   for(const p of candidates){const r=p.record,c=charges.get(r.id),j=journals.get(r.id);
    const changed=c&&(c.amountSen!==p.totalSen||JSON.stringify(r.parkingDailyBreakdown||[])!==JSON.stringify(p.lines));
    const automatic=j&&/^(Kiraan semula selepas tidak menggunakan parkir [A-Za-z0-9_-]+|Gabungan penggunaan parkir [A-Za-z0-9_-]+)$/.test(j.reason||'')&&j.afterSen===c.amountSen&&c.amountSen===r.parkingQuote?.mainTotalSen&&sameTime(j.at,r.parkingQuote.calculatedAt);
    const manual=c&&((c.lastChangeId&&!automatic)||c.amountSen!==r.parkingQuote?.mainTotalSen);
    const blockedReview=r.parkingReviewRequired&&!['automatic_ledger_pending','overlapping_or_out_of_order','usage_correction_requires_charge_review',''].includes(r.parkingReviewReason||'');
    if(protectedCharge(c)||manual||blockedReview){if(changed||r.parkingReviewRequired||!r.parkingDailyBreakdown)unresolved.push(r.id);continue;}
    const notes=unusedId?'Kiraan semula selepas tidak menggunakan parkir '+unusedId:'Gabungan penggunaan parkir '+target.id;
    saveCharge(r.id,c,p.totalSen,notes);
    const prior=p.priorState,priorSnapshot=prior?{exists:true,category:prior.category,mainUsageDays:prior.mainUsageDays,cycleStart:date(prior.cycleStart),lastMainEnd:date(prior.lastMainEnd),lastAnyEnd:date(prior.lastAnyEnd),policyVersion:prior.policyVersion||p.quote.policyVersion}:{exists:false};
    tx.update(doc(db,'responses',r.id),{...(['Pending','Pending Payment',''].includes(r.status||'')?{status:p.totalSen?'Pending Payment':'Pending'}:{}),parkingQuote:{...p.quote,calculatedAt:stamp},parkingDailyBreakdown:p.lines,parkingLedgerVersion:ledger.version,parkingUsageEnd:date(p.lines.map(l=>l.date).sort().at(-1)||malaysiaDate(r.etd||r.eta)),parkingPriorState:priorSnapshot,parkingReviewRequired:false,parkingReviewReason:p.exempt?'vehicle_type_exempt':'',updatedAt:stamp});
    tx.set(doc(collection(db,'audit')),{ts:stamp,userId:by,rowId:r.id,unit,field:'parking_charge',old:{quote:r.parkingQuote||null,daily:r.parkingDailyBreakdown||null,officialAmountSen:c?.amountSen??null},new:{quote:p.quote,daily:p.lines,amountSen:p.totalSen},action:'recalculate_unit_vehicle_days',notes});recalculated++;
   }
   for(const id of unresolved)tx.update(doc(db,'responses',id),{parkingReviewRequired:true,parkingReviewReason:'usage_correction_requires_charge_review',updatedAt:stamp});
   const state=ledger.state,update={parkingReviewRequired:false,parkingReviewedAt:stamp,parkingReviewedBy:by,updatedAt:stamp};
   if(state)Object.assign(update,{parkingCategory:state.category,mainUsageDays:state.mainUsageDays,cycleStart:date(state.cycleStart),lastMainEnd:date(state.lastMainEnd),lastAnyEnd:date(state.lastAnyEnd),parkingPolicyVersion:state.policyVersion});else update.mainUsageDays=0;
   if(unusedId||!ledger.latest||ledger.latest.id!==lock.data().responseId){if(unusedId)update.parkingCorrectionResponseId=unusedId;if(ledger.latest)Object.assign(update,{startDate:ledger.latest.eta,endDate:ledger.latest.etd||ledger.latest.eta,responseId:ledger.latest.id,amendToken:ledger.latest.amendToken||'',stayOver:'Yes'});else Object.assign(update,{responseId:unusedId||target.id,stayOver:'No'});}
   tx.update(lockRef,update);
   if(review.exists()&&review.data().status==='pending'&&state)tx.update(reviewRef,{status:'resolved',finalCategory:state.category,finalMainUsageDays:state.mainUsageDays,finalCycleStart:date(state.cycleStart),finalLastMainEnd:date(state.lastMainEnd),finalLastAnyEnd:date(state.lastAnyEnd),resolutionReason:'Gabungan penggunaan harian selesai',resolvedBy:by,resolvedByEmail:user.email||'',resolvedAt:stamp});
   if(queue.exists())tx.update(queueRef,{status:unresolved.length?'review':'done',processedAt:stamp,processedBy:by,message:unresolved.length+' rekod perlu semakan'});
   tx.set(doc(collection(db,'audit')),{ts:stamp,userId:by,rowId:target.id,unit,field:'parking_usage',old:'registered',new:unusedId?'not_used':'merged',action:unusedId?'mark_parking_unused':'merge_unit_vehicle_days',notes:reason,affectedRegistrationIds:candidates.map(p=>p.record.id),counterRestored:true});
   return {restored:true,affected:unresolved.length,recalculated};
  });
 }};
}
