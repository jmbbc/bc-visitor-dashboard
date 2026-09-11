import {analyseUnitCycles} from './parking-cycles.mjs';
import {datesInclusive, dailyRateSen, POLICY_VERSION} from './parking-policy.mjs';

export function quoteFromUnitState({unitId, category, state = null, start, end, lastAnyEnd = end}) {
  const unit=String(unitId || '').trim().toUpperCase();
  const requested=datesInclusive(start,end);
  if(!unit || ![1,2,3].includes(category)) throw new Error('Unit atau kategori tidak sah.');
  if(requested.length>30) throw new Error('Maksimum 30 hari bagi satu permohonan.');
  if(state?.legacyMissingUsage === true) return {status:'requires_review',reason:'legacy_history_not_migrated',totalSen:null};
  let priorDays=0, cycleStart=start;
  if(state) {
    if(state.unitId!==unit || !Number.isInteger(state.mainUsageDays) || state.mainUsageDays<0 || !state.lastAnyEnd) throw new Error('Ringkasan unit tidak sah.');
    if(state.category!==category) return {status:'requires_review',reason:'category_transition',totalSen:null};
    const nextFree=new Date(`${state.lastAnyEnd}T00:00:00Z`); nextFree.setUTCDate(nextFree.getUTCDate()+4);
    const nextFreeKey=nextFree.toISOString().slice(0,10);
    if(start<=state.lastAnyEnd) return {status:'requires_review',reason:'overlapping_or_out_of_order',totalSen:null};
    if(category!==3 && start<nextFreeKey){ priorDays=state.mainUsageDays; cycleStart=state.cycleStart; }
  }
  if(category!==3 && priorDays+requested.length>30) return {status:'requires_review',reason:'cycle_limit_exceeded',totalSen:null};
  const lines=requested.map((date,index)=>({date,day:priorDays+index+1,amountSen:dailyRateSen(category,priorDays+index+1,'main')}));
  const anyEnd=lastAnyEnd<end?end:lastAnyEnd;
  return {status:'quoted',policyVersion:POLICY_VERSION,unitId:unit,lines,totalSen:lines.reduce((sum,line)=>sum+line.amountSen,0),
    nextState:{unitId:unit,category,cycleStart,mainUsageDays:priorDays+requested.length,lastMainEnd:end,lastAnyEnd:anyEnd,policyVersion:POLICY_VERSION}};
}

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
