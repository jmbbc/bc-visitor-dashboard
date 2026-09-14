import {datesInclusive, dailyRateSen, nextFreeDate, POLICY_VERSION} from './parking-policy.mjs';

// Offline analyser of COMPLETE, trusted, same-category history for ONE unit.
// This is not a write/approval API. Roles and canonical vehicle IDs must be
// established by a trusted adapter; untrusted form choices are not authority.
export function analyseUnitCycles({unitId, cat, allocations}) {
  if (typeof unitId !== 'string' || !unitId.trim() || ![1,2,3].includes(cat) || !Array.isArray(allocations)) throw new Error('Invalid unit history');
  const issues = [], ids = new Set(), active = [];
  for (const a of allocations) {
    if (!a || typeof a.id !== 'string' || !a.id || ids.has(a.id)) throw new Error('Duplicate or missing allocation ID');
    ids.add(a.id);
    if (a.unitId !== unitId || typeof a.vehicleId !== 'string' || !a.vehicleId || !['main','additional'].includes(a.role) || ![1,2,3].includes(a.cat)) throw new Error('Invalid allocation identity');
    if (!['registered','cancelled_before_entry'].includes(a.state)) throw new Error('Unverified allocation state');
    const dates = datesInclusive(a.start,a.end);
    if (dates.length > 30) throw new Error('Maximum 30 days per allocation');
    // Cancellation state must already be verified by the trusted adapter.
    if (a.state === 'cancelled_before_entry') continue;
    if(a.cat !== cat) issues.push({code:'category_transition_requires_review',allocationId:a.id});
    active.push({...a,dates});
  }
  active.sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  const groups=[];
  for(const a of active){
    const last=groups[groups.length-1];
    if(!last){groups.push({start:a.start,end:a.end,rows:[a]});continue;}
    const next=nextFreeDate([{start:last.start,end:last.end}]);
    if(a.start >= next){
      if(cat===3) issues.push({code:'category3_gap_requires_review',allocationId:a.id});
      groups.push({start:a.start,end:a.end,rows:[a]});
    }else {last.rows.push(a); if(a.end>last.end)last.end=a.end;}
  }
  const cycles=groups.map((g,index)=>{
    const mainIds=new Set(g.rows.filter(a=>a.role==='main').map(a=>a.vehicleId));
    // Main entitlement belongs to the unit's slot, not a permanent plate.
    // Different plates on non-overlapping days continue the same unit cycle.
    if(!mainIds.size) issues.push({code:'missing_main_history',cycleIndex:index});
    const days=new Map();
    for(const a of g.rows) for(const date of a.dates){
      if(!days.has(date)) days.set(date,new Map());
      const vehicles=days.get(date), previous=vehicles.get(a.vehicleId);
      if(previous && previous.role!==a.role) issues.push({code:'conflicting_vehicle_role',allocationId:a.id,date});
      if(previous)previous.sourceIds.push(a.id);
      else vehicles.set(a.vehicleId,{vehicleId:a.vehicleId,role:a.role,sourceIds:[a.id]});
    }
    let mainDays=0;
    const ledger=[];
    for(const [date,vehicles] of [...days].sort(([a],[b])=>a.localeCompare(b))){
      const entries=[...vehicles.values()];
      if(entries.filter(v=>v.role==='main').length>1) issues.push({code:'overlapping_main_vehicles',cycleIndex:index,date});
      if(entries.some(v=>v.role==='main'))mainDays++;
      for(const v of entries) ledger.push({date,...v,mainUsageDay:v.role==='main'?mainDays:null,
        candidateAmountSen:dailyRateSen(cat,v.role==='main'?mainDays:1,v.role)});
    }
    if(cat!==3 && mainDays>30)issues.push({code:'main_cycle_limit_exceeded',cycleIndex:index});
    return {cycleIndex:index,start:g.start,lastRegisteredEnd:g.end,
      nextEligibleDate:cat===3?null:nextFreeDate([{start:g.start,end:g.end}]),
      mainUsageDays:mainDays,remainingMainDays:cat===3?null:Math.max(0,30-mainDays),
      remainingFreeDays:Math.max(0,({1:3,2:1,3:0}[cat])-mainDays),
      ledger,totalSen:ledger.reduce((sum,row)=>sum+row.candidateAmountSen,0)};
  });
  // Fail closed: do not expose apparently approved prices/eligibility for a
  // mixed-category, conflicting-role or otherwise unresolved unit history.
  if(issues.length)for(const c of cycles){
    c.totalSen=null;c.remainingMainDays=null;c.remainingFreeDays=null;c.nextEligibleDate=null;
    for(const row of c.ledger)row.candidateAmountSen=null;
  }
  return {policyVersion:POLICY_VERSION,unitId,status:issues.length?'requires_review':'calculated_offline',issues,cycles};
}
