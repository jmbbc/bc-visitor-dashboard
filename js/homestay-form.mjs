export function initHomestayForm({onChange=()=>{}}={}){
 const $=id=>document.getElementById(id),form=$('visitorForm');if(!form)return null;
 const area=document.createElement('div');area.className='homestay-parking';area.hidden=true;
 area.innerHTML='<label class="homestay-none"><input id="homestayNoVehicle" type="checkbox">Tiada kenderaan</label><div id="homestayParkingFields"><div class="homestay-lots" id="homestayLots"></div><button type="button" id="homestayAddLot" class="btn-ghost">+ Tambah Kenderaan</button></div>';
 $('vehicleSingleWrap').after(area);
 area.addEventListener('input',()=>queueMicrotask(onChange));area.addEventListener('change',()=>queueMicrotask(onChange));
 function add(seed={}){const i=$('homestayLots').children.length+1,b=document.createElement('div');b.className='homestay-lot';b.innerHTML=`<h4>Kenderaan ${i} <small>${i===1?'· Wajib jika berkenderaan':'· Pilihan'}</small></h4><label for="homestayType${i}">Tempat parkir</label><select id="homestayType${i}" class="homestay-type"><option value="own">Petak sendiri · Percuma</option><option value="visitor">Parkir pelawat · RM5/hari</option></select><div class="homestay-own"><label for="homestayBay${i}">Nombor petak parkir</label><input id="homestayBay${i}" class="homestay-bay" maxlength="80" placeholder="Contoh: A-${122+i}"></div><div class="homestay-visitor" hidden><p class="small">RM5 sehari. Kosongkan tarikh untuk guna tempoh penginapan.</p><label for="homestayStart${i}">Tarikh mula parkir</label><input id="homestayStart${i}" class="homestay-start" type="date"><label for="homestayEnd${i}">Tarikh akhir parkir</label><input id="homestayEnd${i}" class="homestay-end" type="date"></div><label for="homestayPlate${i}">Nombor plat kenderaan</label><input id="homestayPlate${i}" class="homestay-plate" maxlength="30" placeholder="Contoh: ${i===1?'ABC123':'DEF456'}">`;
 b.querySelector('.homestay-type').value=seed.parkingType||'own';b.querySelector('.homestay-start').value=seed.startDate||'';b.querySelector('.homestay-end').value=seed.endDate||'';
 const toggle=()=>{const visitor=b.querySelector('.homestay-type').value==='visitor';b.querySelector('.homestay-own').hidden=visitor;b.querySelector('.homestay-visitor').hidden=!visitor;for(const cls of ['start','end']){const input=b.querySelector('.homestay-'+cls);input.min=$('eta').value;input.max=$('etd').value;input.disabled=!visitor;} };b.querySelector('.homestay-type').addEventListener('change',toggle);toggle();
 b.querySelector('.homestay-bay').value=seed.parkingLot||'';b.querySelector('.homestay-plate').value=seed.plate||'';$('homestayLots').append(b);}
 function raw(){return [...$('homestayLots').children].map(b=>({parkingLot:b.querySelector('.homestay-bay').value,plate:b.querySelector('.homestay-plate').value,parkingType:b.querySelector('.homestay-type').value,startDate:b.querySelector('.homestay-start').value,endDate:b.querySelector('.homestay-end').value}));}
 let wasHomestay=false;
 function refresh(){const hs=$('category').value==='Homestay';area.hidden=!hs;
  if(hs){for(const id of ['vehicleSingleWrap','vehicleMultiWrap','stayOverWrap','etdNote'])$(id)?.style.setProperty('display','none','important');for(const id of ['etaWrap','etdWrap']){$(id)?.classList.remove('hidden');$(id)?.style.removeProperty('display');$(id)?.removeAttribute('aria-hidden');} $('eta').disabled=false;$('eta').required=true;$('etd').disabled=false;$('etd').required=true;$('etd').max='';$('etd').min=$('eta').value;$('stayOver').value='Yes';$('vehicleNo').required=false;
  $('categoryPolicyNote').classList.remove('hidden');$('categoryPolicyNote').textContent='Homestay: pilih parkir bagi setiap kenderaan. Petak sendiri percuma; parkir pelawat RM5 sehari bagi setiap kenderaan.';
  }else if(wasHomestay){for(const id of ['vehicleSingleWrap','vehicleMultiWrap','stayOverWrap','etdNote'])$(id)?.style.removeProperty('display');$('etd').required=false;$('vehicleNo').required=true;}
  const hostLabel=document.querySelector('label[for=hostName]');if(hostLabel)hostLabel.textContent=hs?'Nama penghuni / pengendali':'Nama penghuni';
  wasHomestay=hs;
  $('homestayParkingFields').hidden=$('homestayNoVehicle').checked;
  for(const input of area.querySelectorAll('input[type=date]')){input.min=$('eta').value;input.max=$('etd').value;input.disabled=$('homestayNoVehicle').checked||input.closest('.homestay-lot').querySelector('.homestay-type').value!=='visitor';}
 }
 function load(data){$('homestayLots').replaceChildren();const rows=data.homestayDraftLots||data.vehicleRowsDetailed||[];rows.forEach(r=>add(r));while($('homestayLots').children.length<2)add();$('homestayNoVehicle').checked=data.homestayNoVehicle===true||data.vehicleNo==='TIADA KENDERAAN';refresh();}
 add();add();$('homestayAddLot').onclick=()=>{add();form.dispatchEvent(new Event('input',{bubbles:true}));};$('homestayNoVehicle').onchange=refresh;
 // Run after the existing category/date handlers, which also own these controls.
 $('category').addEventListener('change',()=>queueMicrotask(refresh));$('eta').addEventListener('change',()=>queueMicrotask(refresh));$('etd').addEventListener('change',()=>queueMicrotask(refresh));form.addEventListener('reset',()=>queueMicrotask(()=>{load({});refresh();}));
 return {raw,load,refresh,noVehicle:()=>$('homestayNoVehicle').checked};
}
