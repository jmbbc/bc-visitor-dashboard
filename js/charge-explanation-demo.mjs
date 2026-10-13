import {explainParkingCharge, malaysiaDate} from './charge-explanation-model.mjs';
// Read-only admin tool; preview uses fixtures and never reads Firebase.
const params = new URLSearchParams(location.search);
const preview=params.get('preview')==='1';
if (!preview || params.get('page') === 'charges') {
  const fixtures = [
    {unit:'B1-3-2',id:'DEMO-101',plate:'VFS 1418',category:'Kategori 1',from:'2026-10-10',to:'2026-10-12',paid:5,reason:'Tiga hari percuma sudah digunakan pada 7–9 Oktober. Sambungan ini masih dalam kitaran sama; hari ke-4 hingga ke-6 dikenakan RM5 sehari.',days:[['10/10/2026','Hari ke-4','Kelayakan percuma sudah digunakan',5],['11/10/2026','Hari ke-5','Sambungan kitaran sama',5],['12/10/2026','Hari ke-6','Sambungan kitaran sama',5]]},
    {unit:'B1-3-2',id:'DEMO-100',plate:'VFS 1418',category:'Kategori 1',from:'2026-10-07',to:'2026-10-09',paid:0,reason:'Permohonan pertama dalam kitaran ini menggunakan tiga hari percuma.',days:[['07/10/2026','Hari pertama','Kelayakan percuma',0],['08/10/2026','Hari kedua','Kelayakan percuma',0],['09/10/2026','Hari ketiga','Kelayakan percuma',0]]},
    {unit:'A-10-01',id:'DEMO-201',plate:'WXY 5510',category:'Kategori 3',from:'2026-10-10',to:'2026-10-12',paid:45,reason:'Kategori 3 tidak mempunyai hari parkir percuma. Kenderaan utama dikenakan RM15 sehari.',days:[['10/10/2026','Hari pertama','Kadar Kategori 3',15],['11/10/2026','Hari kedua','Kadar Kategori 3',15],['12/10/2026','Hari ketiga','Kadar Kategori 3',15]]},
    {unit:'C-08-06',id:'DEMO-301',plate:'ABC 9081',category:'Kategori 2 · Kenderaan tambahan',from:'2026-10-11',to:'2026-10-12',paid:0,reason:'Kenderaan tambahan untuk unit Kategori 2 dikenakan RM15 sehari; kelayakan percuma kenderaan utama tidak terpakai.',days:[['11/10/2026','Kenderaan tambahan','RM15 sehari',15],['12/10/2026','Kenderaan tambahan','RM15 sehari',15]]},
    {unit:'D-12-03',id:'DEMO-401',plate:'JTU 3309',category:'Rekod lama',from:'2026-10-08',to:'2026-10-09',paid:null,reason:'Snapshot kategori dan pecahan caj tidak lengkap. Amaun dan sebab caj perlu disahkan oleh pengurusan.',days:[]}
  ];
  const money = n => n == null ? 'Belum disahkan' : 'RM' + n.toFixed(2);
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function init() {
    const page=document.getElementById('pageUnitSummary'); if(!page)return;
    const card=document.createElement('section'); card.className='card charge-demo';card.id='chargeExplanationDemo';
    card.innerHTML=`<div class="charge-demo-head"><div><span class="charge-demo-kicker">SEMAKAN MENGIKUT UNIT</span><h4>Semakan Caj Parkir</h4><p>Jejaki tarikh, kadar dan sebab caj bagi setiap pendaftaran.</p></div><span class="charge-demo-badge">MOCKUP · DATA CONTOH</span></div><form class="charge-demo-filter"><div><label for="chargeDemoUnit">Unit rumah</label><input id="chargeDemoUnit" value="B1-3-2" placeholder="Contoh: B1-3-2" list="chargeDemoUnits" autocomplete="off"><datalist id="chargeDemoUnits">${[...new Set(fixtures.map(r=>r.unit))].map(u=>`<option value="${u}"></option>`).join('')}</datalist></div><div><label for="chargeDemoFrom">Dari tarikh masuk</label><input id="chargeDemoFrom" type="date" value="2026-10-01"></div><div><label for="chargeDemoTo">Hingga tarikh masuk</label><input id="chargeDemoTo" type="date" value="2026-10-31"></div><button type="submit" class="btn">Semak Caj</button></form><div class="charge-demo-presets"><span>Cuba unit:</span>${['B1-3-2','A-10-01','C-08-06','D-12-03'].map(u=>`<button type="button" data-unit="${u}">${u}</button>`).join('')}</div><p class="charge-demo-disclaimer">Data simulasi sahaja. Tiada rekod sebenar dibaca atau diubah.</p><div id="chargeDemoResults" aria-live="polite"></div>`;
    const before=page.querySelector('.report-builder'); if(before)before.before(card);else page.append(card);
    const results=card.querySelector('#chargeDemoResults');let matches=[],selected='', requestNumber=0; const chargeCache=new Map();
    let sdk;
    async function staff() {
      const user=window.__AUTH?.currentUser;
      if(!user || (await user.getIdTokenResult()).claims.admin!==true)throw Error('Log masuk sebagai admin untuk semakan caj.');
      if(!window.__FIRESTORE)throw Error('Sambungan Firebase belum tersedia.');
      sdk ||= await import('https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js');
    }
    async function loadDetail() {
      const id=selected,token=++requestNumber;
      if(!preview){
        results.textContent='Memuat caj rasmi pendaftaran dipilih…';
        try{await staff();if(!chargeCache.has(id)){const snap=await sdk.getDoc(sdk.doc(window.__FIRESTORE,'parkingCharges',id));chargeCache.set(id,snap.exists()?snap.data():null)}if(token!==requestNumber)return;const index=matches.findIndex(x=>x.id===id);matches[index]={...explainParkingCharge(matches[index].record,chargeCache.get(id)),record:matches[index].record};}
        catch(e){if(token===requestNumber)results.textContent='Semakan caj gagal: '+e.message;return;}
      }
      renderDetail();
    }
    function renderDetail() {
      const r=matches.find(x=>x.id===selected);if(!r)return;
      const total=Object.hasOwn(r,'total')?r.total:(r.days.length?r.days.reduce((a,d)=>a+d[3],0):null);
      const balance=total==null||r.paid==null?null:Math.max(0,total-r.paid);
      const state=balance==null?'unknown':balance>0?'pending':'paid';
      results.innerHTML=`<div class="charge-demo-results-head"><strong>${esc(r.unit)} <small>· ${matches.length} pendaftaran</small></strong><label for="chargeDemoRecord">Pendaftaran <select id="chargeDemoRecord">${matches.map(x=>`<option value="${esc(x.id)}" ${x.id===r.id?'selected':''}>${esc(x.id)} · ${esc(x.from)} · ${esc(x.plate)}</option>`).join('')}</select></label></div><div class="charge-demo-metrics"><div><span>Jumlah caj</span><strong>${money(total)}</strong></div><div><span>Bayaran diterima</span><strong>${money(r.paid)}</strong></div><div class="charge-demo-${state}"><span>Baki bayaran</span><strong>${money(balance)}</strong></div></div><div class="charge-demo-context"><strong>${esc(r.plate)}</strong><span>${esc(r.category)}</span><span>${esc(r.from)} → ${esc(r.to)}</span></div><div class="charge-demo-reason"><strong>${balance==null?'Perlu semakan':'Kenapa dikenakan caj?'}</strong><p>${esc(r.reason)}</p></div>${r.days.length?`<div class="charge-demo-table-wrap"><table><thead><tr><th>Tarikh parkir</th><th>Penggunaan</th><th>Asas kiraan</th><th>Caj</th></tr></thead><tbody>${r.days.map(d=>`<tr><td>${d[0]}</td><td>${d[1]}</td><td>${d[2]}</td><td>${money(d[3])}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="3">Jumlah kiraan asal (${r.days.length} hari)</th><th>${money(r.days.reduce((n,d)=>n+d[3],0))}</th></tr></tfoot></table></div>`:''}<p class="charge-demo-footnote">${preview?'Kategori dan kadar ialah contoh snapshot ketika pendaftaran dibuat.':'Kategori dan kadar merujuk snapshot ketika pendaftaran dibuat.'} Jumlah hari berdasarkan pendaftaran, bukan pengesahan kehadiran.</p>`;
      results.querySelector('select').addEventListener('change',e=>{selected=e.target.value;loadDetail()});
    }
    async function search() {
      const unit=card.querySelector('#chargeDemoUnit').value.trim().toUpperCase().replace(/\s+/g,'');
      const from=card.querySelector('#chargeDemoFrom').value,to=card.querySelector('#chargeDemoTo').value;
      if(from&&to&&from>to){results.textContent='Tarikh mula mesti sebelum atau sama dengan tarikh akhir.';return;}
      if(!unit||!from||!to){results.textContent='Isi unit dan kedua-dua tarikh.';return;}
      if(Date.parse(to)-Date.parse(from)>92*86400000){results.textContent='Had carian 93 hari. Pilih tempoh lebih pendek.';return;}
      if(preview) matches=fixtures.filter(r=>r.unit===unit&&r.from>=from&&r.from<=to);
      else {
        const token=++requestNumber; const submit=card.querySelector('[type="submit"]');submit.disabled=true;results.textContent='Memuat sejarah satu unit (maksimum 201 bacaan rekod)…';
        try {await staff();const snap=await sdk.getDocs(sdk.query(sdk.collection(window.__FIRESTORE,'responses'),sdk.where('hostUnit','==',unit),sdk.limit(201)));
          if(token!==requestNumber)return;
          if(snap.size>200)throw Error('Sejarah unit melebihi 200 rekod. Semakan terhad dihentikan untuk mengelakkan laporan tidak lengkap.');
          matches=snap.docs.map(d=>({record:{...d.data(),id:d.id},id:d.id,from:malaysiaDate(d.data().eta),plate:(Array.isArray(d.data().vehicleNumbers)?d.data().vehicleNumbers:[d.data().vehicleNo]).filter(Boolean).join(', ')})).filter(r=>r.from>=from&&r.from<=to).sort((a,b)=>b.from.localeCompare(a.from));chargeCache.clear();
        }catch(e){if(token===requestNumber)results.textContent='Carian gagal: '+e.message;return;}finally{submit.disabled=false;}
      }
      if(!matches.length){results.textContent='Tiada pendaftaran untuk unit atau tempoh ini.';return;}
      selected=matches[0].id;loadDetail();
    }
    card.querySelector('form').addEventListener('submit',e=>{e.preventDefault();search()});
    card.querySelectorAll('[data-unit]').forEach(b=>b.addEventListener('click',()=>{card.querySelector('#chargeDemoUnit').value=b.dataset.unit;search()}));
    if(preview)search();
    else {
      card.querySelector('#chargeDemoUnit').value='';
      card.querySelector('.charge-demo-badge').textContent='ADMIN · BACAAN TERKAWAL';
      card.querySelector('.charge-demo-presets').remove();card.querySelector('datalist').remove();
      card.querySelector('.charge-demo-disclaimer').textContent='Baca sejarah satu unit sahaja (maks. 201 rekod). Caj rasmi dibaca apabila pendaftaran dipilih. Semak Caj semula untuk bayaran terkini.';
      const today=malaysiaDate(new Date());card.querySelector('#chargeDemoFrom').value=today.slice(0,8)+'01';card.querySelector('#chargeDemoTo').value=today;
      results.textContent='Masukkan unit dan tempoh, kemudian tekan Semak Caj.';
    }
    // Preview startup disables management actions; keep only this mockup interactive.
    if(preview) { const observer=new MutationObserver(()=>card.querySelectorAll('button').forEach(b=>{if(b.disabled)b.disabled=false}));observer.observe(card,{subtree:true,attributes:true,attributeFilter:['disabled']}); }
    if(preview)card.scrollIntoView({block:'start'});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,50));else setTimeout(init,50);
}