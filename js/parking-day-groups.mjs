// Presentation groups registrations without deleting their source identities.
export function groupParkingDay(items){
 const groups=new Map();
 for(const item of items){const plates=[...new Set(item.plates.map(p=>String(p).toUpperCase().replace(/[^A-Z0-9]/g,'')).filter(Boolean))];
  for(const plate of plates.length?plates:['']){const key=plate||'missing:'+item.id;if(!groups.has(key))groups.set(key,{plate:plate||'Tiada nombor',items:[]});const g=groups.get(key);if(!g.items.some(x=>x.id===item.id))g.items.push(item);}
 }
 return [...groups.values()].map(g=>{const statuses=g.items.map(i=>i.payment);let payment;
  if(statuses.some(s=>s.state==='unknown'))payment={state:'unknown',label:'Belum disahkan'};
  else if(statuses.some(s=>s.state==='pending')){const sum=statuses.reduce((n,s)=>n+(Number(s.label.match(/^Baki RM([0-9.]+)$/)?.[1])||0),0);payment={state:'pending',label:'Baki RM'+sum.toFixed(2)};}
  else payment={state:'paid',label:statuses.every(s=>s.label==='Percuma')?'Percuma':'Selesai'};
  return {...g,payment};
 });
}
