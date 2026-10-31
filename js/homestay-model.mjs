import {renderParkingReceipt} from './parking-receipt.mjs?v=20261031-all-1';
import {datesInclusive} from './parking-policy.mjs';
export function validateHomestayLots(rows,{noVehicle=false,startDate='',endDate=''}={}){
 if(noVehicle)return [];
 const result=[],bays=new Set(),plates=new Set();
 for(const [i,row] of rows.entries()){
  const parkingLot=String(row.parkingLot||'').trim().toUpperCase(),plate=String(row.plate||'').toUpperCase().replace(/\s+/g,'');
  const visitor=row.parkingType==='visitor';
  if(row.parkingType&&!['own','visitor'].includes(row.parkingType))throw Error('Pilihan parkir tidak sah.');
  if(!parkingLot&&!plate&&!visitor&&i>0)continue;
  if((!visitor&&!parkingLot)||!plate)throw Error(`Lengkapkan nombor petak dan nombor plat untuk Lot ${i+1}.`);
  if(parkingLot.length>80||plate.length>30)throw Error('Nombor petak atau plat terlalu panjang.');
  const bayKey=parkingLot.replace(/\s+/g,'');
  if((!visitor&&bays.has(bayKey))||plates.has(plate))throw Error('Nombor petak dan nombor plat tidak boleh berulang.');
  if(!visitor)bays.add(bayKey);plates.add(plate);
  if(visitor){const start=row.startDate||startDate,end=row.endDate||endDate;datesInclusive(start,end);if((startDate&&start<startDate)||(endDate&&end>endDate))throw Error('Tarikh parkir pelawat mesti dalam tempoh penginapan.');result.push({parkingLot:'PARKIR PELAWAT',plate,parkingType:'visitor',startDate:start,endDate:end});}
  else result.push({parkingLot,plate});
 }
 if(!result.length)throw Error('Isi sekurang-kurangnya satu lot atau pilih Tiada kenderaan.');
 return result;
}
export function homestayWhatsApp(payload,{etaText='-',etdText='-'}={}){
 const rows=payload.vehicleRowsDetailed||[];
 return ['*PENDAFTARAN HOMESTAY — BANJARIA COURT*',`ID Permohonan: ${payload.verificationCode||'-'}`,'',`Unit: ${payload.hostUnit||'-'}`,`Pengendali: ${payload.hostName||'-'}`,`Telefon pengendali: ${payload.hostPhone||'-'}`,'',`Tetamu utama: ${payload.visitorName||'-'}`,`Telefon tetamu: ${payload.visitorPhone||'-'}`,`Tarikh masuk: ${etaText}`,`Tarikh keluar: ${etdText}`,'','*Kenderaan & Petak Parkir*',...(rows.length?rows.map((r,i)=>r.parkingType==='visitor'?`${i+1}. ${r.plate} → Parkir pelawat (${r.startDate} – ${r.endDate}) · RM ${(datesInclusive(r.startDate,r.endDate).length*5).toFixed(2)}`:`${i+1}. ${r.plate} → Petak ${r.parkingLot}`):['Tiada kenderaan']),'',...(rows.some(r=>r.parkingType==='visitor')?[`Jumlah caj parkir pelawat: RM ${(quoteHomestayParking(rows).totalSen/100).toFixed(2)}`,'Kadar Homestay: RM5 sehari bagi setiap kenderaan.']:['Parkir: Petak milik unit. Tidak menggunakan petak parkir pelawat.'])].join('\n');
}

export function quoteHomestayParking(rows,{startDate='',endDate=''}={}){
 const vehicles=rows.map(r=>{const start=r.startDate||startDate,end=r.endDate||endDate,visitor=r.parkingType==='visitor',days=visitor?datesInclusive(start,end).length:0;return {plate:r.plate,parkingLot:r.parkingLot,parkingType:visitor?'visitor':'own',startDate:start,endDate:end,days,amountSen:days*500};});
 const totalSen=vehicles.reduce((n,r)=>n+r.amountSen,0);if(!Number.isSafeInteger(totalSen)||totalSen>100000000)throw Error('Jumlah caj melebihi had.');
 return {vehicles,totalSen};
}
export function renderHomestaySummary(rows,options={}){
 const q=quoteHomestayParking(rows,options);
 const vehicleRows=q.vehicles.map((r,index)=>({number:index+1,plate:r.plate,start:r.startDate,end:r.endDate,amount:r.amountSen/100,note:r.parkingType==='visitor'?'Parkir pelawat · RM5/hari':`Petak sendiri · ${r.parkingLot}`,calculation:r.parkingType==='visitor'?`${r.days} hari × RM 5.00`:'Petak sendiri · Percuma',days:r.parkingType==='visitor'?datesInclusive(r.startDate,r.endDate).map((date,i)=>({date,day:i+1,amountSen:500})):[]}));
 return renderParkingReceipt({unit:options.unit||'—',category:'Homestay',arrearsText:'Tidak terpakai',total:q.totalSen/100,vehicleRows,caution:'Homestay: petak sendiri percuma. Parkir pelawat RM5 sehari bagi setiap kenderaan, termasuk tarikh mula dan akhir. Kadar tidak bergantung pada tunggakan unit. Tertakluk kepada kekosongan petak.'});
}
