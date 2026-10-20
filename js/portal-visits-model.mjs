export function malaysiaVisitPeriod(value=new Date()){
 const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))throw Error('Tarikh tidak sah.');
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(date).map(p=>[p.type,p.value]));
 return {year:Number(parts.year),month:Number(parts.month),day:Number(parts.day)};
}
export function nextPortalVisit(previous,period){
 const sameYear=previous?.year===period.year,sameMonth=sameYear&&previous.month===period.month,sameDay=sameMonth&&previous.day===period.day;
 for(const key of ['yearVisits','monthVisits','dayVisits'])if(previous&&(!Number.isSafeInteger(previous[key])||previous[key]<1))throw Error('Rekod counter perlu semakan.');
 return {...period,yearVisits:sameYear?previous.yearVisits+1:1,monthVisits:sameMonth?previous.monthVisits+1:1,dayVisits:sameDay?previous.dayVisits+1:1};
}
export async function recordPortalVisit({sdk,db,now=()=>new Date()}){
 const ref=sdk.doc(db,'portalStats','home');
 for(let attempt=0;attempt<3;attempt++){
  let rollover=false;
  try{return await sdk.runTransaction(db,async transaction=>{
   const snapshot=await transaction.get(ref),previous=snapshot.exists()?snapshot.data():null,next=nextPortalVisit(previous,malaysiaVisitPeriod(now()));
   const sameYear=previous?.year===next.year,sameMonth=sameYear&&previous.month===next.month,sameDay=sameMonth&&previous.day===next.day;rollover=!sameDay;
   const write={...next};for(const [key,same]of [['yearVisits',sameYear],['monthVisits',sameMonth],['dayVisits',sameDay]])if(same)write[key]=sdk.increment(1);
   const payload={...write,startedAt:previous?previous.startedAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()};
   if(previous)transaction.update(ref,payload);else transaction.set(ref,payload);return next;
  });}catch(error){if(!rollover||error.code!=='permission-denied'||attempt===2)throw error;}
 }
}
