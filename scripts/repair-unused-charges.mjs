// Scoped repair of a previously confirmed unused registration. Dry run by default.
import admin from 'firebase-admin';
import {readFileSync} from 'node:fs';
import {planUnusedParking} from '../js/parking-unused-policy.mjs';
import {createUnusedParkingStore} from '../js/parking-unused-store.mjs';
import {malaysiaDate} from '../js/charge-explanation-model.mjs';
const [unit,id]=process.argv.slice(2);if(!unit||!id)throw Error('Usage: node scripts/repair-unused-charges.mjs UNIT REGISTRATION [--apply]');
if(!process.env.GOOGLE_APPLICATION_CREDENTIALS||JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS,'utf8')).project_id!=='banjariavisitor')throw Error('Expected banjariavisitor credential required.');
admin.initializeApp({credential:admin.credential.applicationDefault()});const db=admin.firestore();
const wrap=s=>({id:s.id,ref:s.ref,exists:()=>s.exists,data:()=>s.data()});
const sdk={Timestamp:admin.firestore.Timestamp,serverTimestamp:()=>admin.firestore.FieldValue.serverTimestamp(),
 doc:(base,...segments)=>segments.length?base.doc(segments.join('/')):base.doc(),collection:(base,...segments)=>base.collection(segments.join('/')),
 where:(...args)=>q=>q.where(...args),limit:n=>q=>q.limit(n),query:(q,...constraints)=>constraints.reduce((result,f)=>f(result),q),
 getDoc:async ref=>wrap(await ref.get()),getDocs:q=>q.get(),
 runTransaction:(database,action)=>database.runTransaction(tx=>action({get:async ref=>wrap(await tx.get(ref)),set:(...args)=>tx.set(...args),update:(...args)=>tx.update(...args)}))};
const initial=await db.doc('responses/'+id).get();if(!initial.exists||initial.data().hostUnit!==unit||!initial.data().parkingUnused)throw Error('Unit / previously confirmed unused registration mismatch.');
const snapshot=await db.collection('responses').where('hostUnit','==',unit).limit(101).get();if(snapshot.size>100)throw Error('History exceeds safe limit.');
const rows=snapshot.docs.map(d=>({...d.data(),id:d.id})),plan=planUnusedParking(rows,id);if(!plan.complete)throw Error(plan.reason);
console.log(JSON.stringify({unit,id,complete:plan.complete,corrections:plan.corrections.map(c=>({id:c.id,from:malaysiaDate(rows.find(r=>r.id===c.id).eta),amountSen:c.quote.mainTotalSen,startDay:c.quote.mainStartDay}))}));
if(process.argv.includes('--apply')){
 const credential=admin.app().options.credential;const actor=credential.serviceAccountEmail||'admin-authorized-usage-repair';
 const user={uid:actor,email:actor,getIdTokenResult:async()=>({claims:{admin:true}})};
 const store=createUnusedParkingStore({db,auth:{currentUser:user},sdk});
 console.log(JSON.stringify({saved:await store.markUnused({registrationId:id,confirmId:id,reason:initial.data().parkingUnusedReason||'Pembetulan penggunaan disahkan admin'})}));
 for(const c of plan.corrections){const r=await db.doc('responses/'+c.id).get(),charge=await db.doc('parkingCharges/'+c.id).get();console.log(JSON.stringify({id:c.id,amountSen:charge.data()?.amountSen,review:r.data()?.parkingReviewRequired,startDay:r.data()?.parkingQuote?.mainStartDay}));}
}
