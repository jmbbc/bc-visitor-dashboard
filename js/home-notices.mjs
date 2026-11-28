import {previewNotice} from './notice-preview.mjs';
import {noticeBannerUrl,noticeImageUrl} from './notice-ui.mjs?v=6';
import {loadNotices} from './notice-store.mjs?v=pages-1';

const list = document.getElementById('homeNoticeList');
const section = list.closest('section');

function startCarousel(slides) {
  if (slides.length < 2) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let timer;
  const pagination = document.createElement('div');
  pagination.className = 'home-notice-dots';
  pagination.setAttribute('role', 'group');
  pagination.setAttribute('aria-label', 'Pilih notis');
  pagination.hidden = reducedMotion.matches;
  const counter = slides.length > 8 ? document.createElement('span') : null;
  if (counter) pagination.append(counter);
  const dots = counter ? [] : slides.map((_, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'Notis ' + (index + 1) + ' daripada ' + slides.length);
    button.addEventListener('click', () => show(index));
    pagination.append(button);
    return button;
  });
  const track = document.createElement('div');
  track.className = 'home-notice-track';
  list.before(track);
  track.append(list);
  const arrows = [-1, 1].map(direction => {
    const previous = direction < 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'home-notice-arrow ' + (previous ? 'previous' : 'next');
    button.setAttribute('aria-label', previous ? 'Notis sebelumnya' : 'Notis seterusnya');
    button.textContent = previous ? '‹' : '›';
    button.hidden = reducedMotion.matches;
    button.addEventListener('click', () => show(current + direction));
    track.append(button);
    return button;
  });
  section.append(pagination);

  function schedule() {
    clearTimeout(timer);
    if (!touchStart && !reducedMotion.matches && !document.hidden && !section.contains(document.activeElement)) {
      timer = setTimeout(() => show(current + 1), 3000);
    }
  }

  function show(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
      dots[i]?.setAttribute('aria-current', String(i === current));
    });
    if (counter) counter.textContent = 'Notis ' + (current + 1) + ' daripada ' + slides.length;
    schedule();
  }

  let touchStart;
  let lastSwipe = -Infinity;
  list.addEventListener('touchstart', event => {
    if (reducedMotion.matches || event.touches.length !== 1) {
      touchStart = undefined;
      return;
    }
    touchStart = event.touches[0];
    clearTimeout(timer);
  }, {passive: true});
  list.addEventListener('touchend', event => {
    const end = event.changedTouches[0];
    if (!touchStart || !end) return;
    const dx = end.clientX - touchStart.clientX;
    const dy = end.clientY - touchStart.clientY;
    touchStart = undefined;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      lastSwipe = performance.now();
      show(current + (dx < 0 ? 1 : -1));
    } else {
      schedule();
    }
  }, {passive: true});
  list.addEventListener('touchcancel', () => {
    touchStart = undefined;
    schedule();
  }, {passive: true});
  list.addEventListener('click', event => {
    if (event.detail && performance.now() - lastSwipe < 400) event.preventDefault();
  }, true);
  section.addEventListener('focusin', schedule);
  section.addEventListener('focusout', () => setTimeout(schedule, 0));
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', () => {
    pagination.hidden = reducedMotion.matches;
    arrows.forEach(button => { button.hidden = reducedMotion.matches; });
    if (reducedMotion.matches) {
      clearTimeout(timer);
      slides.forEach(slide => { slide.hidden = false; });
    } else {
      show(current);
    }
  });
  if (reducedMotion.matches) return;
  show(0);
}

try {
  const preview = location.hostname === '127.0.0.1' && new URLSearchParams(location.search).get('preview') === '1';
  const rows = preview ? [previewNotice] : await loadNotices();
  const notices = rows.filter(notice => notice.id && notice.title);
  const positions = new Map();
  const defaults = notices.map(notice => {
    const position = positions.get(notice.category) ?? 0;
    positions.set(notice.category, position + 1);
    return noticeBannerUrl(notice, {categoryOnly: true, position});
  });
  const imageKey = value => {
    const url = new URL(value, location.href);
    return url.origin + url.pathname + (url.hostname === 'drive.google.com' ? url.searchParams.get('id') : '');
  };
  const reserved = new Set(defaults.filter(Boolean).map(imageKey));
  const usedCustom = new Set();
  for (const [index, notice] of notices.entries()) {
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
    const custom = noticeImageUrl(notice.imageUrl);
    const key = custom ? imageKey(custom) : '';
    const useCustom = key && !usedCustom.has(key) &&
      (!reserved.has(key) || (defaults[index] && imageKey(defaults[index]) === key));
    if (useCustom) usedCustom.add(key);
    const imageUrl = preview ? 'assets/community-gardening-event.png' : useCustom ? custom : defaults[index];
    if (imageUrl) {
      const image = document.createElement('img');
      image.className = 'home-notice-image';
      image.alt = '';
      let fallback = defaults[index];
      if (fallback === imageUrl) fallback = '';
      image.addEventListener('error', () => {
        if (!fallback) {
          image.remove();
          return;
        }
        image.src = fallback;
        fallback = '';
      });
      if (index > 0) image.loading = 'lazy';
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
