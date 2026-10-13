import test from 'node:test';
import assert from 'node:assert/strict';
import {weeklyParkingPayment as payment} from '../js/parking-week-payment.mjs';

test('full and excess payments have no outstanding balance', () => {
  assert.deepEqual(payment({}, {amountSen:3000, paidSen:3000}), {state:'paid', label:'Selesai'});
  assert.equal(payment({}, {amountSen:3000, paidSen:4000}).state, 'paid');
});
test('unpaid and partial payments show the exact remaining balance', () => {
  assert.deepEqual(payment({}, {amountSen:3000, paidSen:1000}), {state:'pending', label:'Baki RM20.00'});
  assert.equal(payment({}, {amountSen:3000, paidSen:0}).label, 'Baki RM30.00');
});
test('verified zero charges are free, but review and failed reads remain unknown', () => {
  assert.equal(payment({}, {amountSen:0, paidSen:0}).label, 'Percuma');
  assert.equal(payment({parkingQuote:{mainTotalSen:0}}, null).label, 'Percuma');
  assert.equal(payment({parkingReviewRequired:true, parkingQuote:{mainTotalSen:0}}, null).state, 'unknown');
  assert.equal(payment({parkingQuote:{mainTotalSen:0}}, null, false).state, 'unknown');
});
test('operational approval and incomplete money fields cannot imply payment', () => {
  assert.equal(payment({status:'Checked In'}, null).state, 'unknown');
  for (const charge of [{amountSen:1000}, {amountSen:-1,paidSen:0}, {amountSen:'1000',paidSen:1000}]) {
    assert.equal(payment({}, charge).state, 'unknown');
  }
});