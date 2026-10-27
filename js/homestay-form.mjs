export function initHomestayForm(){
 const $=id=>document.getElementById(id),form=$('visitorForm');if(!form)return null;
 const area=document.createElement('div');area.className='homestay-parking';area.hidden=true;
 area.innerHTML='<label class="homestay-none"><input id="homestayNoVehicle" type="checkbox">Tiada kenderaan</label><div id="homestayParkingFields"><div class="homestay-lots" id="homestayLots"></div><button type="button" id="homestayAddLot" class="btn-ghost">+ Tambah Lot Parkir</button></div>';
 $('vehicleSingleWrap').after(area);
 function add(seed={}){const i=$('homestayLots').children.length+1,b=document.createElement('div');b.className='homestay-lot';b.innerHTML=`<h4>Lot parkir ${i} <small>${i===1?'· Wajib jika berkenderaan':'· Pilihan'}</small></h4><label for="homestayBay${i}">Nombor petak parkir</label><input id="homestayBay${i}" class="homestay-bay" maxlength="80" placeholder="Contoh: A-${122+i}"><label for="homestayPlate${i}">Nombor plat kenderaan</label><input id="homestayPlate${i}" class="homestay-plate" maxlength="30" placeholder="Contoh: ${i===1?'ABC123':'DEF456'}">`;
 b.querySelector('.homestay-bay').value=seed.parkingLot||'';b.querySelector('.homestay-plate').value=seed.plate||'';$('homestayLots').append(b);}
 function raw(){return [...$('homestayLots').children].map(b=>({parkingLot:b.querySelector('.homestay-bay').value,plate:b.querySelector('.homestay-plate').value}));}
 let wasHomestay=false;
 function refresh(){const hs=$('category').value==='Homestay';area.hidden=!hs;
  if(hs){for(const id of ['vehicleSingleWrap','vehicleMultiWrap','stayOverWrap','etdNote'])$(id)?.style.setProperty('display','none','important');for(const id of ['etaWrap','etdWrap']){$(id)?.classList.remove('hidden');$(id)?.style.removeProperty('display');$(id)?.removeAttribute('aria-hidden');} $('eta').disabled=false;$('eta').required=true;$('etd').disabled=false;$('etd').required=true;$('etd').max='';$('etd').min=$('eta').value;$('stayOver').value='Yes';$('vehicleNo').required=false;
  $('categoryPolicyNote').classList.remove('hidden');$('categoryPolicyNote').textContent='Homestay: isi petak milik unit dan padankan dengan nombor plat tetamu. Tiada caj parkir pelawat.';
  }else if(wasHomestay){for(const id of ['vehicleSingleWrap','vehicleMultiWrap','stayOverWrap','etdNote'])$(id)?.style.removeProperty('display');$('etd').required=false;$('vehicleNo').required=true;}
  const hostLabel=document.querySelector('label[for=hostName]');if(hostLabel)hostLabel.textContent=hs?'Nama penghuni / pengendali':'Nama penghuni';
  wasHomestay=hs;
  $('homestayParkingFields').hidden=$('homestayNoVehicle').checked;
 }
 function load(data){$('homestayLots').replaceChildren();const rows=data.homestayDraftLots||data.vehicleRowsDetailed||[];rows.forEach(r=>add(r));while($('homestayLots').children.length<2)add();$('homestayNoVehicle').checked=data.homestayNoVehicle===true||data.vehicleNo==='TIADA KENDERAAN';refresh();}
 add();add();$('homestayAddLot').onclick=()=>{add();form.dispatchEvent(new Event('input',{bubbles:true}));};$('homestayNoVehicle').onchange=refresh;
 // Run after the existing category/date handlers, which also own these controls.
 $('category').addEventListener('change',()=>queueMicrotask(refresh));$('eta').addEventListener('change',()=>queueMicrotask(refresh));form.addEventListener('reset',()=>queueMicrotask(()=>{load({});refresh();}));
 return {raw,load,refresh,noVehicle:()=>$('homestayNoVehicle').checked};
}
