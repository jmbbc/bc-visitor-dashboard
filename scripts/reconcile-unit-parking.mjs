// Reconcile one explicitly selected unit/registration. Dry run by default.
import admin from 'firebase-admin';import {readFileSync} from 'node:fs';
import {buildUnitParkingLedger} from '../js/parking-unit-ledger.mjs';import {createUnitParkingLedgerStore} from '../js/parking-unit-ledger-store.mjs';import {malaysiaDate} from '../js/charge-explanation-model.mjs';
const [unit,id]=process.argv.slice(2);if(!unit||!id)throw Error('Usage: node scripts/reconcile-unit-parking.mjs UNIT REGISTRATION [--apply]');
if(!process.env.GOOGLE_APPLICATION_CREDENTIALS||JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8')).project_id!=='banjariavisitor')throw Error('Expected banjariavisitor credential required.');
admin.initializeApp({credential:admin.credential.applicationDefault()});const db=admin.firestore();
const history=await db.collection('responses').where('hostUnit','==',unit).limit(101).get();if(history.size>100)throw Error('History exceeds safe limit.');const rows=history.docs.map(d=>({...d.data(),id:d.id})),target=rows.find(r=>r.id===id);if(!target||target.parkingUnused)throw Error('Active registration/unit mismatch.');
const ledger=buildUnitParkingLedger(rows,{unit,from:malaysiaDate(target.eta)});console.log(JSON.stringify({unit,plans:ledger.plans.map(p=>({id:p.record.id,from:malaysiaDate(p.record.eta),amountSen:p.totalSen,days:p.lines.map(l=>({date:l.date,role:l.role,shared:l.shared,amountSen:l.amountSen}))}))}));
if(process.argv.includes('--apply')){
 const wrap=s=>({id:s.id,ref:s.ref,exists:()=>s.exists,data:()=>s.data()});
 const sdk={Timestamp:admin.firestore.Timestamp,serverTimestamp:()=>admin.firestore.FieldValue.serverTimestamp(),doc:(base,...segments)=>segments.length?base.doc(segments.join('/')):base.doc(),collection:(base,...segments)=>base.collection(segments.join('/')),where:(...args)=>q=>q.where(...args),limit:n=>q=>q.limit(n),query:(q,...f)=>f.reduce((r,x)=>x(r),q),getDoc:async ref=>wrap(await ref.get()),getDocs:q=>q.get(),runTransaction:(database,action)=>database.runTransaction(tx=>action({get:async ref=>wrap(await tx.get(ref)),set:(...args)=>tx.set(...args),update:(...args)=>tx.update(...args)}))};
 await db.doc('parkingLedgerQueue/'+unit).set({unit,responseId:id,status:'pending',requestedAt:admin.firestore.FieldValue.serverTimestamp()});
 const actor='admin-authorized-ledger-migration',user={uid:actor,email:'',getIdTokenResult:async()=>({claims:{admin:true}})};
 console.log(JSON.stringify({saved:await createUnitParkingLedgerStore({db,auth:{currentUser:user},sdk}).reconcile({unit,queuedResponseId:id})}));
 for(const p of ledger.plans){const r=await db.doc('responses/'+p.record.id).get(),c=await db.doc('parkingCharges/'+p.record.id).get();console.log(JSON.stringify({id:p.record.id,amountSen:c.data()?.amountSen,review:r.data()?.parkingReviewRequired,version:r.data()?.parkingLedgerVersion}));}
}
