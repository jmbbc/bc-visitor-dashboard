import {datesInclusive, dailyRateSen, POLICY_VERSION} from './parking-policy.mjs';
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
  const cat=Number(String(record.unitCategory || '').match(/[123]/)?.[0]);
  const valid=n=>Number.isSafeInteger(n)&&n>=0;
  const quoted=valid(quote.mainTotalSen)?quote.mainTotalSen:null;
  const amount=charge&&valid(charge.amountSen)?charge.amountSen:(!record.parkingReviewRequired&&quoted===0?0:null);
  const paid=charge&&valid(charge.paidSen)?charge.paidSen:(amount===0?0:null);
  const base={id:record.id,unit:record.hostUnit,plate:(Array.isArray(record.vehicleNumbers)?record.vehicleNumbers:[record.vehicleNo]).filter(Boolean).join(', ')||'Tiada nombor',category:cat?`Kategori ${cat} (snapshot asal)`:'Kategori belum disahkan',from:malaysiaDate(record.eta),to:malaysiaDate(record.etd||record.eta),paid:paid==null?null:paid/100,total:amount==null?null:amount/100,days:[],reason:'Snapshot kiraan tidak lengkap. Pecahan harian perlu semakan; amaun rasmi tidak diubah.'};
  if(record.parkingReviewRequired)return {...base,reason:'Pendaftaran ditandakan perlu semakan kategori/kitaran. Pecahan harian tidak dianggap muktamad.'};
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