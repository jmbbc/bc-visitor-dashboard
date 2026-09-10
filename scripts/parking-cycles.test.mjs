import test from 'node:test';
import assert from 'node:assert/strict';
import {analyseUnitCycles} from '../js/parking-cycles.mjs';
const row=(id,vehicleId,role,start,end,extras={})=>({id,unitId:'A-01',vehicleId,role,start,end,cat:1,state:'registered',...extras});
const main=(id,start,end,extra={})=>row(id,'car-a','main',start,end,extra);
const analyse=allocations=>analyseUnitCycles({unitId:'A-01',cat:1,allocations});
test('separate registrations share main days and overlap is billed once',()=>{
  const r=analyse([main('r1','2026-09-01','2026-09-03'),main('r2','2026-09-03','2026-09-05')]);
  assert.equal(r.status,'calculated_offline');assert.equal(r.cycles.length,1);
  assert.equal(r.cycles[0].mainUsageDays,5);assert.equal(r.cycles[0].totalSen,1000);
  assert.deepEqual(r.cycles[0].ledger[2].sourceIds,['r1','r2']);
});
test('additional-only days delay cooldown but do not consume main days',()=>{
  const r=analyse([main('r1','2026-09-01','2026-09-03'),row('r2','car-b','additional','2026-09-01','2026-09-06'),main('r3','2026-09-07','2026-09-07')]);
  const c=r.cycles[0];assert.equal(r.status,'calculated_offline');assert.equal(c.mainUsageDays,4);
  assert.equal(c.remainingMainDays,26);assert.equal(c.totalSen,6500);assert.equal(c.nextEligibleDate,'2026-09-11');
  assert.equal(c.ledger.find(l=>l.date==='2026-09-07').candidateAmountSen,500);
});
test('three full empty days reset cycle, shorter gaps preserve free balance',()=>{
  const r=analyse([main('r1','2026-09-01','2026-09-01'),main('r2','2026-09-03','2026-09-03'),main('r3','2026-09-07','2026-09-07')]);
  assert.equal(r.cycles.length,2);assert.equal(r.cycles[0].remainingFreeDays,1);assert.equal(r.cycles[1].remainingFreeDays,2);
});
test('additional renewals beyond main cap are permitted, main renewal is not',()=>{
  const rows=[main('m','2026-09-01','2026-09-30'),row('a','car-b','additional','2026-09-01','2026-09-30'),row('b','car-b','additional','2026-10-01','2026-10-30')];
  assert.equal(analyse(rows).status,'calculated_offline');
  assert.equal(analyse(rows).cycles[0].remainingMainDays,0);
  const r=analyse([...rows,main('m2','2026-10-01','2026-10-01')]);
  assert.equal(r.status,'requires_review');assert.equal(r.cycles[0].totalSen,null);
});
test('verified cancellation excluded, input order stable and input immutable',()=>{
  const rows=[main('a','2026-09-01','2026-09-01'),main('b','2026-09-02','2026-09-04',{state:'cancelled_before_entry'}),main('c','2026-09-05','2026-09-05')];
  const snapshot=JSON.stringify(rows);assert.deepEqual(analyse(rows),analyse([...rows].reverse()));
  assert.equal(analyse(rows).cycles.length,2);assert.equal(JSON.stringify(rows),snapshot);
});
test('role conflicts, different main cars and category transitions require review',()=>{
  for(const extra of [row('b','car-b','main','2026-09-02','2026-09-03'),row('b','car-a','additional','2026-09-02','2026-09-03'),main('b','2026-09-04','2026-09-04',{cat:2})]){
    const r=analyse([main('a','2026-09-01','2026-09-03'),extra]);
    assert.equal(r.status,'requires_review');assert.equal(r.cycles[0].totalSen,null);
    assert.ok(r.cycles[0].ledger.every(l=>l.candidateAmountSen===null));
  }
});
test('category 3 continuous renewals have no cumulative cap; gaps need review',()=>{
  const rows=[main('a','2026-09-01','2026-09-30',{cat:3}),main('b','2026-10-01','2026-10-30',{cat:3})];
  const r=analyseUnitCycles({unitId:'A-01',cat:3,allocations:rows});
  assert.equal(r.status,'calculated_offline');assert.equal(r.cycles[0].totalSen,90000);assert.equal(r.cycles[0].remainingMainDays,null);
  assert.equal(analyseUnitCycles({unitId:'A-01',cat:3,allocations:[rows[0],main('c','2026-10-04','2026-10-04',{cat:3})]}).status,'requires_review');
});
test('invalid history is rejected, empty history is harmless',()=>{
  assert.equal(analyse([]).cycles.length,0);
  const a=main('a','2026-09-01','2026-09-01');
  assert.throws(()=>analyse([a,a]));assert.throws(()=>analyse([{...a,unitId:'B'}]));
  assert.throws(()=>analyse([{...a,state:'cancelled'}]));
  assert.throws(()=>analyse([main('a','2026-09-01','2026-10-01')]));
});
