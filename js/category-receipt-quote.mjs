import {datesInclusive} from './parking-policy.mjs';
// Presentation quote for the existing non-overnight rules. Does not write charges.
export function categoryReceiptQuote({category,arrearsCategory,startDate,endDate,mainPlate='',additionalVehicles=[],vehicleCount=1,exempt=false,vehicleType=''}){
 const special=category==='Pelawat Khas',visitor=category==='Pelawat',chargeable=visitor||category==='Kontraktor',cat=arrearsCategory;
 const free=cat===1?3:cat===2?1:0,rate=special?({1:5,2:8,3:15}[cat]||0):cat===2?5:cat===3?15:0;
 const extraRate=special?rate:visitor?({1:10,2:15,3:25}[cat]||0):0;
 const mainDates=startDate?datesInclusive(startDate,endDate||startDate):[];
 const mainDays=mainDates.map((date,index)=>({date,day:index+1,amountSen:exempt?0:special?rate*100:chargeable&&index>=free?rate*100:0}));
 const amount=mainDays.reduce((n,d)=>n+d.amountSen,0)/100;
 const label=vehicleType&& !['Kereta','Kereta / 4x4'].includes(vehicleType)?`${vehicleType} 1`:'Kereta 1';
 const vehicles=[{number:1,label,plate:mainPlate||'Nombor kenderaan belum diisi',start:startDate,end:endDate||startDate,amount:startDate?amount:null,days:mainDays,calculation:special?`${mainDays.length} hari × RM ${rate.toFixed(2)}`:exempt?'Dikecualikan daripada caj parkir':!chargeable?'Tiada caj parkir untuk kategori ini':`${Math.min(free,mainDays.length)} hari percuma${mainDays.length>free?` + ${mainDays.length-free} hari × RM ${rate.toFixed(2)}`:''}`}];
 const extras=additionalVehicles.length?additionalVehicles:Array.from({length:(visitor||special)?Math.max(0,vehicleCount-1):0},()=>({}));
 if(visitor||special)for(const [i,row] of extras.entries()){
  const start=row.startDate||startDate,end=row.endDate||start,dates=start?datesInclusive(start,end):[],days=dates.map((date,index)=>({date,day:index+1,amountSen:exempt?0:extraRate*100}));
  vehicles.push({number:i+2,plate:row.plate||`Kenderaan ${i+2}`,start,end,amount:start?days.reduce((n,d)=>n+d.amountSen,0)/100:null,days,calculation:exempt?'Dikecualikan daripada caj parkir':`${days.length} hari × RM ${extraRate.toFixed(2)}`});
 }
 const zero=exempt||(!chargeable&&!special);
 if(zero)for(const row of vehicles)row.amount=0;
 return {vehicles,total:zero?0:!startDate?null:vehicles.reduce((n,r)=>n+r.amount,0)};
}
