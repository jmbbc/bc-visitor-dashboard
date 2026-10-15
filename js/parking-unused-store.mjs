import {planUnusedParking} from './parking-unused-policy.mjs?v=20261015-4';
export function createUnusedParkingStore({db,auth,sdk}){
 const {doc,collection,query,where,limit,getDocs,getDoc,runTransaction,serverTimestamp,Timestamp}=sdk;
 return {async markUnused({registrationId,reason,confirmId}){
  const user=auth.currentUser;if(!user||(await user.getIdTokenResult()).claims.admin!==true)throw Error('Admin sahaja.');
  const id=String(registrationId||'');if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||confirmId!==id)throw Error('Taip ID pendaftaran tepat untuk mengesahkan.');
  if(typeof reason!=='string'||reason.trim().length<3||reason.trim().length>400)throw Error('Isi sebab 3–400 aksara.');
  const targetRef=doc(db,'responses',id),initial=await getDoc(targetRef);if(!initial.exists())throw Error('Rekod tidak ditemui.');const unit=initial.data().hostUnit;
  const history=await getDocs(query(collection(db,'responses'),where('hostUnit','==',unit),limit(101)));if(history.size>100)throw Error('Lebih 100 rekod. Pembetulan perlu semakan teknikal.');
  const [receipts1,receipts2]=await Promise.all([getDocs(query(collection(db,'parkingReceipts'),where('chargeId','==',id),limit(1))),getDocs(query(collection(db,'parkingReceipts'),where('relatedChargeIds','array-contains',id),limit(1)))]);if(receipts1.size||receipts2.size)throw Error('Rekod mempunyai resit; semak pelarasan atau refund berasingan.');
  const lockRef=doc(db,'overnightLocks','unit-'+unit),chargeRef=doc(db,'parkingCharges',id),queueRef=doc(db,'parkingReviewQueue',unit),auditRef=doc(collection(db,'audit')),changeRef=doc(collection(chargeRef,'changes'));
  return runTransaction(db,async tx=>{
   const all=await Promise.all(history.docs.map(d=>tx.get(d.ref)));const [lock,charge,queue]=await Promise.all([tx.get(lockRef),tx.get(chargeRef),tx.get(queueRef)]);
   if(auth.currentUser!==user)throw Error('Sesi berubah.');if(!lock.exists())throw Error('Rekod counter unit tiada. Pembetulan perlu semakan teknikal.');const rows=all.filter(s=>s.exists()).map(s=>({...s.data(),id:s.id}));const target=rows.find(r=>r.id===id);if(!target||target.hostUnit!==unit)throw Error('Rekod berubah. Muat semula.');
   if(lock.exists()&&!rows.some(r=>r.id===lock.data().responseId)&&!String(lock.data().responseId).startsWith('admin-review-'))throw Error('Sejarah berubah atau lock lama tidak lengkap. Muat semula untuk semakan.');
   if(queue.exists()&&queue.data().status==='pending'&&!(target.parkingUnused&&queue.data().reasons?.every(r=>r==='parking_usage_correction')))throw Error('Unit sudah menunggu semakan. Selesaikan semakan sedia ada dahulu.');
   const laterIds=rows.filter(r=>r.id!==id&&r.category==='Pelawat'&&String(r.stayOver).toLowerCase()==='yes'&&!r.parkingUnused&&r.status!=='Cancelled Before Entry').map(r=>r.id);
   const laterCharges=await Promise.all(laterIds.map(key=>tx.get(doc(db,'parkingCharges',key))));
   const laterMap=new Map(laterIds.map((key,i)=>[key,laterCharges[i]]));
   const c=charge.exists()?charge.data():null;if(c&&(!Number.isSafeInteger(c.paidSen)||c.paidSen!==0||c.lastReceiptId||['paid','partial','overpaid'].includes(c.paymentStatus)))throw Error('Bayaran sudah direkod atau data bayaran tidak lengkap; pembetulan dihentikan.');
   const plan=planUnusedParking(rows,id),by=user.uid,stamp=serverTimestamp();
   tx.update(targetRef,{status:'Cancelled Before Entry',parkingUnused:true,parkingUnusedReason:reason.trim(),parkingUnusedBy:by,parkingUnusedAt:stamp,parkingReviewRequired:!plan.complete,updatedAt:stamp});
   if(c&&c.amountSen!==0){if(!Number.isSafeInteger(c.amountSen)||c.amountSen<0)throw Error('Amaun caj tidak sah.');tx.set(changeRef,{beforeSen:c.amountSen,afterSen:0,reason:'Tidak menggunakan parkir: '+reason.trim(),by,at:stamp});tx.update(chargeRef,{amountSen:0,paymentStatus:'no_charge',lastChangeId:changeRef.id})}
   let recalculated=0;const unresolved=[];
   for(const correction of plan.complete?plan.corrections:[]){
    const row=rows.find(r=>r.id===correction.id),snapshot=laterMap.get(correction.id),old=snapshot?.exists()?snapshot.data():null;
    const extra=(row.vehicleNumbers||[]).filter(Boolean).length>1||(row.vehicleRowsDetailed||[]).length>1;
    const paid=old&&(!Number.isSafeInteger(old.paidSen)||old.paidSen!==0||old.lastReceiptId||['paid','partial','overpaid'].includes(old.paymentStatus));
    const changed=old&&(old.amountSen!==correction.quote.mainTotalSen||row.parkingQuote?.mainStartDay!==correction.quote.mainStartDay);
    const manual=changed&&(old.lastChangeId||old.amountSen!==row.parkingQuote?.mainTotalSen);
    if(extra||paid||manual||(row.parkingReviewRequired&&row.parkingReviewReason!=='usage_correction_requires_charge_review')){unresolved.push(row.id);continue;}
    const prior=correction.priorState;
    const toTimestamp=value=>Timestamp.fromDate(new Date(value+'T00:00:00+08:00'));
    const priorSnapshot=prior.exists?{exists:true,category:prior.category,mainUsageDays:prior.mainUsageDays,cycleStart:toTimestamp(prior.cycleStart),lastMainEnd:toTimestamp(prior.lastMainEnd),lastAnyEnd:toTimestamp(prior.lastAnyEnd),policyVersion:prior.policyVersion||correction.quote.policyVersion}:{exists:false};
    const chargeDoc=doc(db,'parkingCharges',row.id),amount=correction.quote.mainTotalSen;
    if(old&&old.amountSen!==amount){const journal=doc(collection(chargeDoc,'changes'));tx.set(journal,{beforeSen:old.amountSen,afterSen:amount,reason:'Kiraan semula selepas tidak menggunakan parkir '+id,by,at:stamp});tx.update(chargeDoc,{amountSen:amount,paymentStatus:amount===0?'no_charge':'unconfirmed',lastChangeId:journal.id});}
    else if(!old)tx.set(chargeDoc,{registrationId:row.id,amountSen:amount,paidSen:0,paymentStatus:amount===0?'no_charge':'unconfirmed',createdBy:by,createdAt:stamp});
    tx.update(doc(db,'responses',row.id),{...(['Pending','Pending Payment',''].includes(row.status||'')?{status:amount?'Pending Payment':'Pending'}:{}),parkingQuote:{...correction.quote,calculatedAt:stamp},parkingPriorState:priorSnapshot,parkingReviewRequired:false,parkingReviewReason:'',updatedAt:stamp});
    tx.set(doc(collection(db,'audit')),{ts:stamp,userId:by,rowId:row.id,unit,field:'parking_charge',old:{quote:row.parkingQuote||null,priorState:row.parkingPriorState||null,officialAmountSen:old?.amountSen??null},new:{quote:correction.quote,amountSen:amount},action:'recalculate_after_unused',notes:'Pembetulan penggunaan '+id});recalculated++;
   }
   for(const affected of plan.complete?unresolved:plan.affected)tx.update(doc(db,'responses',affected),{parkingReviewRequired:true,parkingReviewReason:'usage_correction_requires_charge_review',updatedAt:stamp});
   const date=s=>Timestamp.fromDate(new Date(s+'T00:00:00+08:00'));
   if(lock.exists()){
    const update={parkingReviewRequired:!plan.complete,parkingCorrectionResponseId:id,parkingReviewedAt:stamp,parkingReviewedBy:by,updatedAt:stamp};
    if(plan.complete&&plan.state){const s=plan.state;Object.assign(update,{parkingCategory:s.category,mainUsageDays:s.mainUsageDays,cycleStart:date(s.cycleStart),lastMainEnd:date(s.lastMainEnd),lastAnyEnd:date(s.lastAnyEnd),parkingPolicyVersion:s.policyVersion,startDate:plan.latest.eta,endDate:plan.latest.etd||plan.latest.eta,stayOver:'Yes',responseId:plan.latest.id,amendToken:plan.latest.amendToken||''});}
    else if(plan.complete)Object.assign(update,{mainUsageDays:0,stayOver:'No',responseId:id});
    tx.update(lockRef,update);
   }
   if(plan.complete&&queue.exists()&&queue.data().status==='pending'&&plan.state){const s=plan.state;tx.update(queueRef,{status:'resolved',finalCategory:s.category,finalMainUsageDays:s.mainUsageDays,finalCycleStart:date(s.cycleStart),finalLastMainEnd:date(s.lastMainEnd),finalLastAnyEnd:date(s.lastAnyEnd),resolutionReason:'Kiraan semula selepas pembetulan tidak menggunakan parkir',resolvedBy:by,resolvedByEmail:user.email||'',resolvedAt:stamp});}
   if(!plan.complete)tx.set(queueRef,{unitId:unit,status:'pending',reasons:['parking_usage_correction'],sourceResponseCount:rows.length,generatedAt:stamp});
   tx.set(auditRef,{ts:stamp,userId:by,rowId:id,unit,field:'parking_usage',old:'registered',new:'not_used',action:'mark_parking_unused',notes:reason.trim(),affectedRegistrationIds:plan.affected,counterRestored:plan.complete});
   return {restored:plan.complete,affected:plan.complete?unresolved.length:plan.affected.length,recalculated};
  });
 }};
}