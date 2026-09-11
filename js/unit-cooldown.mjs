import {analyseUnitCycles} from './parking-cycles.mjs';
import {datesInclusive} from './parking-policy.mjs';

// Only call with complete, trusted unit history from an authorized data source.
// Does not read public responses, change past registrations or amend past charges.
export function quoteUnitContinuation({unitId, category, history, application}) {
  const unit=String(unitId || '').trim().toUpperCase();
  if(!unit || !Array.isArray(history) || !application) throw new Error('Sejarah unit diperlukan.');
  const normalize=row=>({...row,unitId:String(row.unitId || '').trim().toUpperCase()});
  const prior=history.map(normalize);
  const request=normalize(application);
  if(request.unitId!==unit || prior.some(row=>row.unitId!==unit)) throw new Error('Sejarah bukan milik unit ini.');
  if(prior.some(row=>row.id===request.id)) throw new Error('ID permohonan sudah digunakan.');
  const requestedDates=datesInclusive(request.start,request.end);
  if(prior.some(row=>row.state!=='cancelled_before_entry' && row.start>request.start)) {
    return {status:'requires_review',reason:'future_registration',totalSen:null};
  }
  const analysis=analyseUnitCycles({unitId:unit,cat:category,allocations:[...prior,request]});
  if(analysis.status==='requires_review') return {status:'requires_review',issues:analysis.issues,totalSen:null};
  const cycle=analysis.cycles.find(c=>c.ledger.some(line=>line.sourceIds.includes(request.id)));
  if(!cycle) throw new Error('Permohonan tidak aktif.');
  const lines=cycle.ledger.filter(line=>line.sourceIds.includes(request.id)).map(line=>({
    date:line.date,day:line.mainUsageDay,
    alreadyRegistered:line.sourceIds.some(id=>id!==request.id),
    amountSen:line.sourceIds.some(id=>id!==request.id)?0:line.candidateAmountSen
  }));
  if(lines.length!==requestedDates.length) throw new Error('Julat permohonan tidak lengkap.');
  return {status:'quoted',unitId:unit,lines,totalSen:lines.reduce((sum,line)=>sum+line.amountSen,0),
    cycleStart:cycle.start,nextFreeDate:cycle.nextEligibleDate,
    mainUsageDays:cycle.mainUsageDays,preserveExistingCharges:true};
}
