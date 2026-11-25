import {validUrl} from './notice-policy.mjs';
export const el = (tag, text, cls) => { const n=document.createElement(tag); if(text) n.textContent=text; if(cls) n.className=cls; return n; };
export function dateLabel(iso) { return iso ? new Intl.DateTimeFormat('ms-MY',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(iso)) : ''; }
export function noticeCard(n, detail = false, {summaryOnly=false} = {}) {
  const card=el('article',null,`notice-card ${n.pinned?'pinned':''}`);
  card.append(el('p',`${n.pinned?'PENTING · ':''}${n.category}`,'notice-tag'),el(detail?'h1':'h3',n.title));
  if(n.startsAt) card.append(el('p',dateLabel(n.startsAt),'notice-meta'));
  if(n.location) card.append(el('p',n.location,'notice-meta'));
  if(!summaryOnly && n.imageUrl && validUrl(n.imageUrl)) { const img=el('img'); img.src=n.imageUrl; img.alt=n.title; img.loading='lazy'; card.append(img); }
  const body=String(n.body||'').replace(/\s+/g,' ').trim(),max=summaryOnly?120:160;
  card.append(el('p',detail?n.body:body.slice(0,max)+(body.length>max?'…':''),'notice-body'));
  if(detail && n.attachmentUrl && validUrl(n.attachmentUrl)) { const a=el('a','Buka Lampiran','notice-link'); a.href=n.attachmentUrl; a.target='_blank'; a.rel='noopener'; card.append(a); }
  if(!detail && !summaryOnly) { const a=el('a','Lihat Butiran','notice-link'); a.href=`notices.html?id=${encodeURIComponent(n.id)}`; card.append(a); }
  return card;
}
