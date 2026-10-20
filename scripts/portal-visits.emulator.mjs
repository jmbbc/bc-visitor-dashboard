import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';import * as sdk from 'firebase/firestore';
import {malaysiaVisitPeriod,nextPortalVisit,recordPortalVisit} from '../js/portal-visits-model.mjs';
const env=await initializeTestEnvironment({projectId:'demo-portal-counter',firestore:{host:'127.0.0.1',port:8149,rules:readFileSync(process.env.PORTAL_VISITS_TEST_RULES||new URL('../firestore.rules',import.meta.url),'utf8')}});
const db=env.unauthenticatedContext().firestore(),ref=sdk.doc(db,'portalStats','home');let passed=0;
const pass=label=>{passed++;console.log('PASS '+label);};
const current=()=>malaysiaVisitPeriod();
const initial=()=>({...current(),yearVisits:1,monthVisits:1,dayVisits:1,startedAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()});
async function seed(data){await env.withSecurityRulesDisabled(async context=>{await sdk.setDoc(sdk.doc(context.firestore(),'portalStats','home'),data);});}
try{
 await env.clearFirestore();await assertFails(sdk.setDoc(ref,{...initial(),yearVisits:500}));pass('cannot create an inflated starting count');
 assert.equal((await recordPortalVisit({sdk,db})).dayVisits,1);assert.equal((await sdk.getDoc(ref)).data().dayVisits,1);pass('anonymous initial page view creates and reads aggregate');
 assert.equal((await recordPortalVisit({sdk,db})).dayVisits,2);pass('refresh increments all current counters by one');
 await Promise.all(Array.from({length:3},()=>recordPortalVisit({sdk,db})));assert.equal((await sdk.getDoc(ref)).data().dayVisits,5);pass('concurrent transactions do not lose views');
 const before=(await sdk.getDoc(ref)).data();const valid={...before,yearVisits:6,monthVisits:6,dayVisits:6,updatedAt:sdk.serverTimestamp()};
 await assertFails(sdk.setDoc(ref,{...valid,dayVisits:1000}));pass('cannot inflate a period counter');
 await assertFails(sdk.setDoc(ref,{...valid,dayVisits:1}));pass('cannot reset current-day count');
 await assertFails(sdk.setDoc(ref,{...valid,year:current().year+1,yearVisits:1,monthVisits:1,dayVisits:1}));pass('cannot forge year to reset counters');
 await assertFails(sdk.setDoc(ref,{...valid,startedAt:sdk.serverTimestamp()}));pass('cannot replace original start timestamp');
 await assertFails(sdk.setDoc(ref,{...valid,updatedAt:sdk.Timestamp.fromMillis(0)}));pass('requires server update timestamp');
 await assertFails(sdk.setDoc(ref,{...valid,phone:'0123456789'}));pass('rejects personal data and extra fields');
 await assertFails(sdk.deleteDoc(ref));await assertFails(sdk.getDocs(sdk.collection(db,'portalStats')));await assertFails(sdk.setDoc(sdk.doc(db,'portalStats','other'),initial()));await assertFails(sdk.getDoc(sdk.doc(db,'responses','private-record')));pass('no delete, listing, other counters or private-record access');
 const p=current(),stamp=sdk.Timestamp.fromDate(new Date('2020-01-01T00:00:00Z'));
 for(const [label,old] of [['day',{...p,day:p.day===1?2:p.day-1}],['month',{...p,month:p.month===1?2:p.month-1}],['year',{...p,year:p.year-1}]]){const prior={...old,yearVisits:100,monthVisits:20,dayVisits:5,startedAt:stamp,updatedAt:stamp};await seed(prior);const expected=nextPortalVisit(prior,p),result=await recordPortalVisit({sdk,db});assert.deepEqual(result,expected);pass(label+' rollover resets only appropriate counters');}
 await env.clearFirestore();await Promise.all(Array.from({length:3},()=>recordPortalVisit({sdk,db})));assert.equal((await sdk.getDoc(ref)).data().dayVisits,3);pass('concurrent first visits retry safely when another visitor creates the aggregate');
 await seed({...p,year:p.year-1,yearVisits:100,monthVisits:20,dayVisits:5,startedAt:stamp,updatedAt:stamp});await Promise.all(Array.from({length:3},()=>recordPortalVisit({sdk,db})));const after=(await sdk.getDoc(ref)).data();assert.equal(after.yearVisits,3);assert.equal(after.monthVisits,3);assert.equal(after.dayVisits,3);pass('concurrent period rollover counts all visits');
 console.log('TOTAL '+passed+' scenarios passed');
}finally{await env.cleanup();}
