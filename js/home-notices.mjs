import {previewNotice} from './notice-preview.mjs';
import {noticeBannerUrl} from './notice-ui.mjs?v=3';
import {loadNotices} from './notice-store.mjs';

const list = document.getElementById('homeNoticeList');

try {
  const preview = location.hostname === '127.0.0.1' && new URLSearchParams(location.search).get('preview') === '1';
  const rows = preview ? [previewNotice] : await loadNotices();
  const notices = rows.filter(notice => notice.id && notice.title).slice(0, 3);
  for (const [index, notice] of notices.entries()) {
    const row = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'service';
    link.href = 'notices.html?id=' + encodeURIComponent(notice.id) + (preview ? '&preview=1' : '');
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = notice.title;
    copy.append(title);
    const arrow = document.createElement('img');
    arrow.className = 'arrow';
    arrow.src = 'assets/home-chevron.svg';
    arrow.alt = '';
    if (index === 0) {
      link.className = 'home-notice-feature';
      copy.className = 'home-notice-copy';
      const imageUrl = preview ? 'assets/community-gardening-event.png' : noticeBannerUrl(notice);
      if (imageUrl) {
        const image = document.createElement('img');
        image.className = 'home-notice-image';
        image.alt = '';
        image.addEventListener('error', () => image.remove(), {once: true});
        image.src = imageUrl;
        link.append(image);
      }
      const summary = String(notice.body || '').replace(/\s+/g, ' ').trim();
      if (summary) {
        const excerpt = document.createElement('span');
        excerpt.className = 'home-notice-excerpt';
        excerpt.textContent = summary.length > 120 ? summary.slice(0, 117).trimEnd() + '…' : summary;
        copy.append(excerpt);
      }
      const action = document.createElement('span');
      action.className = 'home-notice-action';
      action.append('Lihat Butiran', arrow);
      copy.append(action);
      link.append(copy);
    } else {
      link.append(copy, arrow);
    }
    row.append(link);
    list.append(row);
  }
  list.closest('section').hidden = notices.length === 0;
} catch (error) {
  console.warn('Notis terkini tidak dapat dimuatkan.', error);
}
