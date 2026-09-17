import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteSameCategory,assessCategoryChange} from '../js/parking-policy.mjs';
import {createPaymentLedger,applyPaymentCommand,paymentSummary} from '../js/parking-payments.mjs';
const admin={id:'admin-demo',role:'admin'},guard={id:'guard-demo',role:'guard'};
const apply=(state,type,extra,actor=admin)=>applyPaymentCommand(state,{type,operationId:type,at:'2026-09-08T00:00:00Z',...extra},actor);
function seeded(){
  const original=quoteSameCategory({cat:1,role:'additional',start:'2026-09-01',end:'2026-09-03'});
  const main=quoteSameCategory({cat:1,start:'2026-09-04',end:'2026-09-06',priorDates:['2026-09-01','2026-09-02','2026-09-03']});
  const extra=quoteSameCategory({cat:1,role:'additional',start:'2026-09-04',end:'2026-09-05'});
  return createPaymentLedger([{id:'original',amountSen:original.totalSen},{id:'extension',amountSen:main.totalSen+extra.totalSen}]);
}
test('generated charges -> payment -> admin adjustment preserves receipt, shows RM20 excess',()=>{
  let state=seeded();assert.deepEqual(state.charges.map(c=>c.amountSen),[3000,3500]);
  state=apply(state,'record',{receiptId:'r1',reference:'BANK1',amountSen:3000,chargeId:'original'},guard);
  const receipts=structuredClone(state.receipts),before=structuredClone(state);
  state=apply(state,'adjust_charge',{chargeId:'original',expectedAmountSen:3000,amountSen:1000,reason:'Pelarasan manual contoh selepas semakan admin.'});
  const summary=paymentSummary(state);
  assert.equal(summary.charges[0].overpaidSen,2000);assert.equal(summary.charges[0].status,'overpaid');
  assert.equal(summary.charges[1].balanceSen,3500);assert.equal(summary.receivedSen,3000);
  assert.deepEqual(state.receipts,receipts);assert.equal(before.charges[0].amountSen,3000);
  assert.equal(state.charges[0].originalAmountSen,3000);assert.equal(state.charges[0].adjustments[0].fromSen,3000);
});
test('split receipt then adjust one charge never transfers excess to the other',()=>{
  let state=apply(seeded(),'record',{receiptId:'r',reference:'BANK2',amountSen:4500},guard);
  state=apply(state,'allocate',{receiptId:'r',reason:'split',allocations:[{chargeId:'original',amountSen:1000},{chargeId:'extension',amountSen:3500}]});
  state=apply(state,'adjust_charge',{chargeId:'extension',expectedAmountSen:3500,amountSen:1500,reason:'Manual review'});
  const s=paymentSummary(state);assert.equal(s.charges[0].balanceSen,2000);assert.equal(s.charges[1].overpaidSen,2000);
  assert.equal(s.receivedSen,4500);assert.equal(s.unallocatedSen,0);
  state=apply(state,'void',{receiptId:'r',reason:'Wrong receipt'});
  assert.deepEqual(paymentSummary(state).charges.map(c=>c.balanceSen),[3000,1500]);
});
test('category change preserves submitted ledger and payments without review',()=>{
  const state=seeded(),snapshot=JSON.stringify(state);
  for(const changeDate of ['2026-09-03','2026-09-04','2026-09-05']){
    const review=assessCategoryChange({originalCategory:2,currentCategory:1,startDate:'2026-09-04',changeDate});
    assert.equal(review.requiresReview,false);assert.equal(review.status,'snapshot_preserved');assert.equal(review.automaticChargeChange,false);
    assert.equal(JSON.stringify(state),snapshot);
  }
});
test('adjustment rejects guard, blank reason, invalid/stale amount and missing charge',()=>{
  const state=seeded();const args={chargeId:'original',expectedAmountSen:3000,amountSen:1000,reason:'review'};
  assert.throws(()=>apply(state,'adjust_charge',args,guard));
  for(const patch of [{reason:' '},{amountSen:-1},{amountSen:1.2},{expectedAmountSen:2000},{chargeId:'unknown'}])assert.throws(()=>apply(state,'adjust_charge',{...args,...patch}));
  assert.equal(state.events.length,0);
});
test('repeated adjustments preserve original and retry is idempotent',()=>{
  const args={chargeId:'original',expectedAmountSen:3000,amountSen:0,reason:'review'};
  let state=apply(seeded(),'adjust_charge',args);assert.deepEqual(apply(state,'adjust_charge',args),state);
  assert.equal(paymentSummary(state).charges[0].status,'no_charge');
  state=apply(state,'adjust_charge',{...args,operationId:'adjust-2',expectedAmountSen:0,amountSen:4000});
  assert.equal(state.charges[0].originalAmountSen,3000);assert.equal(state.charges[0].adjustments.length,2);
  assert.equal(paymentSummary(state).charges[0].balanceSen,4000);
});
