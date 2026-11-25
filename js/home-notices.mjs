import {loadNotices} from './notice-store.mjs';

const list = document.getElementById('homeNoticeList');

try {
  const notices = (await loadNotices()).filter(notice => notice.id && notice.title).slice(0, 3);
  for (const notice of notices) {
    const row = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'service';
    link.href = 'notices.html?id=' + encodeURIComponent(notice.id);
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = notice.title;
    copy.append(title);
    const arrow = document.createElement('img');
    arrow.className = 'arrow';
    arrow.src = 'assets/home-chevron.svg';
    arrow.alt = '';
    link.append(copy, arrow);
    row.append(link);
    list.append(row);
  }
  list.closest('section').hidden = notices.length === 0;
} catch (error) {
  console.warn('Notis terkini tidak dapat dimuatkan.', error);
}
