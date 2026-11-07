const malaysiaDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function countdownLabel(eventDate, now = new Date()) {
  const parts = Object.fromEntries(malaysiaDate.formatToParts(now).map(p => [p.type, p.value]));
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const [year, month, day] = eventDate.split('-').map(Number);
  const remaining = Math.round((Date.UTC(year, month - 1, day) - today) / 86400000);
  if (!Number.isFinite(remaining)) return '';
  return remaining > 0 ? `${remaining} hari lagi` : remaining === 0 ? 'Hari ini' : 'Acara telah berlalu';
}

if (typeof document !== 'undefined') {
  const update = () => {
    for (const element of document.querySelectorAll('[data-notice-countdown]')) {
      element.textContent = countdownLabel(element.dataset.noticeCountdown);
      element.hidden = !element.textContent;
    }
  };
  update();
  setInterval(update, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
}
