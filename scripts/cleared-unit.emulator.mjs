import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import * as sdk from 'firebase/firestore';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {createClearedUnitStore} from '../js/cleared-unit-store.mjs';
const env=await initializeTestEnvironment({projectId:'demo-cleared-unit',firestore:{host:'127.0.0.1',port:8151,rules:execFileSync('git',['show','HEAD:firestore.rules'],{encoding:'utf8'})}});
const db=env.authenticatedContext('admin',{admin:true}).firestore(),auth={currentUser:{uid:'admin',getIdTokenResult:async()=>({claims:{admin:true}})}};
const store=createClearedUnitStore({db,auth,sdk});
const stamp=s=>sdk.Timestamp.fromDate(new Date(s+'T00:00:00+08:00'));
async function seed({extra=false,status='Pending Payment',paidSen=0}={}){
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx=>{const d=ctx.firestore();await sdk.setDoc(sdk.doc(d,'units','TEST'),{arrears:false,arrearsAmount:0,lastUpdatedAt:stamp('2026-10-13')});await sdk.setDoc(sdk.doc(d,'responses','a'),{hostUnit:'TEST',hostName:'Owner',hostPhone:'0123456789',visitorName:'Guest',visitorPhone:'0123456789',updatedAt:stamp('2026-10-12'),category:'Pelawat',vehicleType:'Kereta / 4x4',stayOver:'Yes',status,eta:stamp('2026-10-13'),etd:stamp('2026-10-15'),createdAt:stamp('2026-10-12'),vehicleNo:'CAR1',vehicleNumbers:extra?['CAR1','CAR2']:['CAR1'],vehicleRowsDetailed:extra?[{plate:'CAR1'},{plate:'CAR2',startDate:'2026-10-13',endDate:'2026-10-14'}]:[],unitCategory:'Kategori 2',unitArrears:true,unitArrearsAmount:100,parkingPriorState:{exists:false},parkingQuote:{mainTotalSen:extra?3000:1000,mainStartDay:1}});await sdk.setDoc(sdk.doc(d,'parkingCharges','a'),{registrationId:'a',amountSen:extra?3000:1000,paidSen,paymentStatus:paidSen?'paid':'unconfirmed',createdBy:'admin',createdAt:stamp('2026-10-12')});await sdk.setDoc(sdk.doc(d,'overnightLocks','unit-TEST'),{responseId:'a',unit:'TEST',category:'Pelawat',startDate:stamp('2026-10-13'),endDate:stamp('2026-10-15'),updatedAt:stamp('2026-10-12'),stayOver:'Yes',parkingCategory:2,mainUsageDays:3});});
}
try{
 await seed();assert.equal((await store.reprice('TEST')).count,1);let c=(await sdk.getDoc(sdk.doc(db,'parkingCharges','a'))).data();assert.equal(c.amountSen,0);assert.equal(c.paymentStatus,'no_charge');assert.ok(c.lastChangeId);assert.equal((await sdk.getDoc(sdk.doc(db,'responses','a'))).data().unitCategory,'Kategori 1');assert.equal((await sdk.getDocs(sdk.collection(db,'audit'))).size,1);assert.equal((await store.reprice('TEST')).count,0);console.log('PASS audited zero charge and repeat update under committed rules');
 await seed({extra:true});await store.reprice('TEST');assert.equal((await sdk.getDoc(sdk.doc(db,'parkingCharges','a'))).data().amountSen,2000);console.log('PASS two-day additional car remains RM20');
 for(const options of [{paidSen:1000},{status:'Checked In'},{status:'Checked Out'}]){await seed(options);assert.equal((await store.reprice('TEST')).count,0);assert.equal((await sdk.getDocs(sdk.collection(db,'audit'))).size,0);}console.log('PASS paid and entered records stay unchanged');
 const bad=createClearedUnitStore({db,auth:{currentUser:{uid:'guard',getIdTokenResult:async()=>({claims:{guard:true}})}},sdk});await assert.rejects(bad.reprice('TEST'),/Admin sahaja/);console.log('PASS guard cannot reprice');
}finally{await env.cleanup();}
