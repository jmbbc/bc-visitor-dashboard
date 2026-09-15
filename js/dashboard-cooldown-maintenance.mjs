import {collection,doc,getCountFromServer,getDoc,getDocs,runTransaction,serverTimestamp,Timestamp} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import {onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import {categoryFromUnit,cooldownResetEligibility} from './cooldown-maintenance-policy.mjs?v=20260915-1';

const panel=document.getElementById('cooldownMaintenancePanel');
if(panel&&window.__AUTH&&window.__FIRESTORE){
  const estimateBtn=document.getElementById('cooldownEstimateBtn'),loadBtn=document.getElementById('cooldownLoadBtn'),resetBtn=document.getElementById('cooldownResetBtn');
  const message=document.getElementById('cooldownMaintenanceMessage'),body=document.getElementById('cooldownMaintenanceRows'),selectAll=document.getElementById('cooldownSelectAll');
  const search=document.getElementById('cooldownMaintenanceSearch'),categoryFilter=document.getElementById('cooldownMaintenanceCategory');
  const checkedCount=document.getElementById('cooldownCheckedCount'),eligibleCount=document.getElementById('cooldownEligibleCount'),selectedCount=document.getElementById('cooldownSelectedCount'),reviewCount=document.getElementById('cooldownReviewCount');
  const lookupInput=document.getElementById('cooldownUnitLookupInput'),lookupBtn=document.getElementById('cooldownUnitLookupBtn'),lookupMessage=document.getElementById('cooldownUnitLookupMessage'),lookupResult=document.getElementById('cooldownUnitLookupResult');
  let adminUser=null,rows=[],estimatedLocks=0;
  const safe=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const todayKey=()=>{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=type=>parts.find(part=>part.type===type)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const malaysiaDate=value=>{
    const date=value?.toDate?value.toDate():null;if(!date)return null;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    const get=type=>parts.find(part=>part.type===type)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const unitKey=value=>String(value||'').replace(/\s+/g,'').toUpperCase();
  const reasonText={
    cooldown_active:'Cooldown masih aktif',cooldown_complete:'Cooldown tamat — layak reset',already_reset:'Counter sudah bermula semula',
    category_3:'Kategori 3 — tiada kelayakan percuma/cooldown',category_unknown:'Kategori tidak dapat ditentukan',incomplete:'Data counter tidak lengkap',no_record:'Tiada rekod cooldown untuk unit ini'
  };
  async function lookupUnit(){
    const unit=unitKey(lookupInput.value);lookupResult.hidden=true;lookupResult.replaceChildren();
    if(!unit){lookupMessage.textContent='Masukkan nombor unit dahulu.';lookupInput.focus();return;}
    lookupBtn.disabled=true;lookupMessage.textContent=`Menyemak ${unit}…`;
    try{
      const [unitSnap,lockSnap]=await Promise.all([getDoc(doc(window.__FIRESTORE,'units',unit)),getDoc(doc(window.__FIRESTORE,'overnightLocks',`unit-${unit}`))]);
      if(!unitSnap.exists()){lookupMessage.textContent=`Unit ${unit} tidak dijumpai dalam senarai unit.`;return;}
      const unitData=unitSnap.data()||{},category=categoryFromUnit(unitData),arrears=Number(unitData.arrearsAmount),lock=lockSnap.exists()?(lockSnap.data()||{}):null;
      const days=lock?Number(lock.mainUsageDays):0,lastAnyEnd=lock?malaysiaDate(lock.lastAnyEnd||lock.endDate):null;
      const result=lock?cooldownResetEligibility({category,mainUsageDays:lock.mainUsageDays,lastAnyEnd,today:todayKey()}):{eligible:false,reason:'no_record',nextEligible:null};
      const arrearsText=Number.isFinite(arrears)?`RM ${arrears.toFixed(2)}`:'Tidak tersedia',lastText=lastAnyEnd||'Tiada rekod',nextText=result.nextEligible||'Tidak berkenaan';
      const canShowReset=lock&&[1,2].includes(category)&&Number.isInteger(days)&&days>0;
      const emergency=result.reason==='cooldown_active';
      lookupResult.innerHTML=`<div class="cooldown-unit-result-grid"><div><span>Unit</span><strong>${safe(unit)}</strong></div><div><span>Kategori</span><strong>${category?`Kategori ${category}`:'Tidak diketahui'}</strong></div><div><span>Tunggakan</span><strong>${safe(arrearsText)}</strong></div><div><span>Counter</span><strong>${Number.isInteger(days)&&days>=0?days:'Tidak lengkap'}</strong></div><div><span>Parkir terakhir</span><strong>${safe(lastText)}</strong></div></div><p class="cooldown-unit-result-note small"><strong>${safe(reasonText[result.reason]||result.reason)}</strong>${result.reason==='cooldown_active'?` · Layak semula pada ${safe(nextText)}`:result.reason==='cooldown_complete'?` · Layak sejak ${safe(nextText)}`:''}</p>${canShowReset?`<div class="cooldown-unit-result-actions">${emergency?'<label>Sebab reset kecemasan *<input id="cooldownEmergencyReason" maxlength="200" placeholder="Contoh: Kecemasan keluarga" required></label>':'<span></span>'}<button id="cooldownUnitResetBtn" class="btn ${emergency?'emergency-reset':''}" type="button">${emergency?'Reset Kecemasan':'Reset Counter Unit Ini'}</button></div>`:''}`;
      const singleResetBtn=document.getElementById('cooldownUnitResetBtn');
      singleResetBtn?.addEventListener('click',async()=>{
        const reason=document.getElementById('cooldownEmergencyReason')?.value.trim()||'';
        if(emergency&&reason.length<3){lookupMessage.textContent='Masukkan sebab reset kecemasan sekurang-kurangnya 3 aksara.';document.getElementById('cooldownEmergencyReason')?.focus();return;}
        if(!confirm(`${emergency?'Reset kecemasan':'Reset counter cooldown'} untuk ${unit}? Tindakan ini akan direkodkan dalam audit.`))return;
        singleResetBtn.disabled=true;lookupMessage.textContent=`Menyemak semula dan mereset ${unit}…`;
        try{const outcome=await resetOne({unit},{emergency,reason});if(outcome==='reset'){await lookupUnit();lookupMessage.textContent=`Counter ${unit} berjaya direset dan paparan telah dikemas kini.`;}else{await lookupUnit();lookupMessage.textContent='Reset tidak dibuat kerana keadaan unit telah berubah. Paparan telah dikemas kini.';}}
        catch(error){lookupMessage.textContent=error.code==='permission-denied'?'Reset ditolak. Akaun admin dan Firebase Rules yang betul diperlukan.':'Reset gagal. Rekod tidak diubah; sila cuba lagi.';singleResetBtn.disabled=false;}
      });
      lookupResult.hidden=false;lookupMessage.textContent=`Semakan ${unit} selesai. 2 bacaan digunakan.`;
    }catch(error){lookupMessage.textContent=error.code==='permission-denied'?'Akses ditolak. Log masuk semula menggunakan akaun admin.':'Semakan unit gagal. Sila cuba lagi.';}
    finally{lookupBtn.disabled=false;}
  }
  const visibleRows=()=>{const term=unitKey(search.value),wanted=categoryFilter.value;return rows.filter(row=>(!term||row.unit.includes(term))&&(!wanted||String(row.category)===wanted));};
  function render(){
    const visible=visibleRows();body.replaceChildren();
    for(const row of visible){
      const tr=document.createElement('tr');
      tr.innerHTML=`<td><input type="checkbox" data-unit="${safe(row.unit)}" ${row.selected?'checked':''} ${row.status!=='eligible'?'disabled':''} aria-label="Pilih ${safe(row.unit)}"></td><td><strong>${safe(row.unit)}</strong></td><td>Kategori ${safe(row.category)}</td><td>${safe(row.mainUsageDays)}</td><td>${safe(row.lastAnyEnd)}</td><td>${safe(row.nextEligible)}</td><td><span class="cooldown-state ${safe(row.status)}">${row.status==='reset'?'Selesai reset':'Layak reset'}</span></td>`;
      const checkbox=tr.querySelector('input');checkbox?.addEventListener('change',()=>{row.selected=checkbox.checked;updateCounts();});body.append(tr);
    }
    if(!visible.length){const tr=document.createElement('tr');tr.innerHTML='<td colspan="7" class="small muted">Tiada unit layak yang sepadan.</td>';body.append(tr);}
    updateCounts();
  }
  function updateCounts(){
    checkedCount.textContent=estimatedLocks?String(estimatedLocks):'—';eligibleCount.textContent=String(rows.filter(row=>row.status==='eligible').length);
    const selected=rows.filter(row=>row.status==='eligible'&&row.selected).length;selectedCount.textContent=String(selected);resetBtn.disabled=!selected;
    const visible=visibleRows().filter(row=>row.status==='eligible');selectAll.checked=visible.length>0&&visible.every(row=>row.selected);selectAll.indeterminate=visible.some(row=>row.selected)&&!selectAll.checked;
  }
  async function estimate(){
    estimateBtn.disabled=true;message.textContent='Mengira anggaran lock…';
    try{const result=await getCountFromServer(collection(window.__FIRESTORE,'overnightLocks'));estimatedLocks=result.data().count;checkedCount.textContent=String(estimatedLocks);message.textContent=`Anggaran muat: ${estimatedLocks} reads. Tekan Muat Senarai jika mahu meneruskan.`;loadBtn.disabled=false;}
    catch(error){message.textContent=error.code==='permission-denied'?'Akses ditolak. Akaun admin diperlukan.':'Anggaran tidak dapat dimuatkan.';}
    finally{estimateBtn.disabled=false;}
  }
  async function load(){
    const units=typeof window.__getDashboardUnits==='function'?window.__getDashboardUnits():{};
    if(!Object.keys(units).length){message.textContent='Data unit belum tersedia. Muat semula dashboard dan cuba lagi.';return;}
    loadBtn.disabled=true;resetBtn.disabled=true;message.textContent='Memuat counter cooldown…';rows=[];
    try{const snapshot=await getDocs(collection(window.__FIRESTORE,'overnightLocks')),today=todayKey();estimatedLocks=snapshot.size;let review=0;
      snapshot.forEach(item=>{const lock=item.data()||{},unit=unitKey(lock.unit||item.id.replace(/^unit-/,'')),category=categoryFromUnit(units[unit]),lastAnyEnd=malaysiaDate(lock.lastAnyEnd||lock.endDate);const result=cooldownResetEligibility({category,mainUsageDays:lock.mainUsageDays,lastAnyEnd,today});if(result.eligible)rows.push({unit,category,mainUsageDays:lock.mainUsageDays,lastAnyEnd,nextEligible:result.nextEligible,status:'eligible',selected:false});else if(result.reason==='incomplete'||result.reason==='category_unknown')review++;});
      rows.sort((a,b)=>a.unit.localeCompare(b.unit));reviewCount.textContent=String(review);message.textContent=`${rows.length} unit layak reset. Pilih unit atau gunakan Pilih semua yang dipaparkan.`;render();
    }catch(error){message.textContent=error.code==='permission-denied'?'Akses senarai ditolak. Log masuk semula sebagai admin.':'Counter tidak dapat dimuatkan.';}
    finally{loadBtn.disabled=false;}
  }
  async function resetOne(row,{emergency=false,reason=''}={}){
    const today=todayKey(),lockRef=doc(window.__FIRESTORE,'overnightLocks',`unit-${row.unit}`),unitRef=doc(window.__FIRESTORE,'units',row.unit),auditRef=doc(collection(window.__FIRESTORE,'audit'));
    return runTransaction(window.__FIRESTORE,async tx=>{const [lockSnap,unitSnap]=await Promise.all([tx.get(lockRef),tx.get(unitRef)]);if(!lockSnap.exists()||!unitSnap.exists())return 'skipped';const lock=lockSnap.data()||{},category=categoryFromUnit(unitSnap.data()||{}),lastAnyEnd=malaysiaDate(lock.lastAnyEnd||lock.endDate),result=cooldownResetEligibility({category,mainUsageDays:lock.mainUsageDays,lastAnyEnd,today}),days=Number(lock.mainUsageDays);const emergencyAllowed=emergency&&result.reason==='cooldown_active'&&[1,2].includes(category)&&Number.isInteger(days)&&days>0&&reason.trim().length>=3;if(!result.eligible&&!emergencyAllowed)return 'skipped';tx.update(lockRef,{parkingCategory:category,mainUsageDays:0,cycleStart:Timestamp.fromDate(new Date(`${today}T00:00:00+08:00`)),parkingReviewRequired:false,parkingReviewedAt:serverTimestamp(),parkingReviewedBy:adminUser.uid});tx.set(auditRef,{ts:serverTimestamp(),userId:adminUser.uid,userEmail:adminUser.email||'',unit:row.unit,field:'cooldown_counter',old:String(days),new:'0',action:emergencyAllowed?'emergency_cooldown_reset':'completed_cooldown_reset',notes:emergencyAllowed?reason.trim():'Cooldown lengkap'});return 'reset';});
  }
  async function resetSelected(){
    const selected=rows.filter(row=>row.status==='eligible'&&row.selected);if(!selected.length)return;
    if(!confirm(`Reset ${selected.length} counter yang dipilih? Setiap unit akan disahkan semula sebelum ditulis.`))return;
    resetBtn.disabled=true;loadBtn.disabled=true;let reset=0,skipped=0,failed=0;
    for(let offset=0;offset<selected.length;offset+=5){message.textContent=`Memproses ${Math.min(offset+5,selected.length)} daripada ${selected.length} unit…`;const group=selected.slice(offset,offset+5);const outcomes=await Promise.all(group.map(async row=>{try{return await resetOne(row);}catch{return 'failed';}}));outcomes.forEach((outcome,index)=>{const row=group[index];if(outcome==='reset'){row.status='reset';row.selected=false;reset++;}else if(outcome==='skipped'){row.selected=false;skipped++;}else failed++;});}
    message.textContent=`Selesai: ${reset} reset, ${skipped} dilangkau kerana keadaan berubah, ${failed} gagal.`;loadBtn.disabled=false;render();
  }
  estimateBtn.addEventListener('click',estimate);loadBtn.addEventListener('click',load);resetBtn.addEventListener('click',resetSelected);
  lookupBtn.addEventListener('click',lookupUnit);lookupInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();lookupUnit();}});
  search.addEventListener('input',render);categoryFilter.addEventListener('change',render);selectAll.addEventListener('change',()=>{for(const row of visibleRows())if(row.status==='eligible')row.selected=selectAll.checked;render();});
  onAuthStateChanged(window.__AUTH,async user=>{panel.hidden=true;adminUser=null;rows=[];if(!user||user.isAnonymous)return;try{const token=await user.getIdTokenResult();if(token.claims.admin!==true)return;adminUser=user;panel.hidden=false;}catch{/* Fail closed. */}});
}
