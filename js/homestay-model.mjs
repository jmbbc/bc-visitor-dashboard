export function validateHomestayLots(rows,{noVehicle=false}={}){
 if(noVehicle)return [];
 const result=[],bays=new Set(),plates=new Set();
 for(const [i,row] of rows.entries()){
  const parkingLot=String(row.parkingLot||'').trim().toUpperCase(),plate=String(row.plate||'').toUpperCase().replace(/\s+/g,'');
  if(!parkingLot&&!plate&&i>0)continue;
  if(!parkingLot||!plate)throw Error(`Lengkapkan nombor petak dan nombor plat untuk Lot ${i+1}.`);
  if(parkingLot.length>80||plate.length>30)throw Error('Nombor petak atau plat terlalu panjang.');
  const bayKey=parkingLot.replace(/\s+/g,'');
  if(bays.has(bayKey)||plates.has(plate))throw Error('Nombor petak dan nombor plat tidak boleh berulang.');
  bays.add(bayKey);plates.add(plate);result.push({parkingLot,plate});
 }
 if(!result.length)throw Error('Isi sekurang-kurangnya satu lot atau pilih Tiada kenderaan.');
 return result;
}
export function homestayWhatsApp(payload,{etaText='-',etdText='-'}={}){
 const rows=payload.vehicleRowsDetailed||[];
 return ['*PENDAFTARAN HOMESTAY — BANJARIA COURT*',`ID Permohonan: ${payload.verificationCode||'-'}`,'',`Unit: ${payload.hostUnit||'-'}`,`Pengendali: ${payload.hostName||'-'}`,`Telefon pengendali: ${payload.hostPhone||'-'}`,'',`Tetamu utama: ${payload.visitorName||'-'}`,`Telefon tetamu: ${payload.visitorPhone||'-'}`,`Tarikh masuk: ${etaText}`,`Tarikh keluar: ${etdText}`,'','*Kenderaan & Petak Parkir*',...(rows.length?rows.map((r,i)=>`${i+1}. ${r.plate} → Petak ${r.parkingLot}`):['Tiada kenderaan']),'','Parkir: Petak milik unit. Tidak menggunakan petak parkir pelawat.'].join('\n');
}
