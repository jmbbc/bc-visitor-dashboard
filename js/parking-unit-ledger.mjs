import {parkingVehicleClass,isParkingExempt} from './parking-vehicle-type.mjs?v=20261015-type-1';
import {datesInclusive,dailyRateSen,POLICY_VERSION,arrearsCategory} from './parking-policy.mjs';
import {quoteFromUnitState} from './unit-cooldown.mjs';
import {malaysiaDate} from './charge-explanation-model.mjs';
export const LEDGER_VERSION='unit-vehicle-days-1';
export const normalizePlate=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export function snapshotCategory(r){const n=Number(String(r.unitCategory||'').match(/^(?:Kategori\s*)?([123])$/i)?.[1]);return [1,2,3].includes(n)?n:typeof r.unitArrearsAmount==='number'&&Number.isFinite(r.unitArrearsAmount)?arrearsCategory(r.unitArrearsAmount):null;}
const millis=value=>value?.toMillis?value.toMillis():value?.toDate?value.toDate().getTime():Date.parse(value)||0;
export function registrationVehicles(r){
 if(isParkingExempt(r))return [];
 if(r.category==='Homestay')return (r.vehicleRowsDetailed||[]).filter(v=>v.parkingType==='visitor').map((v,index)=>({plate:normalizePlate(v.plate),index,start:v.startDate||malaysiaDate(r.eta),end:v.endDate||malaysiaDate(r.etd||r.eta)}));
 const start=malaysiaDate(r.eta),end=malaysiaDate(r.etd||r.eta),rows=Array.isArray(r.vehicleRowsDetailed)?r.vehicleRowsDetailed:[];
 const raw=[...(Array.isArray(r.vehicleNumbers)?r.vehicleNumbers:[]),r.vehicleNo,...rows.map(x=>x.plate)].map(normalizePlate).filter(Boolean);
 return [...new Set(raw)].map((plate,index)=>{const row=rows.find(x=>normalizePlate(x.plate)===plate);return {plate,index,start:row?.startDate||start,end:row?.endDate||end};});
}
const active=r=>r.category==='Pelawat'&&String(r.stayOver).toLowerCase()==='yes'&&!r.parkingUnused&&r.status!=='Cancelled Before Entry'&&!isParkingExempt(r);
export function buildUnitParkingLedger(records,{unit,from,excludedId=null}={}){
 if(!unit||records.some(r=>r.hostUnit!==unit))throw Error('Sejarah bukan milik unit ini.');
 const seen=new Set();for(const r of records){if(!r.id||seen.has(r.id))throw Error('ID pendaftaran berulang.');seen.add(r.id);}
 const history=records.filter(r=>r.category==='Pelawat'&&String(r.stayOver).toLowerCase()==='yes').sort((a,b)=>malaysiaDate(a.eta).localeCompare(malaysiaDate(b.eta))||a.id.localeCompare(b.id));
 let anchor=0,previousEnd='';
 for(let i=0;i<history.length;i++){const r=history[i],start=malaysiaDate(r.eta),vehicles=registrationVehicles(r);const end=isParkingExempt(r)?'':vehicles.reduce((x,v)=>v.end>x?v.end:x,malaysiaDate(r.etd||r.eta));
  const explicitReset=r.parkingPriorState?.exists===true&&r.parkingPriorState.mainUsageDays===0&&(snapshotCategory(r)===1?[1,2,3].includes(r.parkingPriorState.category):snapshotCategory(r)===2&&[1,2].includes(r.parkingPriorState.category));
  if(i>0&&active(r)&&r.id!==excludedId&&(!from||start<=from)&&[1,2].includes(snapshotCategory(r))&&((Date.parse(start)-Date.parse(previousEnd))/86400000>=4||(explicitReset&&start>previousEnd)))anchor=i;
  if(i>0&&active(r)&&explicitReset&&start<=previousEnd)throw Error('Kitaran memerlukan semakan: reset bayaran bertindih');
  if(end>previousEnd)previousEnd=end;
 }
 const origin=history[anchor],selected=history.slice(anchor).filter(r=>active(r)&&r.id!==excludedId),first=origin,prior=origin?.parkingPriorState;let state=null;
 if(!anchor&&prior?.exists===true)state={unitId:unit,category:prior.category,mainUsageDays:prior.mainUsageDays,cycleStart:malaysiaDate(prior.cycleStart),lastMainEnd:malaysiaDate(prior.lastMainEnd),lastAnyEnd:malaysiaDate(prior.lastAnyEnd)};
 else if(!anchor&&first&&prior?.exists!==false&&first.parkingQuote?.mainStartDay>1)throw Error('Snapshot awal kitaran tidak lengkap.');
 const dates=new Map(),plans=new Map();
 for(const r of selected){if(parkingVehicleClass(r)==='unknown')throw Error('Jenis kenderaan tidak lengkap: '+r.id);const cat=snapshotCategory(r);if(!cat)throw Error('Kategori asal tidak lengkap: '+r.id);const vehicles=registrationVehicles(r);if(!vehicles.length)throw Error('Nombor kenderaan tidak lengkap: '+r.id);
  plans.set(r.id,{record:r,lines:[],totalSen:0});
  for(const vehicle of vehicles){const range=datesInclusive(vehicle.start,vehicle.end);if(range.length>30)throw Error('Tempoh kenderaan melebihi 30 hari.');for(const date of range){if(!dates.has(date))dates.set(date,[]);dates.get(date).push({id:r.id,cat,plate:vehicle.plate,index:vehicle.index,created:millis(r.createdAt)});}}
 }
 const daily=[];
 for(const [date,allocations]of [...dates].sort(([a],[b])=>a.localeCompare(b))){
  allocations.sort((a,b)=>a.created-b.created||a.id.localeCompare(b.id)||a.index-b.index||a.plate.localeCompare(b.plate));
  const vehicles=new Map();for(const a of allocations){if(!vehicles.has(a.plate))vehicles.set(a.plate,[]);vehicles.get(a.plate).push(a);}
  const main=[...vehicles.values()][0][0],before=state,q=quoteFromUnitState({unitId:unit,category:main.cat,state,start:date,end:date});
  if(q.status!=='quoted')throw Error('Kitaran memerlukan semakan: '+q.reason);state=q.nextState;const day=q.lines[0].day;
  let index=0;for(const [plate,sources]of vehicles){const owner=sources[0],role=index++===0?'main':'additional',amountSen=role==='main'?q.totalSen:dailyRateSen(owner.cat,1,'additional');
   const entry={date,plate,role,day,category:owner.cat,amountSen,ownerId:owner.id,sourceIds:sources.map(x=>x.id)};daily.push(entry);
   for(const source of sources){const p=plans.get(source.id);p.lines.push({date,plate,role,day,category:owner.cat,amountSen:source.id===owner.id?amountSen:0,ownerId:owner.id,shared:source.id!==owner.id});if(source.id===owner.id)p.totalSen+=amountSen;if(!('priorState' in p))p.priorState=before;}
  }
 }
 for(const p of plans.values()){if(p.lines.length>90)throw Error('Pecahan melebihi had automatik.');p.quote={policyVersion:POLICY_VERSION,mainTotalSen:p.totalSen,mainStartDay:Math.min(...p.lines.map(l=>l.day)),mainEndDay:Math.max(...p.lines.map(l=>l.day))};}
 const latest=selected.slice().sort((a,b)=>malaysiaDate(b.etd||b.eta).localeCompare(malaysiaDate(a.etd||a.eta))||a.id.localeCompare(b.id))[0]||null;
 const exempt=history.slice(anchor).filter(r=>r.id!==excludedId&&isParkingExempt(r)&&!r.parkingUnused&&r.status!=='Cancelled Before Entry').map(record=>({record,exempt:true,lines:[],totalSen:0,priorState:null,quote:{policyVersion:POLICY_VERSION,mainTotalSen:0,mainStartDay:1,mainEndDay:datesInclusive(malaysiaDate(record.eta),malaysiaDate(record.etd||record.eta)).length}}));
 return {version:LEDGER_VERSION,plans:[...plans.values(),...exempt],daily,state,latest};
}
