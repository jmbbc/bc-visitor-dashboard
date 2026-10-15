import {quoteFromUnitState} from './unit-cooldown.mjs';
import {malaysiaDate} from './charge-explanation-model.mjs';
const cat=r=>{const n=Number(String(r.unitCategory||'').match(/^(?:Kategori\s*)?([123])$/i)?.[1]);return [1,2,3].includes(n)?n:typeof r.unitArrearsAmount==='number'&&Number.isFinite(r.unitArrearsAmount)?r.unitArrearsAmount<=1?1:r.unitArrearsAmount<=400?2:3:null};
export function planUnusedParking(records,targetId){
 const target=records.find(r=>r.id===targetId);if(!target)throw Error('Rekod tidak ditemui.');
 if(target.category!=='Pelawat'||String(target.stayOver).toLowerCase()!=='yes')throw Error('Tindakan ini hanya untuk parkir bermalam.');
 if(!['Pending','Pending Payment','Approved'].includes(target.status))throw Error('Rekod sudah masuk, keluar atau dibatalkan; perlu semakan berasingan.');
 const active=records.filter(r=>r.category==='Pelawat'&&String(r.stayOver).toLowerCase()==='yes'&&!r.parkingUnused&&r.status!=='Cancelled Before Entry').sort((a,b)=>malaysiaDate(a.eta).localeCompare(malaysiaDate(b.eta))||String(a.id).localeCompare(String(b.id)));
 const first=active[0];let state=null;const prior=first?.parkingPriorState;
 if(prior?.exists===true)state={unitId:target.hostUnit,category:prior.category,mainUsageDays:prior.mainUsageDays,cycleStart:malaysiaDate(prior.cycleStart),lastMainEnd:malaysiaDate(prior.lastMainEnd),lastAnyEnd:malaysiaDate(prior.lastAnyEnd)};
 else if(first&&prior?.exists!==false&&first.parkingQuote?.mainStartDay!==1)return {complete:false,affected:active.filter(r=>malaysiaDate(r.eta)>=malaysiaDate(target.eta)&&r.id!==targetId).map(r=>r.id),reason:'Sejarah awal atau snapshot kitaran tidak lengkap.'};
 const affected=[];let latest=null;
 for(const r of active){if(r.id===targetId)continue;const category=cat(r);if(!category)return {complete:false,affected:active.filter(x=>x.id!==targetId&&malaysiaDate(x.eta)>=malaysiaDate(target.eta)).map(x=>x.id),reason:'Kategori snapshot tidak lengkap.'};
  const start=malaysiaDate(r.eta),end=malaysiaDate(r.etd||r.eta);const lastAnyEnd=(r.vehicleRowsDetailed||[]).reduce((v,row)=>row.endDate>v?row.endDate:v,end);
  let q;try{q=quoteFromUnitState({unitId:target.hostUnit,category,state,start,end,lastAnyEnd})}catch{return {complete:false,affected:active.filter(x=>x.id!==targetId&&malaysiaDate(x.eta)>=malaysiaDate(target.eta)).map(x=>x.id),reason:'Tarikh atau kitaran tidak lengkap.'}};
  if(q.status!=='quoted')return {complete:false,affected:active.filter(x=>x.id!==targetId&&malaysiaDate(x.eta)>=malaysiaDate(target.eta)).map(x=>x.id),reason:'Sejarah bertindih atau memerlukan semakan kategori.'};
  if(malaysiaDate(r.eta)>=malaysiaDate(target.eta)&&(q.totalSen!==r.parkingQuote?.mainTotalSen||q.lines[0].day!==r.parkingQuote?.mainStartDay))affected.push(r.id);
  state=q.nextState;latest=r;
 }
 return {complete:true,state,latest,affected};
}