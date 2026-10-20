import {uniqueResidentContacts} from './resident-contacts-model.mjs?v=20261020-1';
import {loadResidentContactPage} from './resident-contacts-store.mjs?v=20261020-2';
const preview=new URLSearchParams(location.search).get('preview')==='1';
function init(){
 const host=document.getElementById('pageUnitSummary');if(!host||document.getElementById('residentContacts'))return;
 const section=document.createElement('section');section.id='residentContacts';section.className='card';
 section.innerHTML=`<h4>Carian Maklumat Penghuni</h4><p>Cari nama dan nombor telefon penghuni mengikut unit rumah. Maklumat pelawat tidak disertakan.</p><form class="rc-form"><label>Unit rumah<input name="residentUnit" list="residentUnitOptions" placeholder="Contoh: B3-2-5" autocomplete="off" required maxlength="24"></label><datalist id="residentUnitOptions"></datalist><button type="submit" class="rc-submit">Cari Penghuni</button></form><p data-rc-status role="status" aria-live="polite">${preview?'Pratonton: data rekaan sahaja, tiada bacaan Firebase.':'Log masuk sebagai admin untuk membuat carian.'}</p><div class="rc-reads" aria-label="Anggaran bacaan carian penghuni"><span>Anggaran carian terakhir: <strong data-last-reads>0</strong> reads</span><span>Sesi ini: <strong data-session-reads>0</strong> reads</span><small data-read-source>Belum dicari</small><small class="rc-reads-note">Anggaran carian ini sahaja; tidak termasuk bacaan Security Rules, percubaan gagal atau fungsi dashboard lain.</small></div><table hidden><thead><tr><th scope="col">Nama penghuni</th><th scope="col">Nombor telefon</th></tr></thead><tbody></tbody></table><div class="rc-actions"><button type="button" data-more hidden>Muat lagi 50 rekod</button><button type="button" data-refresh hidden>Muat semula</button></div><p class="rc-note">Nama dan telefon yang sama digabungkan. Sejarah pendaftaran mungkin mengandungi maklumat penghuni lama. Carian dibuat hanya selepas menekan Cari; sejarah dibaca maksimum 51 rekod setiap kelompok.</p>`;
 host.querySelector('.management-hero')?.after(section);if(!section.isConnected)host.prepend(section);
 const input=section.querySelector('input'),form=section.querySelector('form'),submit=section.querySelector('[type="submit"]'),status=section.querySelector('[data-rc-status]'),table=section.querySelector('table'),body=section.querySelector('tbody'),more=section.querySelector('[data-more]'),refresh=section.querySelector('[data-refresh]');
 const validUnits=new Set(window.UNITS_STATIC||[]);for(const unit of validUnits){const option=document.createElement('option');option.value=unit;section.querySelector('datalist').append(option);}
 let admin=preview,auth=null,sdk=null,sequence=0,busyToken=0,active=null;const cache=new Map();
 let lastReads=0,sessionReads=0,readSource='Belum dicari',authEpoch=0;
 function updateReads(){section.querySelector('[data-last-reads]').textContent=lastReads;section.querySelector('[data-session-reads]').textContent=sessionReads;section.querySelector('[data-read-source]').textContent=readSource;}
 const unitValue=()=>input.value.trim().toUpperCase().replace(/\s+/g,'');
 const controls=()=>{submit.disabled=!admin||!!busyToken;input.disabled=!admin;more.disabled=!admin||!!busyToken;refresh.disabled=!admin||!!busyToken;};
 function clear(){active=null;body.replaceChildren();table.hidden=true;more.hidden=true;refresh.hidden=true;}
 function show(result,cached=false){
  active=result;body.replaceChildren();for(const contact of result.contacts){const row=document.createElement('tr');for(const value of [contact.name,contact.phone]){const cell=document.createElement('td');cell.textContent=value||'—';row.append(cell);}body.append(row);}
  table.hidden=!result.contacts.length;more.hidden=!result.hasMore;refresh.hidden=preview;
  status.textContent=`${preview?'DATA CONTOH · ':''}${result.unit}: ${result.contacts.length} pasangan nama / telefon berbeza · ${result.scanned} rekod pendaftaran disemak. ${result.hasMore?'Masih ada sejarah belum dimuat. Tekan Muat lagi untuk melengkapkan senarai.':'Semua sejarah yang sepadan telah disemak.'}${cached?' Hasil cache sesi; tiada bacaan data tambahan.':''}${!result.contacts.length?' Tiada maklumat penghuni ditemui.':''}`;
 }
 async function authorize(){const user=auth?.currentUser;if(!user||(await user.getIdTokenResult()).claims.admin!==true||auth.currentUser?.uid!==user.uid)throw Error('Carian ini memerlukan akaun admin.');return user.uid;}
 async function search({next=false,force=false}={}){
  const unit=unitValue();if(!validUnits.has(unit)){++sequence;busyToken=0;clear();status.textContent='Pilih unit rumah yang sah daripada senarai.';controls();return;}
  const token=++sequence;busyToken=token;lastReads=0;readSource='Sedang mencari…';updateReads();const epoch=authEpoch;const previous=next&&active?.unit===unit?active:null;
  if(!next)clear();status.textContent='Memuat maklumat penghuni '+unit+'…';controls();
  try{
   let uid;if(!preview)uid=await authorize();if(token!==sequence)return;
   if(!force&&!next&&cache.has(unit)){readSource='Cache sesi · tiada bacaan tambahan';updateReads();show(cache.get(unit),true);return;}
   let result;
   if(preview){const unitData={ownerName:'Ahmad Ali (Contoh)',ownerPhone:'0120000001'};const records=[{hostName:'AHMAD ALI (CONTOH)',hostPhone:'+6012 000 0001',visitorName:'Nama pelawat tidak dipaparkan',visitorPhone:'0190000000'},{hostName:'Ahmad Ali (Contoh)',hostPhone:'0190000002'},{hostName:'Siti Aminah (Contoh)',hostPhone:'0170000003'},{hostName:'Siti Aminah (Contoh)',hostPhone:'+60170000003'}];result={unit,unitData,records,hasMore:false,scanned:4,contacts:uniqueResidentContacts(unitData,records)};}
   else{sdk ||= await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');result=await loadResidentContactPage({sdk,db:window.__FIRESTORE,unit,previous,onRead:count=>{if(authEpoch!==epoch||auth.currentUser?.uid!==uid)return;sessionReads+=count;if(token===sequence)lastReads+=count;updateReads();}});}
   if(token!==sequence||(!preview&&auth.currentUser?.uid!==uid))return;
   if(!cache.has(unit)&&cache.size>=10)cache.delete(cache.keys().next().value);cache.set(unit,result);readSource=preview?'Pratonton · tiada bacaan Firebase':'Firebase · anggaran dokumen dibaca';updateReads();show(result);
  }catch(error){if(token===sequence){readSource='Carian gagal · anggaran mungkin tidak lengkap';updateReads();}if(token===sequence)status.textContent='Carian gagal. '+(String(error.code||'').includes('permission-denied')?'Akses ditolak. Log masuk semula sebagai admin.':error.message)+(previous?' Senarai terdahulu masih belum lengkap.':'');}
  finally{if(busyToken===token){busyToken=0;controls();}}
 }
 form.addEventListener('submit',event=>{event.preventDefault();search();});more.addEventListener('click',()=>search({next:true}));refresh.addEventListener('click',()=>search({force:true}));
 input.addEventListener('input',()=>{++sequence;busyToken=0;clear();status.textContent='Tekan Cari Penghuni untuk unit ini.';controls();});
 controls();
 if(preview){input.value='B3-2-5';setTimeout(controls,0);return;}
 (async()=>{await import('./firebase-init.js');auth=window.__AUTH;const {onAuthStateChanged}=await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js');onAuthStateChanged(auth,async user=>{const token=++sequence;++authEpoch;lastReads=0;sessionReads=0;readSource='Belum dicari';updateReads();busyToken=0;admin=false;cache.clear();clear();controls();try{const allowed=!!user&&(await user.getIdTokenResult()).claims.admin===true;if(token!==sequence)return;admin=allowed;status.textContent=allowed?'Pilih unit dan tekan Cari Penghuni. Tiada data dibaca sehingga carian dibuat.':'Carian maklumat penghuni hanya untuk admin.';controls();}catch{if(token===sequence)status.textContent='Pengesahan akses gagal. Sila log masuk semula.';}});})().catch(()=>{status.textContent='Firebase belum tersedia. Sila muat semula halaman.';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
