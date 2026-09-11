import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileReviewWithLock} from '../js/category-review-reconcile.mjs';

test('A-6-3 starts a fresh cycle after three full empty dates',()=>{
  const result=reconcileReviewWithLock({cycleStart:'2026-08-28',mainUsageDays:3,lastMainEnd:'2026-08-30',lastAnyEnd:'2026-08-30'},{stayOver:'Yes',startDate:'2026-09-11',endDate:'2026-09-12'});
  assert.deepEqual({...result,changed:undefined,reason:undefined},{cycleStart:'2026-09-11',mainUsageDays:2,lastMainEnd:'2026-09-12',lastAnyEnd:'2026-09-12',changed:undefined,reason:undefined});
  assert.equal(result.reason,'new_cycle');
});

test('B1-9-3 starts a fresh three-day cycle',()=>{
  const result=reconcileReviewWithLock({cycleStart:'2026-09-03',mainUsageDays:2,lastMainEnd:'2026-09-04',lastAnyEnd:'2026-09-04'},{stayOver:'Yes',startDate:'2026-09-11',endDate:'2026-09-13'});
  assert.equal(result.mainUsageDays,3);assert.equal(result.cycleStart,'2026-09-11');assert.equal(result.lastAnyEnd,'2026-09-13');
});

test('B3-14-7 continues from day 36 to day 39',()=>{
  const result=reconcileReviewWithLock({cycleStart:'2026-07-27',mainUsageDays:36,lastMainEnd:'2026-09-10',lastAnyEnd:'2026-09-10'},{stayOver:'Yes',startDate:'2026-09-11',endDate:'2026-09-13'});
  assert.equal(result.mainUsageDays,39);assert.equal(result.cycleStart,'2026-07-27');assert.equal(result.lastMainEnd,'2026-09-13');assert.equal(result.reason,'continued_cycle');
});

test('unchanged and non-overnight locks do not rewrite the form',()=>{
  const candidate={cycleStart:'2026-09-01',mainUsageDays:3,lastMainEnd:'2026-09-03',lastAnyEnd:'2026-09-03'};
  assert.equal(reconcileReviewWithLock(candidate,{stayOver:'No',startDate:'2026-09-10',endDate:'2026-09-10'}).changed,false);
  assert.equal(reconcileReviewWithLock(candidate,{stayOver:'Yes',startDate:'2026-09-02',endDate:'2026-09-03'}).changed,false);
});
