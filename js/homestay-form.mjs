import {quoteHomestayParking} from './homestay-model.mjs?v=20261031-2';
export function initHomestayForm({onChange=()=>{}}={}){
 const $=id=>document.getElementById(id),form=$('visitorForm');if(!form)return null;
 const area=document.createElement('div');area.className='homestay-parking';area.hidden=true;
 area.innerHTML='<label class="homestay-none"><input id="homestayNoVehicle" type="checkbox">Tiada kenderaan</label><div id="homestayParkingFields"><div class="homestay-lots" id="homestayLots"></div><button type="button" id="homestayAddLot" class="btn-ghost">+ Tambah Kenderaan</button></div>';
 $('vehicleSingleWrap').after(area);
 area.addEventListener('input',()=>queueMicrotask(onChange));area.addEventListener('change',()=>queueMicrotask(onChange));
 let nextLotId=0;
 function renumber(){[...$('homestayLots').children].forEach((box,index)=>{const title=box.querySelector('h4');title.textContent=`Kenderaan ${index+1}`;const note=document.createElement('small');note.textContent=index===0?' · Wajib jika berkenderaan':' · Pilihan';title.append(note);const remove=box.querySelector('.homestay-remove');if(remove)remove.setAttribute('aria-label',`Buang kenderaan ${index+1}`);});}
 function add(seed={}){const extra=$('homestayLots').children.length>=2,i=++nextLotId,b=document.createElement('div');b.className='homestay-lot';b.innerHTML=`<h4>Kenderaan ${i} <small>${i===1?'· Wajib jika berkenderaan':'· Pilihan'}</small></h4><label for="homestayType${i}">Tempat parkir</label><select id="homestayType${i}" class="homestay-type"><option value="own">Petak sendiri · Percuma</option><option value="visitor">Parkir pelawat · RM5/hari</option></select><div class="homestay-own"><label for="homestayBay${i}">Nombor petak parkir</label><input id="homestayBay${i}" class="homestay-bay" maxlength="80" placeholder="Contoh: A-${122+i}"></div><div class="homestay-visitor" hidden><p class="small homestay-date-summary" aria-live="polite"></p><label class="homestay-custom-label"><input type="checkbox" class="homestay-custom"> Guna tarikh parkir berbeza</label><div class="homestay-custom-dates" hidden><label for="homestayStart${i}">Tarikh mula parkir</label><input id="homestayStart${i}" class="homestay-start" type="date"><label for="homestayEnd${i}">Tarikh akhir parkir</label><input id="homestayEnd${i}" class="homestay-end" type="date"></div></div><label for="homestayPlate${i}">Nombor plat kenderaan</label><input id="homestayPlate${i}" class="homestay-plate" maxlength="30" placeholder="Contoh: ${i===1?'ABC123':'DEF456'}">`;
 b.querySelector('.homestay-type').value=seed.parkingType||'own';b.querySelector('.homestay-start').value=seed.startDate||'';b.querySelector('.homestay-end').value=seed.endDate||'';
 b.querySelector('.homestay-custom').checked=seed.useDifferentDates===true||(seed.useDifferentDates===undefined&&seed.parkingType==='visitor'&&((seed.startDate&&seed.startDate!==$('eta').value)||(seed.endDate&&seed.endDate!==$('etd').value)));
 for(const selector of ['.homestay-type','.homestay-custom','.homestay-start','.homestay-end'])b.querySelector(selector).addEventListener('change',()=>syncBox(b));
 syncBox(b);
 b.querySelector('.homestay-bay').value=seed.parkingLot||'';b.querySelector('.homestay-plate').value=seed.plate||'';if(extra){const header=document.createElement('div');header.className='homestay-lot-header';const title=b.querySelector('h4'),remove=document.createElement('button');remove.type='button';remove.className='btn-ghost homestay-remove';remove.textContent='× Buang';header.append(title,remove);b.prepend(header);remove.onclick=()=>{const next=b.nextElementSibling;b.remove();renumber();form.dispatchEvent(new Event('input',{bubbles:true}));onChange();(next?.querySelector('.homestay-type')||$('homestayAddLot')).focus();};}
 $('homestayLots').append(b);renumber();}
 function syncBox(b){
  const visitor=b.querySelector('.homestay-type').value==='visitor',custom=b.querySelector('.homestay-custom').checked;
  b.querySelector('.homestay-own').hidden=visitor;b.querySelector('.homestay-visitor').hidden=!visitor;b.querySelector('.homestay-custom-dates').hidden=!custom;
  for(const cls of ['start','end']){const input=b.querySelector('.homestay-'+cls);input.min=$('eta').value;input.max=$('etd').value;input.disabled=!visitor||!custom||$('homestayNoVehicle').checked||$('category').value!=='Homestay';}
  const summary=b.querySelector('.homestay-date-summary');
  const startDate=custom?(b.querySelector('.homestay-start').value||$('eta').value):$('eta').value,endDate=custom?(b.querySelector('.homestay-end').value||$('etd').value):$('etd').value;
  try{const q=quoteHomestayParking([{parkingType:'visitor',startDate,endDate}]),fmt=s=>s.split('-').reverse().join('/');summary.textContent=`${custom?'Tarikh parkir':'Ikut penginapan'}: ${fmt(startDate)} – ${fmt(endDate)} · ${q.vehicles[0].days} hari · RM ${(q.totalSen/100).toFixed(2)}`;}
  catch{summary.textContent='Pilih tarikh masuk dan keluar untuk melihat caj RM5 sehari.';}
 }
 function raw(){return [...$('homestayLots').children].map(b=>{const useDifferentDates=b.querySelector('.homestay-custom').checked;return {parkingLot:b.querySelector('.homestay-bay').value,plate:b.querySelector('.homestay-plate').value,parkingType:b.querySelector('.homestay-type').value,useDifferentDates,startDate:useDifferentDates?b.querySelector('.homestay-start').value:'',endDate:useDifferentDates?b.querySelector('.homestay-end').value:''};});}
 let wasHomestay=false;
 function refresh(){const hs=$('category').value==='Homestay';area.hidden=!hs;
  if(hs){for(const id of ['vehicleSingleWrap','vehicleMultiWrap','stayOverWrap','etdNote'])$(id)?.style.setProperty('display','none','important');for(const id of ['etaWrap','etdWrap']){$(id)?.classList.remove('hidden');$(id)?.style.removeProperty('display');$(id)?.removeAttribute('aria-hidden');} $('eta').disabled=false;$('eta').required=true;$('etd').disabled=false;$('etd').required=true;$('etd').max='';$('etd').min=$('eta').value;$('stayOver').value='Yes';$('vehicleNo').required=false;
  $('categoryPolicyNote').classList.remove('hidden');$('categoryPolicyNote').textContent='Homestay: pilih parkir bagi setiap kenderaan. Petak sendiri percuma; parkir pelawat RM5 sehari bagi setiap kenderaan.';
  }else if(wasHomestay){for(const id of ['vehicleSingleWrap','vehicleMultiWrap','stayOverWrap','etdNote'])$(id)?.style.removeProperty('display');$('etd').required=false;$('vehicleNo').required=true;}
  const hostLabel=document.querySelector('label[for=hostName]');if(hostLabel)hostLabel.textContent=hs?'Nama penghuni / pengendali':'Nama penghuni';
  wasHomestay=hs;
  $('homestayParkingFields').hidden=$('homestayNoVehicle').checked;
  for(const box of $('homestayLots').children)syncBox(box);
 }
 function load(data){$('homestayLots').replaceChildren();const rows=data.homestayDraftLots||data.vehicleRowsDetailed||[];rows.forEach(r=>add(r));while($('homestayLots').children.length<2)add();$('homestayNoVehicle').checked=data.homestayNoVehicle===true||data.vehicleNo==='TIADA KENDERAAN';refresh();}
 add();add();$('homestayAddLot').onclick=()=>{add();form.dispatchEvent(new Event('input',{bubbles:true}));onChange();};$('homestayNoVehicle').onchange=refresh;
 // Run after the existing category/date handlers, which also own these controls.
 $('category').addEventListener('change',()=>queueMicrotask(refresh));$('eta').addEventListener('change',()=>queueMicrotask(refresh));$('etd').addEventListener('change',()=>queueMicrotask(refresh));form.addEventListener('reset',()=>queueMicrotask(()=>{load({});refresh();}));
 return {raw,load,refresh,noVehicle:()=>$('homestayNoVehicle').checked};
}
