import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const visitor=readFileSync(new URL('../js/visitor.js',import.meta.url),'utf8');
const payments=readFileSync(new URL('../js/payment-store.mjs',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../js/dashboard.js',import.meta.url),'utf8');
const dashboardPayments=readFileSync(new URL('../js/dashboard-payments.mjs',import.meta.url),'utf8');
const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');

test('rules permit only a verified category 3 to 1 counter reset',()=>{
  assert.match(rules,/resource\.data\.parkingCategory == 3/);
  assert.match(rules,/data\.parkingCategory == 1/);
  assert.match(rules,/data\.mainUsageDays >= 1 && data\.mainUsageDays <= 3/);
  assert.match(rules,/get\(unitPath\)\.data\.arrearsAmount <= 1/);
});
test('charged cooldown submission is pending payment and creates one linked charge',()=>{assert.match(visitor,/docPayload\.status = 'Pending Payment'/);assert.match(visitor,/parkingCharges', targetRespId/);assert.match(visitor,/paidSen: 0/);});
test('staff receipt updates cumulative payment and approves only once fully paid',()=>{assert.match(payments,/paidSen>=chargeData\.amountSen/);assert.match(payments,/status:'Approved'/);assert.match(rules,/oldData\.status == 'Pending Payment' && newData\.status == 'Approved'/);});
test('guard operational transitions cannot bypass pending payment',()=>{assert.match(rules,/oldData\.status == 'Approved' && newData\.status == 'Checked In'/);assert.doesNotMatch(rules,/oldData\.status == 'Pending Payment' && newData\.status == 'Checked In'/);});
test('registration list opens its linked payment record on demand',()=>{assert.match(dashboard,/dashboard:open-payment/);assert.match(dashboardPayments,/event\.detail\?\.registrationId/);assert.match(dashboardPayments,/await load\(id\)/);});
test('category 3 review preserves a provisional quote for admin finalisation',()=>{assert.match(visitor,/parkingDecision\?\.status === 'requires_review'/);assert.match(visitor,/Number\.isSafeInteger\(parkingDecision\.totalSen\)/);assert.match(payments,/parking_charge_review/);});
test('category changes after submission preserve the original category and remain auditable',()=>{assert.match(dashboardPayments,/selectedCategory=originalCategory\|\|result\.currentCategory/);assert.match(dashboardPayments,/pendaftaran ini kekal Kategori/);assert.doesNotMatch(dashboardPayments,/categoryNeedsReview/);assert.match(payments,/parking_category_charge_adjustment/);});
test('admin cancellation restores prior unit state and blocks paid cancellations',()=>{assert.match(visitor,/parkingPriorStateFromLock/);assert.match(payments,/cancelBeforeEntry/);assert.match(payments,/Bayaran sudah diterima/);assert.match(payments,/Cancelled Before Entry/);});
test('new visitor submissions require a main vehicle number in UI, client and rules',()=>{assert.match(visitor,/Sila masukkan nombor kenderaan utama/);assert.match(rules,/request\.resource\.data\.vehicleNo\.size\(\) > 0/);});
