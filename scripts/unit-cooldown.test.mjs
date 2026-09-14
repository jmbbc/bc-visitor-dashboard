import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteUnitContinuation,quoteFromUnitState} from '../js/unit-cooldown.mjs';
const a={id:'a',unitId:'B2-15-9',vehicleId:'CAR-A',role:'main',cat:1,state:'registered',start:'2026-09-07',end:'2026-09-09'};
const b={...a,id:'b',vehicleId:'CAR-B',start:'2026-09-10',end:'2026-09-12'};
const quote=(history,application)=>quoteUnitContinuation({unitId:'B2-15-9',category:1,history,application});
test('different main car continues unit days 4–6, RM15, without mutating history',()=>{
  const saved=JSON.stringify(a);const result=quote([a],b);
  assert.equal(result.status,'quoted');assert.equal(result.totalSen,1500);
  assert.deepEqual(result.lines.map(r=>r.day),[4,5,6]);assert.equal(JSON.stringify(a),saved);
});
test('three fully empty days restore free eligibility on the 13th',()=>{
  const result=quote([a],{...b,start:'2026-09-13',end:'2026-09-15'});
  assert.equal(result.totalSen,0);assert.deepEqual(result.lines.map(r=>r.day),[1,2,3]);
});
test('additional vehicle delays unit cooldown, but does not consume main days',()=>{
  const extra={...a,id:'extra',vehicleId:'EXTRA',role:'additional',start:'2026-09-09',end:'2026-09-11'};
  const result=quote([a,extra],{...b,start:'2026-09-13',end:'2026-09-15'});
  assert.equal(result.totalSen,1500);
});
test('overlapping different main cars require review',()=>{
  assert.equal(quote([a],{...b,start:'2026-09-09',end:'2026-09-11'}).status,'requires_review');
});
test('history from another unit rejected',()=>{
  assert.throws(()=>quote([{...a,unitId:'OTHER'}],b));
});
test('compact unit state continues a different main car without new free days',()=>{
  const result=quoteFromUnitState({unitId:'B2-15-9',category:1,start:'2026-09-10',end:'2026-09-12',state:{unitId:'B2-15-9',category:1,cycleStart:'2026-09-07',mainUsageDays:3,lastAnyEnd:'2026-09-09'}});
  assert.equal(result.totalSen,1500);assert.deepEqual(result.lines.map(x=>x.day),[4,5,6]);
});
test('compact state resets only after three full empty dates',()=>{
  const state={unitId:'B2-15-9',category:1,cycleStart:'2026-09-07',mainUsageDays:3,lastAnyEnd:'2026-09-09'};
  assert.equal(quoteFromUnitState({unitId:'B2-15-9',category:1,state,start:'2026-09-12',end:'2026-09-12'}).lines[0].day,4);
  assert.equal(quoteFromUnitState({unitId:'B2-15-9',category:1,state,start:'2026-09-13',end:'2026-09-15'}).totalSen,0);
});
test('legacy summary fails closed for admin review',()=>{
  assert.equal(quoteFromUnitState({unitId:'B2-15-9',category:1,state:{legacyMissingUsage:true},start:'2026-09-10',end:'2026-09-12'}).status,'requires_review');
});

test('category 3 always quotes RM15 per day despite legacy or category transition',()=>{
  const legacy=quoteFromUnitState({unitId:'A-1-1',category:3,state:{legacyMissingUsage:true},start:'2026-10-01',end:'2026-10-03'});
  assert.equal(legacy.status,'quoted');assert.equal(legacy.totalSen,4500);
  const transition=quoteFromUnitState({unitId:'A-1-1',category:3,state:{unitId:'A-1-1',category:1,cycleStart:'2026-09-01',mainUsageDays:3,lastAnyEnd:'2026-09-03'},start:'2026-09-07',end:'2026-09-08'});
  assert.equal(transition.status,'quoted');assert.equal(transition.totalSen,3000);assert.equal(transition.nextState.mainUsageDays,2);
});

test('category 3 still sends overlapping dates for review',()=>{
  const result=quoteFromUnitState({unitId:'A-1-1',category:3,state:{unitId:'A-1-1',category:3,cycleStart:'2026-09-01',mainUsageDays:2,lastAnyEnd:'2026-09-02'},start:'2026-09-02',end:'2026-09-03'});
  assert.equal(result.status,'requires_review');
  assert.equal(result.totalSen,3000);
  assert.equal(result.lines.length,2);
  assert.equal(result.status,'requires_review');assert.equal(result.reason,'overlapping_or_out_of_order');
});

test('category 3 to category 1 resets entitlement immediately',()=>{
  const result=quoteFromUnitState({unitId:'B2-15-9',category:1,state:{unitId:'B2-15-9',category:3,cycleStart:'2026-07-03',mainUsageDays:69,lastAnyEnd:'2026-09-12'},start:'2026-09-14',end:'2026-09-16'});
  assert.equal(result.status,'quoted');assert.deepEqual(result.lines.map(line=>line.day),[1,2,3]);assert.equal(result.totalSen,0);
});

test('category 2 to category 1 keeps the counter and expands free entitlement',()=>{
  const result=quoteFromUnitState({unitId:'A-1-1',category:1,state:{unitId:'A-1-1',category:2,cycleStart:'2026-09-12',mainUsageDays:1,lastAnyEnd:'2026-09-12'},start:'2026-09-14',end:'2026-09-15'});
  assert.equal(result.status,'quoted');assert.deepEqual(result.lines.map(line=>line.day),[2,3]);assert.equal(result.totalSen,0);
});

test('explicit zero-day state starts a new entitlement despite historical end date',()=>{
  const result=quoteFromUnitState({unitId:'B2-15-9',category:1,state:{unitId:'B2-15-9',category:1,cycleStart:'2026-09-14',mainUsageDays:0,lastAnyEnd:'2026-09-12'},start:'2026-09-14',end:'2026-09-16'});
  assert.equal(result.status,'quoted');assert.deepEqual(result.lines.map(line=>line.day),[1,2,3]);assert.equal(result.totalSen,0);
});

test('completed cooldown resets a category transition to fresh category 1 entitlement',()=>{
  const result=quoteFromUnitState({unitId:'B2-15-9',category:1,state:{unitId:'B2-15-9',category:3,cycleStart:'2026-07-03',mainUsageDays:69,lastAnyEnd:'2026-09-12'},start:'2026-09-16',end:'2026-09-18'});
  assert.equal(result.status,'quoted');assert.equal(result.totalSen,0);assert.equal(result.lines[0].day,1);
});
