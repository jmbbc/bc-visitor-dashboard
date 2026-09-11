const DAY_MS=86400000;
const dayNumber=value=>{
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||''));
  if(!match)return null;
  return Math.floor(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]))/DAY_MS);
};
const later=(a,b)=>dayNumber(a)>=dayNumber(b)?a:b;

export function reconcileReviewWithLock(candidate,lock){
  const result={...candidate,changed:false};
  if(!lock||lock.stayOver!=='Yes')return result;
  const start=dayNumber(lock.startDate),end=dayNumber(lock.endDate),oldAny=dayNumber(candidate.lastAnyEnd),oldMain=dayNumber(candidate.lastMainEnd);
  if([start,end,oldAny,oldMain].some(value=>value===null)||end<start)return result;
  const currentAny=lock.lastAnyEnd&&dayNumber(lock.lastAnyEnd)!==null?later(lock.lastAnyEnd,lock.endDate):lock.endDate;
  if(dayNumber(currentAny)<=oldAny)return result;
  if(start>=oldAny+4){
    return {...result,cycleStart:lock.startDate,mainUsageDays:end-start+1,lastMainEnd:lock.endDate,lastAnyEnd:currentAny,changed:true,reason:'new_cycle'};
  }
  const firstNew=Math.max(start,oldMain+1);
  const added=Math.max(0,end-firstNew+1);
  return {...result,mainUsageDays:Number(candidate.mainUsageDays||0)+added,lastMainEnd:later(candidate.lastMainEnd,lock.endDate),lastAnyEnd:later(candidate.lastAnyEnd,currentAny),changed:true,reason:'continued_cycle'};
}
