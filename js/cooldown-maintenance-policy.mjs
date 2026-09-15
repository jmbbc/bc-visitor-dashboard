const DAY=86400000;
export function categoryFromUnit(data){
  const amount=Number(data?.arrearsAmount);
  if(Number.isFinite(amount))return amount<=1?1:amount<=400?2:3;
  const category=Number(data?.category);
  return [1,2,3].includes(category)?category:null;
}
export function addDays(dateKey,days){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey||'')))return null;
  const time=Date.parse(`${dateKey}T00:00:00Z`);
  if(!Number.isFinite(time))return null;
  return new Date(time+days*DAY).toISOString().slice(0,10);
}
export function cooldownResetEligibility({category,mainUsageDays,lastAnyEnd,today}){
  const days=Number(mainUsageDays),nextEligible=addDays(lastAnyEnd,4);
  if(![1,2].includes(category))return {eligible:false,reason:category===3?'category_3':'category_unknown',nextEligible};
  if(!Number.isInteger(days)||days<0||!nextEligible)return {eligible:false,reason:'incomplete',nextEligible};
  if(days===0)return {eligible:false,reason:'already_reset',nextEligible};
  if(today<nextEligible)return {eligible:false,reason:'cooldown_active',nextEligible};
  return {eligible:true,reason:'cooldown_complete',nextEligible};
}
