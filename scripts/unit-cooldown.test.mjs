import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteUnitContinuation} from '../js/unit-cooldown.mjs';
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
