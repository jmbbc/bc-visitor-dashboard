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
  const context={window:{__FIRESTORE:{}},Date,console,CLIENT_DEDUPE_WINDOW_MIN:2,
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

test('new category 3 registration preserves category 1 counter and remains rules-compatible',async()=>{
  const writes=[];
  const state={unitId:'A-1-1',category:1,mainUsageDays:3,cycleStart:'2026-09-10',lastAnyEnd:'2026-09-12'};
  const lock={...state,startDate:stamp('2026-09-10'),endDate:stamp('2026-09-12')};
  const context={window:{__FIRESTORE:{}},Date,console,CLIENT_DEDUPE_WINDOW_MIN:2,
    clientIsoDateOnlyKey:d=>d.toISOString().slice(0,10),_shortId:()=> 'fixture',
    doc:(_db,col,id)=>({col,id}),_toDateOnly:d=>d,dateFromInputDateOnly:d=>new Date(d+'T00:00:00Z'),
    dedupeTransactionUnavailable:false,serverTimestamp:()=> 'SERVER_TIME',Timestamp:{fromDate:d=>stamp(d)},computeArrearsCategory:()=>3,
    parkingStateFromLock:()=>state,parkingPriorStateFromLock:(_unit,data)=>({exists:true,category:data.category,mainUsageDays:data.mainUsageDays}),quoteFromUnitState,
    runTransaction:async(_db,callback)=>callback({get:async ref=>({exists:()=>ref.col==='overnightLocks',data:()=>lock}),set:(ref,data)=>writes.push({ref,data})})};
  vm.createContext(context);vm.runInContext(body,context);
  await context.createResponseWithDedupe({hostUnit:'A-1-1',category:'Pelawat',stayOver:'Yes',eta:stamp('2026-09-14'),etd:stamp('2026-09-16'),amendToken:'fixture',unitArrearsAmount:500,vehicleNo:'TEST',status:'Pending'});
  const nextLock=writes.find(w=>w.ref.col==='overnightLocks').data;
  const response=writes.find(w=>w.ref.col==='responses').data;
  assert.equal(nextLock.parkingCategory,3);
  assert.equal(nextLock.mainUsageDays,6);
  assert.ok(nextLock.mainUsageDays>=lock.mainUsageDays);
  assert.equal(response.parkingQuote.mainTotalSen,4500);
  assert.equal(response.parkingQuote.mainStartDay,4);
});

test('amendment completes all Firestore reads before any write',async()=>{
  const operations=[];
  let updated=null;
  let hasWritten=false;
  const existing={hostUnit:'B2-15-9',category:'Pelawat',stayOver:'Yes',vehicleNo:'CAR-A',vehicleNumbers:['CAR-A']};
  const lock={unit:'B2-15-9',startDate:stamp('2026-09-14'),endDate:stamp('2026-09-16'),responseId:'existing-response',amendToken:'fixture'};
  const context={window:{__FIRESTORE:{}},Date,console,CLIENT_DEDUPE_WINDOW_MIN:2,
    clientIsoDateOnlyKey:d=>d.toISOString().slice(0,10),_shortId:()=> 'fixture',
    doc:(_db,col,id)=>({col,id}),_toDateOnly:d=>d,
    dateFromInputDateOnly:d=>new Date(d+'T00:00:00Z'),normalizePhoneInput:v=>v,
    collectVehicleSetFromPayloadLike:value=>Array.from(new Set([value.vehicleNo,...(value.vehicleNumbers||[])].filter(Boolean))),
    collectVehicleDetailsFromPayloadLike:value=>(value.vehicleRowsDetailed||[]),
    dedupeTransactionUnavailable:false,serverTimestamp:()=> 'SERVER_TIME',
    Timestamp:{fromDate:d=>stamp(d)},computeArrearsCategory:()=>1,
    parkingStateFromLock:()=>null,parkingPriorStateFromLock:()=>null,quoteFromUnitState,
    runTransaction:async(_db,callback)=>callback({
      get:async ref=>{
        assert.equal(hasWritten,false,`read after write: ${ref.col}`);
        operations.push(`read:${ref.col}`);
        if(ref.col==='dedupeKeys')return {exists:()=>true,data:()=>({responseId:'existing-response',amendToken:'fixture',createdAt:stamp(new Date())})};
        if(ref.col==='overnightLocks')return {exists:()=>true,data:()=>lock};
        return {exists:()=>true,data:()=>existing};
      },
      set:ref=>{hasWritten=true;operations.push(`write:${ref.col}`);},
      update:(ref,data)=>{hasWritten=true;operations.push(`write:${ref.col}`);updated=data;}
    })};
  vm.createContext(context);
  vm.runInContext(body,context);
  const result=await context.createResponseWithDedupe({hostUnit:'B2-15-9',category:'Pelawat',stayOver:'Yes',eta:stamp('2026-09-14'),etd:stamp('2026-09-16'),amendToken:'fixture',unitArrearsAmount:0,vehicleNo:'CAR-A',vehicleNumbers:['CAR-A','CAR-B'],status:'Pending'});
  assert.equal(result.amended,true);
  const firstWrite=operations.findIndex(item=>item.startsWith('write:'));
  assert.equal(operations.slice(firstWrite).some(item=>item.startsWith('read:')),false);
});

test('local management replaces a plate without appending a third vehicle',async()=>{
  let updated=null;
  const existing={hostUnit:'B2-15-9',hostName:'Host',category:'Pelawat',stayOver:'Yes',eta:stamp('2026-09-20'),etd:stamp('2026-09-21'),createdAt:stamp(new Date()),updatedAt:stamp(new Date()),status:'Pending',amendToken:'fixture',vehicleNo:'CAR-A',vehicleNumbers:['CAR-A','CAR-B'],vehicleRowsDetailed:[{plate:'CAR-A'},{plate:'CAR-B'}]};
  const lock={unit:'B2-15-9',startDate:stamp('2026-09-20'),endDate:stamp('2026-09-21'),responseId:'existing-response',amendToken:'fixture'};
  const context={window:{__FIRESTORE:{}},Date,console,CLIENT_DEDUPE_WINDOW_MIN:2,
    clientIsoDateOnlyKey:d=>d.toISOString().slice(0,10),_shortId:()=> 'fixture',doc:(_db,col,id)=>({col,id}),_toDateOnly:d=>d,
    dateFromInputDateOnly:d=>new Date(d+'T00:00:00Z'),normalizePhoneInput:v=>v,normalizeVehicleInput:v=>String(v||'').trim().toUpperCase(),
    collectVehicleSetFromPayloadLike:value=>Array.from(new Set([value.vehicleNo,...(value.vehicleNumbers||[])].filter(Boolean))),
    collectVehicleDetailsFromPayloadLike:value=>(value.vehicleRowsDetailed||[]),dedupeTransactionUnavailable:false,
    serverTimestamp:()=> 'SERVER_TIME',Timestamp:{fromDate:d=>stamp(d)},computeArrearsCategory:()=>1,
    parkingStateFromLock:()=>null,parkingPriorStateFromLock:()=>null,quoteFromUnitState,
    runTransaction:async(_db,callback)=>callback({
      get:async ref=>ref.col==='dedupeKeys'?{exists:()=>true,data:()=>({responseId:'existing-response',amendToken:'fixture',createdAt:stamp(new Date())})}:ref.col==='overnightLocks'?{exists:()=>true,data:()=>lock}:{exists:()=>true,data:()=>existing},
      set:()=>{},update:(_ref,data)=>{updated=data;}
    })};
  vm.createContext(context);vm.runInContext(body,context);
  await context.createResponseWithDedupe({hostUnit:'B2-15-9',hostName:'Host',category:'Pelawat',stayOver:'Yes',eta:stamp('2026-09-20'),etd:stamp('2026-09-21'),amendToken:'fixture',vehicleNo:'CAR-A',vehicleNumbers:['CAR-A','CAR-C'],vehicleRowsDetailed:[{plate:'CAR-A'},{plate:'CAR-C'}],status:'Pending',__replaceAmendedVehicles:true});
  assert.deepEqual(Array.from(updated.vehicleNumbers),['CAR-A','CAR-C']);
  assert.equal(updated.__replaceAmendedVehicles,undefined);
});
