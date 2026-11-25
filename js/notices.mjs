import {loadNotices,loadNotice} from './notice-store.mjs';
import {matchesNotice,upcoming} from './notice-policy.mjs';
import {noticeCard,noticeImageUrl,el} from './notice-ui.mjs?v=2';

const list=document.getElementById('noticeList');
const status=document.getElementById('noticeStatus');
const search=document.getElementById('noticeSearch');
const filters=document.getElementById('noticeCategories');
const featured=document.getElementById('featuredEvent');
const more=document.getElementById('noticeMore');
const latestHeading=document.getElementById('latestHeading');
let items=[],shown=10,activeCategory='';

const publishedDate=n=>n.publishedAt||n.updatedAt||n.startsAt||'';
const malaysiaDate=(value,options)=>value?new Intl.DateTimeFormat('ms-MY',{timeZone:'Asia/Kuala_Lumpur',...options}).format(new Date(value)):'';
const timeLabel=value=>value?malaysiaDate(value,{hour:'numeric',minute:'2-digit'}):'';

function renderEvent(n){
  featured.replaceChildren();
  if(!n){
    const empty=el('div',null,'event-empty');
    empty.append(el('strong','Acara akan datang'));
    empty.append(el('span','Tiada acara yang dijadualkan buat masa ini. Semak semula untuk perkembangan terkini.'));
    featured.append(empty);
    return;
  }
  const imageUrl=noticeImageUrl(n.imageUrl);
  const hasNoticeImage=Boolean(imageUrl);
  const card=el('article',null,`event-card${hasNoticeImage?'':' illustrative'}`);
  const image=el('img');
  image.className='event-image';
  image.src=hasNoticeImage?imageUrl:'assets/community-gardening-event.png';
  image.alt=hasNoticeImage?'Gambar untuk acara komuniti: '+n.title:'Gambar ilustrasi suasana taman komuniti';
  image.loading='lazy';
  image.onerror=()=>{image.hidden=true;};
  card.append(image);

  const content=el('div',null,'event-content');
  content.append(el('span','ACARA','event-tag'));
  content.append(el('h2',n.title));
  const meta=el('div',null,'event-meta');
  const dateRow=el('p');
  dateRow.append(el('span','TARIKH','meta-symbol'),el('span',malaysiaDate(n.startsAt,{day:'numeric',month:'long',year:'numeric'})));
  meta.append(dateRow);
  const timePlace=el('p');
  const time=[timeLabel(n.startsAt),timeLabel(n.endsAt)].filter(Boolean).join(' – ');
  timePlace.append(el('span','LOKASI','meta-symbol'),el('span',[time,n.location].filter(Boolean).join(' · ')||'Butiran lanjut akan dimaklumkan.'));
  meta.append(timePlace);
  content.append(meta);

  const summary=el('p',n.body.length>170?n.body.slice(0,167).trimEnd()+'…':n.body,'event-summary');
  const bottom=el('div',null,'event-bottom');
  bottom.append(summary);
  const link=el('a',null,'event-link');
  link.href=`notices.html?id=${encodeURIComponent(n.id)}`;
  link.append(document.createTextNode('Lihat Butiran '),el('span','›'));
  bottom.append(link);
  content.append(bottom);
  card.append(content);
  featured.append(card);
}

function renderNoticeRow(n){
  const a=el('a',null,'notice-row');
  a.href=`notices.html?id=${encodeURIComponent(n.id)}`;
  const date=publishedDate(n);
  const dateBox=el('span',null,'row-date');
  dateBox.append(el('strong',malaysiaDate(date,{day:'2-digit'})||'—'));
  dateBox.append(el('span',malaysiaDate(date,{month:'short'}).replace('.','')||'NOTIS'));
  a.append(dateBox);

  const content=el('span',null,'row-content');
  const label=n.pinned?'PENTING':n.category.toLocaleUpperCase('ms');
  const tagClass=`notice-tag ${n.pinned?'important':n.category==='Penyelenggaraan'?'maintenance':''}`.trim();
  content.append(el('span',label,tagClass));
  content.append(el('h3',n.title));
  const summary=n.category==='Acara'&&n.startsAt?`${timeLabel(n.startsAt)}${n.endsAt?' – '+timeLabel(n.endsAt):''}${n.location?' · '+n.location:''}`:n.body;
  content.append(el('p',summary.length>96?summary.slice(0,93).trimEnd()+'…':summary));
  a.append(content,el('span','›','row-arrow'));
  return a;
}

function render(){
  const query=search.value.trim();
  const matched=items.filter(n=>matchesNotice(n,query,activeCategory));
  const next=upcoming(items).find(n=>matchesNotice(n,query,activeCategory));
  const showFeature=!activeCategory||activeCategory==='Acara';
  featured.hidden=!showFeature;
  if(showFeature)renderEvent(next);
  const rows=matched.filter(n=>!next||n.id!==next.id).sort((a,b)=>{
    const pin=Number(Boolean(b.pinned))-Number(Boolean(a.pinned));
    return pin||Date.parse(publishedDate(b)||0)-Date.parse(publishedDate(a)||0);
  });
  list.replaceChildren(...rows.slice(0,shown).map(renderNoticeRow));
  if(!rows.length){
    const empty=el('p',matched.length?'Acara ini dipaparkan di bahagian acara akan datang.':'Tiada notis sepadan dengan carian anda.','list-empty');
    list.append(empty);
  }
  status.textContent=items.length?`${Math.min(shown,rows.length)} daripada ${rows.length} notis`:'Belum ada notis diterbitkan.';
  status.classList.add('sr-only');
  more.hidden=shown>=rows.length;
}

filters.addEventListener('click',event=>{
  const button=event.target.closest('button[data-category]');
  if(!button)return;
  activeCategory=button.dataset.category;
  for(const item of filters.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item===button));
  shown=10;
  render();
});
search.addEventListener('input',()=>{shown=10;render();});
more.addEventListener('click',()=>{shown+=10;render();});

try{
  const id=new URLSearchParams(location.search).get('id');
  if(id){
    document.getElementById('noticeFilters').hidden=true;
    featured.hidden=true;
    latestHeading.hidden=true;
    more.hidden=true;
    status.textContent='';
    const n=await loadNotice(id);
    if(n){list.append(noticeCard(n,true));document.title=`${n.title} — Banjaria Court`;}
    else status.textContent='Notis tidak ditemui.';
  }else{
    items=await loadNotices();
    render();
  }
}catch{
  status.textContent='Notis belum dapat dimuatkan. Sila cuba semula.';
  status.classList.remove('sr-only');
  const retry=el('button','Cuba Semula','older-button');
  retry.onclick=()=>location.reload();
  list.append(retry);
}
