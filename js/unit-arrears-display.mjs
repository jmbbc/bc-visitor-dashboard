// Current unit balance is display data; registration snapshots remain charge history.
export function currentUnitArrears(unit, registration={}) {
 if(Number.isFinite(unit?.arrearsAmount))return Math.max(0,unit.arrearsAmount);
 if(unit?.arrears===false)return 0;
 if(unit?.arrears===true)return null;
 if(Number.isFinite(registration.unitArrearsAmount))return Math.max(0,registration.unitArrearsAmount);
 return registration.unitArrears===false?0:null;
}
