import test from 'node:test';
import assert from 'node:assert/strict';
import {arrearsCategory, datesInclusive, dailyRateSen, quoteSameCategory, nextFreeDate, assessCategoryChange} from '../js/parking-policy.mjs';

test('category boundaries and invalid input', () => {
  assert.deepEqual([1,1.01,400,400.01].map(arrearsCategory), [1,2,2,3]);
  for (const input of [null, NaN, Infinity, '1']) assert.throws(() => arrearsCategory(input));
});
test('inclusive dates, leap year and invalid dates', () => {
  assert.equal(datesInclusive('2026-09-01','2026-09-03').length,3);
  assert.equal(datesInclusive('2024-02-28','2024-03-01').length,3);
  assert.throws(() => datesInclusive('2026-02-29','2026-03-01'));
  assert.throws(() => datesInclusive('2026-09-03','2026-09-01'));
});
test('all main daily tariff boundaries', () => {
  assert.deepEqual([1,3,4,6,7,9,10,12,13,30,31].map(d => dailyRateSen(1,d)),[0,0,500,500,1000,1000,1500,1500,2000,2000,2000]);
  assert.deepEqual([1,2,4,5,7,8,10,11,13,14,16,17,19,20,22,23,25,26,28,29,31,32].map(d => dailyRateSen(2,d)),[0,500,500,1000,1000,1500,1500,2000,2000,2500,2500,3000,3000,3500,3500,4000,4000,4500,4500,5000,5000,5500]);
  for(let d=1;d<=90;d++) assert.equal(dailyRateSen(3,d),1500);
});
test('SOP example totals and additional rates', () => {
  const quote = (cat,end,role='main') => quoteSameCategory({cat,start:'2026-09-01',end,role}).totalSen;
  assert.equal(quote(1,'2026-09-06'),1500);
  assert.equal(quote(2,'2026-09-06'),3500);
  assert.equal(quote(3,'2026-09-03'),4500);
  assert.equal(quote(1,'2026-09-05','additional'),5000);
  assert.equal(quote(2,'2026-09-05','additional'),7500);
  assert.equal(quote(3,'2026-09-05','additional'),12500);
});
test('overlap is not billed twice and remaining free days survive a gap', () => {
  const q=quoteSameCategory({cat:1,start:'2026-09-03',end:'2026-09-05',priorDates:datesInclusive('2026-09-01','2026-09-03')});
  assert.equal(q.cycleDays,5); assert.equal(q.totalSen,1000); assert.equal(q.lines[0].amountSen,0);
  assert.equal(quoteSameCategory({cat:1,start:'2026-09-03',end:'2026-09-04',priorDates:['2026-09-01']}).totalSen,0);
});
test('cycle cap, per-application cap and explicit exception', () => {
  const args={cat:1,start:'2026-10-01',end:'2026-10-01',priorDates:datesInclusive('2026-09-01','2026-09-30')};
  assert.throws(() => quoteSameCategory(args));
  assert.equal(quoteSameCategory({...args,category3Exception:true}).totalSen,2000);
  assert.equal(quoteSameCategory({...args,cat:3}).totalSen,1500);
  assert.throws(() => quoteSameCategory({cat:3,start:'2026-09-01',end:'2026-10-01'}));
});
test('additional vehicles can renew beyond 30 days, but each application is capped', () => {
  for (const cat of [1, 2, 3]) {
    const args = {cat, role:'additional', priorDates:datesInclusive('2026-09-01','2026-10-30'), start:'2026-10-31', end:'2026-11-29'};
    const result = quoteSameCategory(args);
    assert.equal(result.cycleDays, 90);
    assert.equal(result.totalSen, 30 * ({1:1000,2:1500,3:2500}[cat]));
    assert.throws(() => quoteSameCategory({...args,end:'2026-11-30'}), /Maximum 30 days per application/);
  }
});
test('cooldown waits for additional vehicle; cancelled records ignored', () => {
  assert.equal(nextFreeDate([{start:'2026-09-01',end:'2026-09-03'}, {start:'2026-09-01',end:'2026-09-05'}, {start:'2026-09-01',end:'2026-09-10',cancelled:true}]),'2026-09-09');
  assert.equal(nextFreeDate([]),null);
});
test('unresolved transitions and invalid roles rejected', () => {
  assert.throws(() => quoteSameCategory({cat:1,previousCategory:2,start:'2026-09-01',end:'2026-09-02'}));
  assert.throws(() => dailyRateSen(1,1,'unknown'));
  assert.throws(() => dailyRateSen(1,0));
});

const changeExample = {originalCategory:2, currentCategory:1, startDate:'2026-09-04'};
test('category updated before entry routes entire registration to admin review', () => {
  const result = assessCategoryChange({...changeExample, changeDate:'2026-09-03'});
  assert.equal(result.timing,'before_entry');
  assert.equal(result.reviewPath,'whole_registration_adjustment');
  assert.equal(result.requiresCycleEligibilityCheck,true);
});
test('category updated on entry date does not assume arrival or grant free days', () => {
  const result = assessCategoryChange({...changeExample, changeDate:'2026-09-04'});
  assert.equal(result.timing,'on_entry_date');
  assert.equal(result.reviewPath,'whole_registration_adjustment');
  assert.equal(result.automaticFreeDaysReset,false);
});
test('after entry uses continuation/manual review, never automatic repricing', () => {
  const result = assessCategoryChange({...changeExample, changeDate:'2026-09-05'});
  assert.equal(result.timing,'after_entry_date');
  assert.equal(result.reviewPath,'continuation_or_manual_adjustment');
  assert.equal(result.automaticChargeChange,false);
});
test('all category changes preserve original charges and payments in every timing', () => {
  for (const originalCategory of [1,2,3]) for (const currentCategory of [1,2,3]) {
    for (const changeDate of ['2026-09-03','2026-09-04','2026-09-05']) {
      const input = Object.freeze({...changeExample,originalCategory,currentCategory,changeDate});
      const before = JSON.stringify(input);
      const result = assessCategoryChange(input);
      assert.equal(result.requiresReview,originalCategory !== currentCategory);
      assert.equal(result.requiresAdminReason,result.requiresReview);
      assert.equal(result.preserveOriginalCharge,true);
      assert.equal(result.preservePayments,true);
      assert.equal(result.automaticChargeChange,false);
      assert.equal(result.automaticFreeDaysReset,false);
      assert.equal(JSON.stringify(input),before);
      if (!result.requiresReview) assert.equal(result.reviewPath,'none');
    }
  }
});
test('arrears changes within same category do not trigger category review', () => {
  const result = assessCategoryChange({...changeExample,originalCategory:arrearsCategory(200),currentCategory:arrearsCategory(100),changeDate:'2026-09-03'});
  assert.equal(result.status,'unchanged');
  assert.equal(result.requiresReview,false);
});
test('review routing handles year boundary and rejects missing/invalid data', () => {
  assert.equal(assessCategoryChange({...changeExample,startDate:'2027-01-01',changeDate:'2026-12-31'}).timing,'before_entry');
  for (const patch of [{currentCategory:null},{originalCategory:4},{changeDate:'2026-02-29'},{changeDate:'2026-09-03T23:00:00Z'},{startDate:undefined}]) {
    assert.throws(() => assessCategoryChange({...changeExample,changeDate:'2026-09-03',...patch}));
  }
});
