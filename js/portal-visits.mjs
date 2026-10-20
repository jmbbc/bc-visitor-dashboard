import {malaysiaVisitPeriod,recordPortalVisit} from './portal-visits-model.mjs?v=20261020-1';
const root=document.getElementById('portalVisits');
if(root&&!root.dataset.initialized){
 root.dataset.initialized='true';
 const preview=new URLSearchParams(location.search).get('preview')==='1'||['localhost','127.0.0.1','[::1]'].includes(location.hostname)||location.protocol==='file:';
 const status=root.querySelector('[data-visit-status]');let inFlight=false;
 function render(data){const f=new Intl.NumberFormat('ms-MY');for(const key of ['yearVisits','monthVisits','dayVisits'])root.querySelector(`[data-visit-count="${key}"]`).textContent=f.format(data[key]);root.querySelector('[data-visit-year]').textContent=String(data.year);root.querySelector('[data-visit-month]').textContent=new Date(Date.UTC(data.year,data.month-1,1)).toLocaleDateString('ms-MY',{month:'short',timeZone:'UTC'});root.querySelector('[data-visit-day]').textContent=String(data.day);}
 async function count(){if(inFlight)return;inFlight=true;status.textContent='Memuat statistik…';try{
  if(preview){render({...malaysiaVisitPeriod(),yearVisits:1284,monthVisits:216,dayVisits:14});status.textContent='Data contoh · Tiada lawatan direkodkan';return;}
  await import('./firebase-init.js');const sdk=await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');render(await recordPortalVisit({sdk,db:window.__FIRESTORE}));status.textContent='Lawatan halaman · Waktu Malaysia';
 }catch{root.querySelectorAll('[data-visit-count]').forEach(el=>el.textContent='—');status.textContent='Statistik belum tersedia.';}finally{inFlight=false;}}
 count();window.addEventListener('pageshow',event=>{if(event.persisted)count();});
}
