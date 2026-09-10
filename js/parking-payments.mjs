// Offline ledger prototype. No network/storage. Actor roles must eventually
// come from verified authorization, never a form field in production.
function required(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Maklumat wajib tidak lengkap.');
  return value.trim();
}
function sen(value, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) throw new Error('Amaun sen tidak sah.');
  return value;
}
function total(values) { return values.reduce((sum, value) => sen(sum + sen(value)), 0); }
export function parseRinggit(value) {
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error('Masukkan amaun RM dengan maksimum 2 tempat perpuluhan.');
  const [whole, fraction = ''] = value.trim().split('.');
  return sen(Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
}
export function createPaymentLedger(charges) {
  if (!Array.isArray(charges)) throw new Error('Senarai caj tidak sah.');
  const ids = new Set();
  return {charges:charges.map(c => {
    const id=required(c.id); if(ids.has(id))throw new Error('Rujukan caj berulang.');ids.add(id);
    return {id, amountSen:sen(c.amountSen), originalAmountSen:sen(c.amountSen), adjustments:[]};
  }), receipts:[], events:[]};
}
export function paymentSummary(ledger) {
  const active=ledger.receipts.filter(r=>r.state==='active');
  const allocatedSen=total(active.flatMap(r=>r.allocations.map(a=>a.amountSen)));
  const receivedSen=total(active.map(r=>r.amountSen));
  return {receivedSen,allocatedSen,unallocatedSen:receivedSen-allocatedSen,
    charges:ledger.charges.map(c=>{
      const paidSen=total(active.flatMap(r=>r.allocations.filter(a=>a.chargeId===c.id).map(a=>a.amountSen)));
      return {...c,paidSen,balanceSen:Math.max(c.amountSen-paidSen,0),overpaidSen:Math.max(paidSen-c.amountSen,0),
        status:paidSen>c.amountSen?'overpaid':c.amountSen===0?'no_charge':paidSen===c.amountSen?'paid':paidSen>0?'partial':'unconfirmed'};
    })};
}
// Idempotency is exact command replay. Changed payload with the same operation
// key is rejected; bank-reference checking is a separate safeguard.
export function applyPaymentCommand(ledger, command, actor) {
  required(actor?.id);
  if(!['guard','admin'].includes(actor.role))throw new Error('Peranan tidak dibenarkan.');
  const operationId=required(command.operationId);
  const fingerprint=JSON.stringify({actor:{id:actor.id,role:actor.role},command});
  const existing=ledger.events.find(e=>e.operationId===operationId);
  if(existing){if(existing.fingerprint!==fingerprint)throw new Error('Rujukan operasi digunakan dengan maklumat berbeza.');return structuredClone(ledger);}
  const next=structuredClone(ledger);
  const chargeExists=id=>next.charges.some(c=>c.id===id);
  if(command.type==='record'){
    const id=required(command.receiptId),reference=required(command.reference).toUpperCase();
    if(next.receipts.some(r=>r.id===id))throw new Error('ID transaksi telah digunakan.');
    if(next.receipts.some(r=>r.reference===reference&&r.state==='active'))throw new Error('Rujukan transaksi sudah direkodkan; perlu semakan pendua.');
    const amountSen=sen(command.amountSen,true);
    if(command.chargeId!=null&&!chargeExists(command.chargeId))throw new Error('Pendaftaran tidak dijumpai.');
    next.receipts.push({id,reference,amountSen,state:'active',recordedBy:actor.id,
      recordedAt:required(command.at),allocations:command.chargeId==null?[]:[{chargeId:command.chargeId,amountSen}],void:null});
  }else if(command.type==='allocate'){
    if(actor.role!=='admin')throw new Error('Pembahagian hanya oleh admin.');
    const r=next.receipts.find(r=>r.id===command.receiptId);
    if(!r||r.state!=='active')throw new Error('Transaksi tidak aktif.');
    required(command.reason);
    if(!Array.isArray(command.allocations)||!command.allocations.length)throw new Error('Isi pembahagian bayaran.');
    const allocations=command.allocations.map(a=>{if(!chargeExists(a.chargeId))throw new Error('Pendaftaran tidak dijumpai.');return {chargeId:a.chargeId,amountSen:sen(a.amountSen,true)};});
    if(total([...r.allocations,...allocations].map(a=>a.amountSen))>r.amountSen)throw new Error('Jumlah pembahagian melebihi amaun transaksi.');
    r.allocations.push(...allocations);
  }else if(command.type==='adjust_charge'){
    if(actor.role!=='admin')throw new Error('Pelarasan caj hanya oleh admin.');
    const charge=next.charges.find(c=>c.id===command.chargeId);
    if(!charge)throw new Error('Pendaftaran tidak dijumpai.');
    const reason=required(command.reason),amountSen=sen(command.amountSen);
    if(command.expectedAmountSen!==charge.amountSen)throw new Error('Caj telah berubah; semak semula sebelum pelarasan.');
    charge.adjustments.push({fromSen:charge.amountSen,toSen:amountSen,reason,by:actor.id,at:required(command.at),operationId});
    charge.amountSen=amountSen;
  }else if(command.type==='void'){
    if(actor.role!=='admin')throw new Error('Pembatalan hanya oleh admin.');
    const r=next.receipts.find(r=>r.id===command.receiptId);
    if(!r||r.state!=='active')throw new Error('Transaksi tidak aktif.');
    r.state='voided';r.void={reason:required(command.reason),by:actor.id,at:required(command.at)};
  }else throw new Error('Tindakan tidak disokong.');
  next.events.push({operationId,fingerprint,type:command.type,actorId:actor.id,at:required(command.at),reason:command.reason?.trim()??'',receiptId:command.receiptId,chargeId:command.chargeId});
  paymentSummary(next); // reject arithmetic overflow before returning a new state
  return next;
}
