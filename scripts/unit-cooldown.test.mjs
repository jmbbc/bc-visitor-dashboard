import test from 'node:test';
import assert from 'node:assert/strict';
import {nextFreeParkingDate,quoteUnitContinuation,quoteFromUnitState} from '../js/unit-cooldown.mjs';
const a={id:'a',unitId:'B2-15-9',vehicleId:'CAR-A',role:'main',cat:1,state:'registered',start:'2026-09-07',end:'2026-09-09'};
const b={...a,id:'b',vehicleId:'CAR-B',start:'2026-09-10',end:'2026-09-12'};

test('next free parking begins after three full cooldown dates',()=>{
  assert.equal(nextFreeParkingDate({category:1,lastAnyEnd:'2026-09-19'}),'2026-09-23');
  assert.equal(nextFreeParkingDate({category:2,lastAnyEnd:'2026-09-19'}),'2026-09-23');
  assert.equal(nextFreeParkingDate({category:3,lastAnyEnd:'2026-09-19'}),null);
});
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
  assert.equal(transition.status,'quoted');assert.equal(transition.totalSen,3000);assert.equal(transition.nextState.mainUsageDays,5);assert.equal(transition.nextState.cycleStart,'2026-09-01');
});

test('category 2 to category 3 preserves the prior counter while charging RM15 daily',()=>{
  const transition=quoteFromUnitState({unitId:'A-2-2',category:3,state:{unitId:'A-2-2',category:2,cycleStart:'2026-09-10',mainUsageDays:1,lastAnyEnd:'2026-09-10'},start:'2026-09-11',end:'2026-09-12'});
  assert.equal(transition.status,'quoted');assert.equal(transition.totalSen,3000);
  assert.deepEqual(transition.lines.map(line=>line.amountSen),[1500,1500]);
  assert.deepEqual(transition.lines.map(line=>line.day),[2,3]);
  assert.equal(transition.nextState.mainUsageDays,3);
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

test('category 2 counter beyond day 30 remains payable and does not block registration',()=>{
  const result=quoteFromUnitState({unitId:'B3-14-7',category:2,state:{unitId:'B3-14-7',category:2,cycleStart:'2026-07-26',mainUsageDays:39,lastAnyEnd:'2026-09-13'},start:'2026-09-14',end:'2026-09-16'});
  assert.equal(result.status,'quoted');
  assert.deepEqual(result.lines.map(line=>line.day),[40,41,42]);
  assert.equal(result.totalSen,20500);
  assert.equal(result.nextState.mainUsageDays,42);
});

test('category 2 exact October example resets only on 21 October',()=>{
  const first=quoteFromUnitState({unitId:'TEST-2',category:2,start:'2026-10-15',end:'2026-10-17'});
  assert.deepEqual(first.lines.map(l=>l.amountSen),[0,500,500]);assert.equal(first.totalSen,1000);
  assert.equal(nextFreeParkingDate({category:2,lastAnyEnd:'2026-10-17'}),'2026-10-21');
  const saved=JSON.stringify(first.nextState);
  const early=quoteFromUnitState({unitId:'TEST-2',category:2,state:first.nextState,start:'2026-10-20',end:'2026-10-20'});
  assert.equal(early.lines[0].day,4);assert.equal(early.totalSen,500);
  const second=quoteFromUnitState({unitId:'TEST-2',category:2,state:first.nextState,start:'2026-10-21',end:'2026-10-23'});
  assert.deepEqual(second.lines.map(l=>l.day),[1,2,3]);assert.deepEqual(second.lines.map(l=>l.amountSen),[0,500,500]);
  assert.equal(second.nextState.cycleStart,'2026-10-21');assert.equal(second.nextState.mainUsageDays,3);assert.equal(JSON.stringify(first.nextState),saved);
});
test('category 2 additional vehicle ending on 18 October delays new entitlement to 22 October',()=>{
  const state={unitId:'TEST-2',category:2,mainUsageDays:3,cycleStart:'2026-10-15',lastAnyEnd:'2026-10-18'};
  const on21=quoteFromUnitState({unitId:'TEST-2',category:2,state,start:'2026-10-21',end:'2026-10-21'});
  const on22=quoteFromUnitState({unitId:'TEST-2',category:2,state,start:'2026-10-22',end:'2026-10-22'});
  assert.equal(on21.lines[0].day,4);assert.equal(on21.totalSen,500);assert.equal(on22.lines[0].day,1);assert.equal(on22.totalSen,0);
});
test('category 1 restores three free days after exact October cooldown',()=>{
  const first=quoteFromUnitState({unitId:'TEST-1',category:1,start:'2026-10-15',end:'2026-10-17'});
  assert.deepEqual(first.lines.map(l=>l.amountSen),[0,0,0]);assert.equal(first.totalSen,0);
  const early=quoteFromUnitState({unitId:'TEST-1',category:1,state:first.nextState,start:'2026-10-20',end:'2026-10-20'});
  assert.equal(early.lines[0].day,4);assert.equal(early.totalSen,500);
  const fresh=quoteFromUnitState({unitId:'TEST-1',category:1,state:first.nextState,start:'2026-10-21',end:'2026-10-23'});
  assert.deepEqual(fresh.lines.map(l=>l.day),[1,2,3]);assert.deepEqual(fresh.lines.map(l=>l.amountSen),[0,0,0]);
  assert.equal(fresh.nextState.cycleStart,'2026-10-21');assert.equal(fresh.nextState.mainUsageDays,3);
  const next=quoteFromUnitState({unitId:'TEST-1',category:1,state:fresh.nextState,start:'2026-10-24',end:'2026-10-24'});
  assert.equal(next.lines[0].day,4);assert.equal(next.totalSen,500);
});
test('category 1 to 2 at month boundary continues day count using new category rates',()=>{
  const state={unitId:'TEST-TRANSITION',category:1,mainUsageDays:3,cycleStart:'2026-10-29',lastAnyEnd:'2026-10-31'};
  const original=JSON.stringify(state);
  const result=quoteFromUnitState({unitId:state.unitId,category:2,state,start:'2026-11-01',end:'2026-11-03'});
  assert.equal(result.status,'quoted');assert.deepEqual(result.lines.map(l=>l.day),[4,5,6]);assert.deepEqual(result.lines.map(l=>l.amountSen),[500,1000,1000]);assert.equal(result.totalSen,2500);
  assert.equal(result.nextState.category,2);assert.equal(result.nextState.cycleStart,'2026-10-29');assert.equal(result.nextState.mainUsageDays,6);assert.equal(JSON.stringify(state),original);
});
test('category 1 to 2 after three complete cooldown days starts fresh category 2 entitlement',()=>{
  const state={unitId:'TEST-TRANSITION',category:1,mainUsageDays:3,cycleStart:'2026-10-29',lastAnyEnd:'2026-10-31'};
  const result=quoteFromUnitState({unitId:state.unitId,category:2,state,start:'2026-11-04',end:'2026-11-06'});
  assert.deepEqual(result.lines.map(l=>l.day),[1,2,3]);assert.deepEqual(result.lines.map(l=>l.amountSen),[0,500,500]);assert.equal(result.nextState.cycleStart,'2026-11-04');
});
test('category 1 to 2 overlapping dates still require review',()=>{
  const state={unitId:'TEST-TRANSITION',category:1,mainUsageDays:3,cycleStart:'2026-10-29',lastAnyEnd:'2026-10-31'};
  assert.equal(quoteFromUnitState({unitId:state.unitId,category:2,state,start:'2026-10-31',end:'2026-11-02'}).status,'requires_review');
});