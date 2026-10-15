import {datesInclusive, dailyRateSen, arrearsCategory, POLICY_VERSION} from './parking-policy.mjs';
export function malaysiaDate(value) {
  if (!value) return '';
  const date=value?.toDate?value.toDate():new Date(value);
  if(!Number.isFinite(date.getTime())) return '';
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=t=>parts.find(p=>p.type===t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function explainParkingCharge(record, charge) {
  const quote=record.parkingQuote || {};
  const labelledCategory=Number(String(record.unitCategory || '').match(/^(?:Kategori\s*)?([123])$/i)?.[1]);
  const cat=[1,2,3].includes(labelledCategory)?labelledCategory:
    (typeof record.unitArrearsAmount==='number' && Number.isFinite(record.unitArrearsAmount)?arrearsCategory(record.unitArrearsAmount):null);
  const valid=n=>Number.isSafeInteger(n)&&n>=0;
  const quoted=valid(quote.mainTotalSen)?quote.mainTotalSen:null;
  const amount=charge&&valid(charge.amountSen)?charge.amountSen:(!record.parkingReviewRequired&&quoted===0?0:null);
  const paid=charge&&valid(charge.paidSen)?charge.paidSen:(amount===0?0:null);
  const base={id:record.id,unit:record.hostUnit,plate:(Array.isArray(record.vehicleNumbers)?record.vehicleNumbers:[record.vehicleNo]).filter(Boolean).join(', ')||'Tiada nombor',category:cat?`Kategori ${cat} (snapshot asal)`:'Kategori belum disahkan',from:malaysiaDate(record.eta),to:malaysiaDate(record.etd||record.eta),paid:paid==null?null:paid/100,total:amount==null?null:amount/100,days:[],reason:'Snapshot kiraan tidak lengkap. Pecahan harian perlu semakan; amaun rasmi tidak diubah.'};
  if(record.parkingReviewRequired)return {...base,reason:'Pendaftaran ditandakan perlu semakan kategori/kitaran. Pecahan harian tidak dianggap muktamad.'};
  if(record.parkingLedgerVersion==='unit-vehicle-days-1'&&Array.isArray(record.parkingDailyBreakdown)){
    const lines=record.parkingDailyBreakdown;
    if(!lines.length||lines.length>90||lines.some(l=>!/^\d{4}-\d{2}-\d{2}$/.test(l.date)||!valid(l.amountSen)||!Number.isInteger(l.day)||l.day<1||!['main','additional'].includes(l.role)||![1,2,3].includes(l.category)||typeof l.plate!=='string'||typeof l.ownerId!=='string'||typeof l.shared!=='boolean'||(l.shared&&l.amountSen!==0)||(!l.shared&&l.ownerId!==record.id)))return base;
    if(lines.reduce((n,l)=>n+l.amountSen,0)!==quoted)return base;
    const byDate=new Map();for(const l of lines){if(!byDate.has(l.date))byDate.set(l.date,[]);byDate.get(l.date).push(l);}
    const days=[...byDate].sort(([a],[b])=>a.localeCompare(b)).map(([date,items])=>[date,'Hari ke-'+items[0].day,items.map(l=>l.plate+': '+(l.shared?'Dikira dalam '+l.ownerId:l.role==='main'?'Kenderaan utama':'Kenderaan tambahan')).join('; '),items.reduce((n,l)=>n+l.amountSen,0)/100]);
    return {...base,from:days[0][0],to:days.at(-1)[0],days,reason:'Plat dan tarikh sama dikira sekali. Kenderaan utama ditentukan oleh permohonan yang dihantar dahulu; plat lain pada tarikh sama dikira sebagai tambahan.'};
  }
  if(quote.policyVersion!==POLICY_VERSION||![1,2,3].includes(cat))return base;
  try {
    const dates=datesInclusive(base.from,base.to);
    if(dates.length>30||!Number.isSafeInteger(quote.mainStartDay)||quote.mainStartDay<1||quote.mainEndDay!==quote.mainStartDay+dates.length-1)return base;
    const lines=dates.map((date,i)=>{const day=quote.mainStartDay+i,sen=dailyRateSen(cat,day);return [date,`Hari ke-${day}`,sen===0?'Kelayakan percuma':cat===3?'Kategori 3: RM15 sehari':`Kadar kenderaan utama Kategori ${cat}`,sen/100]});
    if(Math.round(lines.reduce((n,l)=>n+l[3],0)*100)!==quoted)return base;
    const adjusted=amount!=null&&amount!==quoted;
    return {...base,days:lines,reason:(adjusted?'Jumlah caj rasmi berbeza daripada snapshot asal (pelarasan). Jadual di bawah menunjukkan kiraan asal sahaja. ': '')+`Kenderaan utama bermula pada hari ke-${quote.mainStartDay} dalam kitaran penggunaan unit. ${cat===3?'Kategori 3 tiada hari percuma.':`Kategori ${cat} mempunyai ${cat===1?3:1} hari percuma setiap kitaran.`} `+(base.plate.includes(',')?'Pecahan ini untuk caj kenderaan utama; caj kenderaan tambahan tidak diandaikan.':'')};
  }catch{return base;}
}