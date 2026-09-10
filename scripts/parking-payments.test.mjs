import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaymentLedger,applyPaymentCommand,paymentSummary,parseRinggit} from '../js/parking-payments.mjs';
const guard={id:'guard-demo',role:'guard'},admin={id:'admin-demo',role:'admin'};
const base=()=>createPaymentLedger([{id:'original',amountSen:1000},{id:'extension',amountSen:3500}]);
const cmd=(type,extra={})=>({type,operationId:'op-1',receiptId:'receipt-1',at:'2026-09-08T00:00:00Z',...extra});
const receipt=(extra={})=>cmd('record',{reference:'BANK-1',amountSen:4500,...extra});
test('single receipt split 10+35 remains one 45 receipt',()=>{
  const pending=applyPaymentCommand(base(),receipt(),guard);
  assert.equal(paymentSummary(pending).unallocatedSen,4500);
  assert.ok(paymentSummary(pending).charges.every(c=>c.status==='unconfirmed'));
  const state=applyPaymentCommand(pending,cmd('allocate',{operationId:'op-2',reason:'Split receipt',allocations:[{chargeId:'original',amountSen:1000},{chargeId:'extension',amountSen:3500}]}),admin);
  const summary=paymentSummary(state);assert.equal(summary.receivedSen,4500);assert.equal(summary.allocatedSen,4500);assert.equal(summary.unallocatedSen,0);assert.ok(summary.charges.every(c=>c.status==='paid'));assert.equal(state.receipts.length,1);
});
test('multiple payments sum; overpayment is separate from outstanding',()=>{
  let state=createPaymentLedger([{id:'original',amountSen:3000}]);
  state=applyPaymentCommand(state,receipt({amountSen:2000,chargeId:'original'}),guard);
  assert.equal(paymentSummary(state).charges[0].status,'partial');
  state=applyPaymentCommand(state,receipt({operationId:'op-2',receiptId:'receipt-2',reference:'BANK-2',amountSen:1000,chargeId:'original'}),guard);
  assert.equal(paymentSummary(state).charges[0].status,'paid');
  state=applyPaymentCommand(state,receipt({operationId:'op-3',receiptId:'receipt-3',reference:'BANK-3',amountSen:3000,chargeId:'original'}),guard);
  assert.equal(paymentSummary(state).charges[0].overpaidSen,3000);
});
test('over-allocation rejected atomically including previously allocated funds',()=>{
  const state=applyPaymentCommand(base(),receipt({amountSen:2000,chargeId:'original'}),guard);
  const before=JSON.stringify(state);
  assert.throws(()=>applyPaymentCommand(state,cmd('allocate',{operationId:'op-2',reason:'test',allocations:[{chargeId:'extension',amountSen:1}]}),admin));
  assert.equal(JSON.stringify(state),before);
});
test('void restores all affected balances and preserves allocation history',()=>{
  let state=applyPaymentCommand(base(),receipt(),guard);
  state=applyPaymentCommand(state,cmd('allocate',{operationId:'op-2',reason:'split',allocations:[{chargeId:'original',amountSen:1000},{chargeId:'extension',amountSen:3500}]}),admin);
  state=applyPaymentCommand(state,cmd('void',{operationId:'op-3',reason:'Wrong receipt'}),admin);
  assert.equal(paymentSummary(state).receivedSen,0);assert.equal(state.receipts[0].allocations.length,2);
  assert.deepEqual(paymentSummary(state).charges.map(c=>c.balanceSen),[1000,3500]);assert.equal(state.events.length,3);
});
test('retries do not duplicate; conflicting retry and duplicate bank reference rejected',()=>{
  const action=receipt();const state=applyPaymentCommand(base(),action,guard);
  assert.deepEqual(applyPaymentCommand(state,action,guard),state);
  assert.throws(()=>applyPaymentCommand(state,{...action,amountSen:99},guard));
  assert.throws(()=>applyPaymentCommand(state,receipt({operationId:'op-2',receiptId:'receipt-2',reference:' bank-1 '}),guard));
});
test('admin-only actions, reason required and no mutation on failure',()=>{
  const state=applyPaymentCommand(base(),receipt(),guard);
  assert.throws(()=>applyPaymentCommand(state,cmd('void',{operationId:'op-2',reason:'wrong'}),guard));
  assert.throws(()=>applyPaymentCommand(state,cmd('void',{operationId:'op-2',reason:' '}),admin));
  assert.throws(()=>applyPaymentCommand(state,cmd('allocate',{operationId:'op-2',reason:'split',allocations:[{chargeId:'original',amountSen:10}]}),guard));
  assert.equal(state.receipts[0].state,'active');
});
test('invalid amounts, missing charges and duplicate IDs rejected',()=>{
  for(const amountSen of [-1,0,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>applyPaymentCommand(base(),receipt({amountSen}),guard));
  assert.throws(()=>applyPaymentCommand(base(),receipt({chargeId:'missing'}),guard));
  assert.throws(()=>createPaymentLedger([{id:'a',amountSen:0},{id:'a',amountSen:1}]));
  assert.equal(paymentSummary(createPaymentLedger([{id:'free',amountSen:0}])).charges[0].status,'no_charge');
});
test('RM parser uses exact sen and rejects exponent/extra precision',()=>{
  assert.equal(parseRinggit('20.10'),2010);assert.equal(parseRinggit('0.01'),1);
  for(const v of ['','-1','1e3','1.001','NaN'])assert.throws(()=>parseRinggit(v));
});
