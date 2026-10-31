import {buildUnitParkingLedger} from './parking-unit-ledger.mjs?v=20261031-hs-1';
import {malaysiaDate} from './charge-explanation-model.mjs';
export const isClearedUnit = unit => unit?.arrears === false && unit.arrearsAmount === 0;
export function canRepriceBeforeEntry(row, charge) {
 return row.category === 'Pelawat' && ['Pending','Pending Payment','Approved'].includes(row.status)
  && !row.parkingUnused && !row.parkingReviewRequired && !row.checkInAt && !row.checkedInAt
  && (!charge || (charge.paidSen === 0 && !charge.lastReceiptId && !charge.lastChangeId
   && ['unconfirmed','no_charge'].includes(charge.paymentStatus)));
}
export function planClearedUnit(records, charges, unit) {
 const eligible=records.filter(r=>canRepriceBeforeEntry(r,charges.get(r.id)) && (r.unitArrears !== false || r.unitArrearsAmount !== 0 || r.unitCategory !== 'Kategori 1'));
 if(!eligible.length)return {eligible:[],plans:[],ledger:null};
 const ids=new Set(eligible.map(r=>r.id));
 const revised=records.map(r=>ids.has(r.id)?{...r,unitCategory:'Kategori 1',unitArrears:false,unitArrearsAmount:0}:r);
 const overnight=eligible.filter(r=>String(r.stayOver).toLowerCase()==='yes');
 const from=overnight.map(r=>malaysiaDate(r.eta)).sort()[0];
 const ledger=from?buildUnitParkingLedger(revised,{unit,from}):null;
 // A pending amendment must not silently change a paid or checked-in allocation.
 if(ledger)for(const p of ledger.plans){if(ids.has(p.record.id))continue;const old=charges.get(p.record.id)?.amountSen ?? p.record.parkingQuote?.mainTotalSen;
  if(p.lines.some(l=>l.date>=from)&&old!==p.totalSen)throw Error('Pengiraan bertindih dengan rekod yang dilindungi; semakan admin diperlukan.');
 }
 return {eligible:revised.filter(r=>ids.has(r.id)),plans:ledger?.plans.filter(p=>ids.has(p.record.id))||[],ledger};
}
export function createClearedUnitStore({db,auth,sdk}) {
 const {doc,collection,query,where,limit,getDocs,runTransaction,serverTimestamp,Timestamp}=sdk;
 return {async reprice(unit){
  const user=auth.currentUser;if(!user||(await user.getIdTokenResult()).claims.admin!==true)throw Error('Admin sahaja.');
  const history=await getDocs(query(collection(db,'responses'),where('hostUnit','==',unit),limit(101)));
  if(history.size>100)throw Error('Sejarah melebihi 100 rekod; semakan teknikal diperlukan.');
  return runTransaction(db,async tx=>{
   const unitRef=doc(db,'units',unit),lockRef=doc(db,'overnightLocks','unit-'+unit);
   const [unitSnap,lock,...snaps]=await Promise.all([tx.get(unitRef),tx.get(lockRef),...history.docs.map(s=>tx.get(s.ref))]);
   if(auth.currentUser!==user)throw Error('Sesi berubah.');
   if(!unitSnap.exists()||!isClearedUnit(unitSnap.data()))return {count:0};
   const rows=snaps.filter(s=>s.exists()).map(s=>({...s.data(),id:s.id}));
   // A concurrent new registration changes the unit lock; never replace an unseen counter.
   if(lock.exists()&&!rows.some(r=>r.id===lock.data().responseId)&&!String(lock.data().responseId).startsWith('admin-review-'))throw Error('Sejarah unit berubah; cuba simpan semula.');
   const cs=await Promise.all(rows.map(r=>tx.get(doc(db,'parkingCharges',r.id))));
   const charges=new Map(rows.map((r,i)=>[r.id,cs[i].exists()?cs[i].data():null]));
   const result=planClearedUnit(rows,charges,unit);if(!result.eligible.length)return {count:0};
   if(result.eligible.length>15)throw Error('Lebih 15 permohonan aktif; semakan teknikal diperlukan.');
   if(result.ledger&&(!lock.exists()||lock.data().parkingReviewRequired))throw Error('Counter unit perlu disemak sebelum penyelarasan automatik.');
   const stamp=serverTimestamp(),date=s=>Timestamp.fromDate(new Date(s+'T00:00:00+08:00'));
   for(const r of result.eligible){
    const old=rows.find(x=>x.id===r.id),p=result.plans.find(x=>x.record.id===r.id);
    if(String(r.stayOver).toLowerCase()==='yes'&&!p)throw Error('Pecahan parkir tidak lengkap.');
    const amount=p?.totalSen||0,charge=charges.get(r.id),chargeRef=doc(db,'parkingCharges',r.id);
    const patch={unitCategory:'Kategori 1',unitArrears:false,unitArrearsAmount:0,unitLastUpdatedAt:unitSnap.data().lastUpdatedAt||stamp,updatedAt:stamp,status:amount?'Pending Payment':(r.status==='Approved'?'Approved':'Pending')};
    if(p){const prior=p.priorState;Object.assign(patch,{parkingQuote:{...p.quote,calculatedAt:stamp},parkingDailyBreakdown:p.lines,parkingLedgerVersion:result.ledger.version,parkingReviewRequired:false,parkingReviewReason:p.exempt?'vehicle_type_exempt':'',parkingPriorState:prior?{exists:true,category:prior.category,mainUsageDays:prior.mainUsageDays,cycleStart:date(prior.cycleStart),lastMainEnd:date(prior.lastMainEnd),lastAnyEnd:date(prior.lastAnyEnd),policyVersion:prior.policyVersion||p.quote.policyVersion}:{exists:false}});}
    if(charge&&charge.amountSen!==amount){const change=doc(collection(chargeRef,'changes'));tx.set(change,{beforeSen:charge.amountSen,afterSen:amount,reason:'Tunggakan selesai sebelum check-in',by:user.uid,at:stamp});tx.update(chargeRef,{amountSen:amount,paymentStatus:amount?'unconfirmed':'no_charge',lastChangeId:change.id});}
    else if(!charge)tx.set(chargeRef,{registrationId:r.id,amountSen:amount,paidSen:0,paymentStatus:amount?'unconfirmed':'no_charge',createdBy:user.uid,createdAt:stamp});
    tx.update(doc(db,'responses',r.id),patch);
    tx.set(doc(collection(db,'audit')),{ts:stamp,userId:user.uid,rowId:r.id,unit,field:'parking_charge',old:{category:old.unitCategory,arrears:old.unitArrearsAmount,amountSen:charge?.amountSen??null},new:{category:'Kategori 1',arrears:0,amountSen:amount},action:'clear_arrears_before_entry',notes:'Tunggakan selesai sebelum check-in'});
   }
   const state=result.ledger?.state;if(state)tx.update(lockRef,{parkingCategory:state.category,mainUsageDays:state.mainUsageDays,cycleStart:date(state.cycleStart),lastMainEnd:date(state.lastMainEnd),lastAnyEnd:date(state.lastAnyEnd),parkingPolicyVersion:state.policyVersion,updatedAt:stamp});
   return {count:result.eligible.length};
  });
 }};
}
