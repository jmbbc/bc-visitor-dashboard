import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaymentStore} from '../js/payment-store.mjs';
import {quoteFromUnitState} from '../js/unit-cooldown.mjs';

for(const scenario of [
  {name:'partial payment',amount:1000,reset:false},
  {name:'exact payment',amount:3000,reset:true},
  {name:'overpayment',amount:4000,reset:true},
  {name:'split payments reach full amount',amount:2000,paid:1000,reset:true},
  {name:'additional payment after settlement',amount:1000,paid:3000,reset:false},
  {name:'older registration preserves newer usage',amount:3000,newer:true,reset:false},
  {name:'category three has no free entitlement',amount:3000,category:3,reset:false},
  {name:'checked in remains checked in',amount:3000,status:'Checked In',reset:true},
])test(scenario.name,async()=>{
  const writes=[], records={
    'parkingCharges/booking':{amountSen:3000,paidSen:scenario.paid||0},
    'responses/booking':{hostUnit:'A-1',status:scenario.status||'Pending Payment'},
    'overnightLocks/unit-A-1':{responseId:scenario.newer?'newer':'booking',parkingCategory:scenario.category||1,mainUsageDays:5},
  };
  const sdk={doc:(_db,col,id)=>id?`${col}/${id}`:`${_db}/audit-id`,collection:(_db,col)=>col,
    serverTimestamp:()=> 'SERVER_TIME',runTransaction:async(_db,fn)=>fn({
      get:async ref=>({exists:()=>!!records[ref],data:()=>records[ref]}),
      set:(ref,data)=>writes.push({ref,data}),update:(ref,data)=>writes.push({ref,data}),
    })};
  const store=createPaymentStore({db:{},auth:{currentUser:{uid:'guard',isAnonymous:false,getIdTokenResult:async()=>({claims:{guard:true}})}},sdk});
  await store.recordReceipt({registrationId:'booking',reference:'BANK123',amountSen:scenario.amount});
  const reset=writes.find(w=>w.ref==='overnightLocks/unit-A-1');
  assert.equal(!!reset,scenario.reset);
  if(reset){assert.equal(reset.data.mainUsageDays,0);assert.equal(reset.data.parkingReviewedBy,'guard');assert.ok(writes.some(w=>w.data.action==='payment_cooldown_reset'));}
  if(scenario.status==='Checked In')assert.ok(!writes.some(w=>w.ref==='responses/booking'));
});
test('reset counter grants fresh free days even before previous cooldown ends',()=>{
  const result=quoteFromUnitState({unitId:'A-1',category:1,state:{unitId:'A-1',category:1,mainUsageDays:0,lastAnyEnd:'2026-10-07',cycleStart:'2026-10-07'},start:'2026-10-08',end:'2026-10-08'});
  assert.equal(result.totalSen,0);assert.equal(result.nextState.mainUsageDays,1);
});
