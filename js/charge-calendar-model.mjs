import {explainParkingCharge,malaysiaDate} from './charge-explanation-model.mjs?v=20261013-2';
import {datesInclusive} from './parking-policy.mjs';
export function calendarForUnit(records, month) {
  if(!/^\d{4}-\d{2}$/.test(month)||Number(month.slice(5))<1||Number(month.slice(5))>12)throw Error('Pilih bulan yang sah.');
  const [year,m]=month.split('-').map(Number),first=month+'-01',last=month+'-'+new Date(Date.UTC(year,m,0)).getUTCDate();
  const days=new Map(),seen=new Set();let registrations=0;
  for(const record of records){
    if(seen.has(record.id)||(record.status==='Cancelled Before Entry'&&!record.parkingUnused))continue;seen.add(record.id);
    if(record.category!=='Pelawat'||String(record.stayOver||'').toLowerCase()!=='yes')continue;
    const start=malaysiaDate(record.eta),end=malaysiaDate(record.etd||record.eta);
    if(!start||!end||end<first||start>last||end<start)continue;
    if(!record.parkingUnused)registrations++;
    const explanation=explainParkingCharge(record,null),lines=new Map(explanation.days.map(d=>[d[0],d]));
    const extra=Array.isArray(record.vehicleNumbers)&&record.vehicleNumbers.filter(Boolean).length>1;
    for(const date of datesInclusive(start<first?first:start,end>last?last:end)){
      const line=lines.get(date);const entry={id:record.id,record,unused:record.parkingUnused===true,explanation,day:line?.[1]||'Belum disahkan',amount:line?.[3]??null,additionalUnverified:extra,plate:explanation.plate,reason:line?line[2]:explanation.reason};
      if(!days.has(date))days.set(date,[]);days.get(date).push(entry);
    }
  }
  const all=Array.from(days.values()).flat(),totals=all.filter(e=>!e.unused);
  return {days,registrations,unusedRegistrations:new Set(all.filter(e=>e.unused).map(e=>e.id)).size,activeDays:Array.from(days.values()).filter(entries=>entries.some(e=>!e.unused)).length,totalKnown:totals.reduce((n,e)=>n+(e.amount??0),0),unknown:totals.some(e=>e.amount===null||e.additionalUnverified)};
}