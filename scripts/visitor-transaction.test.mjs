import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {quoteFromUnitState} from '../js/unit-cooldown.mjs';

const source=readFileSync(new URL('../js/visitor.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('async function createResponseWithDedupe(payload){'),source.indexOf('// Client-side duplicate protection:'));
const stamp=value=>({toDate:()=>new Date(value)});
for(const oldDays of [0,2])test(`overnight transaction builds response and prior state with counter ${oldDays}`,async()=>{
  const writes=[];
  const state={unitId:'B2-15-9',category:1,mainUsageDays:oldDays,cycleStart:'2026-09-12',lastAnyEnd:'2026-09-12'};
  const lock={...state,startDate:stamp('2026-09-10'),endDate:stamp('2026-09-12')};
  const context={window:{__FIRESTORE:{}},Date,console,
    clientIsoDateOnlyKey:d=>d.toISOString().slice(0,10),_shortId:()=> 'fixture',
    doc:(_db,col,id)=>({col,id}),_toDateOnly:d=>d,
    dateFromInputDateOnly:d=>new Date(d+'T00:00:00Z'),
    dedupeTransactionUnavailable:false,serverTimestamp:()=> 'SERVER_TIME',
    Timestamp:{fromDate:d=>stamp(d)},computeArrearsCategory:()=>1,
    parkingStateFromLock:()=>state,
    parkingPriorStateFromLock:(_unit,data)=>({exists:true,mainUsageDays:data.mainUsageDays}),
    quoteFromUnitState,
    runTransaction:async(_db,callback)=>callback({
      get:async ref=>({exists:()=>ref.col==='overnightLocks',data:()=>lock}),
      set:(ref,data)=>writes.push({ref,data})
    })};
  vm.createContext(context);
  vm.runInContext(body,context);
  const result=await context.createResponseWithDedupe({hostUnit:'B2-15-9',category:'Pelawat',stayOver:'Yes',eta:stamp('2026-09-14'),etd:stamp('2026-09-16'),amendToken:'fixture',unitArrearsAmount:0,vehicleNo:'TEST',status:'Pending'});
  assert.equal(result.success,true);
  const response=writes.find(w=>w.ref.col==='responses').data;
  assert.equal(response.parkingPriorState.mainUsageDays,oldDays);
  assert.equal(response.parkingQuote.mainStartDay,oldDays+1);
  assert.equal(writes.some(w=>w.ref.col==='parkingCharges'),oldDays>0);
});
