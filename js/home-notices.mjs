import {previewNotice} from './notice-preview.mjs';
import {noticeBannerUrl} from './notice-ui.mjs?v=4';
import {loadNotices} from './notice-store.mjs?v=pages-1';

const list = document.getElementById('homeNoticeList');
const section = list.closest('section');

function startCarousel(slides) {
  if (slides.length < 2) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const controls = document.createElement('div');
  controls.className = 'home-notice-controls';
  const position = document.createElement('span');
  const makeButton = (label, onClick) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  };
  let current = 0;
  let paused = reducedMotion.matches;
  let hovering = false;
  let timer;

  function schedule() {
    clearTimeout(timer);
    if (!paused && !hovering && !document.hidden && !section.contains(document.activeElement)) {
      timer = setTimeout(() => show(current + 1), 3000);
    }
  }
  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => { slide.hidden = i !== current; });
    position.textContent = (current + 1) + ' / ' + slides.length;
    schedule();
  }

  const pause = makeButton(paused ? 'Mainkan' : 'Jeda', () => {
    paused = !paused;
    pause.textContent = paused ? 'Mainkan' : 'Jeda';
    schedule();
  });
  controls.append(
    makeButton('Sebelumnya', () => show(current - 1)),
    position,
    makeButton('Seterusnya', () => show(current + 1)),
    pause,
  );
  section.append(controls);
  section.addEventListener('mouseenter', () => { hovering = true; schedule(); });
  section.addEventListener('mouseleave', () => { hovering = false; schedule(); });
  section.addEventListener('focusin', schedule);
  section.addEventListener('focusout', () => setTimeout(schedule, 0));
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', event => {
    if (event.matches) {
      paused = true;
      pause.textContent = 'Mainkan';
      schedule();
    }
  });
  show(0);
}

try {
  const preview = location.hostname === '127.0.0.1' && new URLSearchParams(location.search).get('preview') === '1';
  const rows = preview ? [previewNotice] : await loadNotices();
  const notices = rows.filter(notice => notice.id && notice.title).slice(0, 3);
  for (const notice of notices) {
    const row = document.createElement('li');
    const link = document.createElement('a');
    link.href = 'notices.html?id=' + encodeURIComponent(notice.id) + (preview ? '&preview=1' : '');
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = notice.title;
    copy.append(title);
    const arrow = document.createElement('img');
    arrow.className = 'arrow';
    arrow.src = 'assets/home-chevron.svg';
    arrow.alt = '';
    link.className = 'home-notice-feature';
    copy.className = 'home-notice-copy';
    const imageUrl = preview ? 'assets/community-gardening-event.png' : noticeBannerUrl(notice);
    if (imageUrl) {
      const image = document.createElement('img');
      image.className = 'home-notice-image';
      image.alt = '';
      let fallback = noticeBannerUrl(notice, {categoryOnly: true});
      if (fallback === imageUrl) fallback = '';
      image.addEventListener('error', () => {
        if (!fallback) {
          image.remove();
          return;
        }
        image.src = fallback;
        fallback = '';
      });
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
    row.append(link);
    list.append(row);
  }
  section.hidden = notices.length === 0;
  startCarousel([...list.children]);
} catch (error) {
  console.warn('Notis terkini tidak dapat dimuatkan.', error);
}
