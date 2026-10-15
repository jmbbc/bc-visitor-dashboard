import {isParkingExempt} from './parking-vehicle-type.mjs?v=20261015-type-1';
// Weekly report uses official cumulative charge totals, never operational status.
export function weeklyParkingPayment(registration, charge, verified = true) {
  const unknown = {state:'unknown', label:'Belum disahkan'};
  if (!verified) return unknown;
  if(isParkingExempt(registration))return charge?.amountSen>0?{state:'unknown',label:'Semak pengecualian'}:{state:'paid',label:'Tidak dikenakan caj'};
  if(registration.parkingReviewReason==='vehicle_type_exempt')return {state:'unknown',label:'Menunggu kiraan'};
  if(registration.parkingReviewReason==='automatic_ledger_pending')return {state:'unknown',label:'Menunggu kiraan'};
  if (charge) {
    const {amountSen, paidSen} = charge;
    if (!Number.isSafeInteger(amountSen) || amountSen < 0 || !Number.isSafeInteger(paidSen) || paidSen < 0) return unknown;
    if (amountSen === 0) return {state:'paid', label:'Percuma'};
    const balance = Math.max(0, amountSen - paidSen);
    return balance ? {state:'pending', label:'Baki RM' + (balance / 100).toFixed(2)} : {state:'paid', label:'Selesai'};
  }
  if (registration.parkingReviewRequired === true) return unknown;
  if (registration.parkingQuote?.mainTotalSen === 0 && registration.status !== 'Pending Payment') return {state:'paid', label:'Percuma'};
  return unknown;
}
