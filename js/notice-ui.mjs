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

const categoryBanners = new Map([
  ['Acara', ['acara-gotong-royong.png', 'acara-jamuan.png', 'acara-sukan.jpg', 'acara-bengkel.jpg']],
  ['Makluman', ['makluman-papan-notis.png', 'makluman-kenderaan.png', 'makluman-kaunter.jpg', 'makluman-kemudahan.jpg']],
  ['Penyelenggaraan', ['penyelenggaraan-paip.png', 'penyelenggaraan-lampu.png', 'penyelenggaraan-lif.jpg', 'penyelenggaraan-landskap.jpg']],
]);
export function noticeBannerUrl(notice, {categoryOnly = false, position} = {}) {
  const custom = noticeImageUrl(notice.imageUrl);
  if (custom && !categoryOnly) return custom;
  const banners = categoryBanners.get(notice.category);
  if (!banners) return '';
  const key = String(notice.id || notice.title || '');
  const index = (position ?? [...key].reduce((sum, char) => sum + char.codePointAt(0), 0)) % banners.length;
  return 'assets/notice-banners/' + banners[index];
}

export function noticeCard(n, detail = false, {summaryOnly=false} = {}) {
  const card=el('article',null,`notice-card ${n.pinned?'pinned':''}`);
  card.append(el('p',`${n.pinned?'PENTING · ':''}${n.category}`,'notice-tag'),el(detail?'h1':'h3',n.title));
  if(n.startsAt) card.append(el('p',dateLabel(n.startsAt),'notice-meta'));
  if(n.location) card.append(el('p',n.location,'notice-meta'));
  const imageUrl = summaryOnly ? '' : noticeBannerUrl(n);
  if (imageUrl) {
    const img = el('img');
    img.alt = n.title;
    img.loading = 'lazy';
    let fallback = noticeBannerUrl(n, {categoryOnly: true});
    if (fallback === imageUrl) fallback = "";
    img.onerror = () => {
      if (fallback) {
        img.src = fallback;
        fallback = "";
        return;
      }
      const link = el('a', 'Buka Gambar', 'notice-link');
      link.href = noticeImageUrl(n.imageUrl) ? n.imageUrl : imageUrl;
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
