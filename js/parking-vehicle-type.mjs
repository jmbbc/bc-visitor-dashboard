// Type applies to every plate in the current registration form.
export function parkingVehicleClass(value){
 const type=String(typeof value==='object'&&value?value.vehicleType:value||'').toLowerCase().replace(/\s+/g,'');
 if(['kereta','kereta/4x4','4x4','lori'].includes(type))return 'chargeable';
 if(['motosikal','pejalankaki'].includes(type))return 'exempt';
 return 'unknown';
}
export const isParkingExempt=value=>(!value||typeof value!=='object'||!value.category||value.category==='Pelawat')&&parkingVehicleClass(value)==='exempt';
