import {validUrl} from './notice-policy.mjs';
export const el = (tag, text, cls) => { const n=document.createElement(tag); if(text) n.textContent=text; if(cls) n.className=cls; return n; };
export function dateLabel(iso) { return iso ? new Intl.DateTimeFormat('ms-MY',{dateStyle:'long',timeStyle:'short',timeZone:'Asia/Kuala_Lumpur'}).format(new Date(iso)) : ''; }
export function noticeImageUrl(value) {
  if (!value || !validUrl(value)) return '';
  const url = new URL(value);
  if (url.hostname !== 'drive.google.com') return value;
  const id = url.pathname.match(/^\/file\/d\/([\w-]+)(?:\/|$)/)?.[1] || url.searchParams.get('id');
  if (!id || !/^[\w-]+$/.test(id)) return value;
  const params = new URLSearchParams({ export: 'view', id });
  const resourceKey = url.searchParams.get('resourcekey');
  if (resourceKey) params.set('resourcekey', resourceKey);
  return 'https://drive.google.com/uc?' + params;
}

export function noticeCard(n, detail = false, {summaryOnly=false} = {}) {
  const card=el('article',null,`notice-card ${n.pinned?'pinned':''}`);
  card.append(el('p',`${n.pinned?'PENTING · ':''}${n.category}`,'notice-tag'),el(detail?'h1':'h3',n.title));
  if(n.startsAt) card.append(el('p',dateLabel(n.startsAt),'notice-meta'));
  if(n.location) card.append(el('p',n.location,'notice-meta'));
  const imageUrl = summaryOnly ? '' : noticeImageUrl(n.imageUrl);
  if (imageUrl) {
    const img = el('img');
    img.alt = n.title;
    img.loading = 'lazy';
    img.onerror = () => {
      const link = el('a', 'Buka Gambar', 'notice-link');
      link.href = n.imageUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      img.replaceWith(link);
    };
    img.src = imageUrl;
    card.append(img);
  }
  const body=String(n.body||'').replace(/\s+/g,' ').trim(),max=summaryOnly?120:160;
  card.append(el('p',detail?n.body:body.slice(0,max)+(body.length>max?'…':''),'notice-body'));
  if(detail && n.attachmentUrl && validUrl(n.attachmentUrl)) { const a=el('a','Buka Lampiran','notice-link'); a.href=n.attachmentUrl; a.target='_blank'; a.rel='noopener'; card.append(a); }
  if(!detail && !summaryOnly) { const a=el('a','Lihat Butiran','notice-link'); a.href=`notices.html?id=${encodeURIComponent(n.id)}`; card.append(a); }
  return card;
}
