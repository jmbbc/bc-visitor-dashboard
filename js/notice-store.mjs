// Public endpoint for the Apps Script web app attached to the Notis spreadsheet.
export const NOTICE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyt8tJAti-2ahVA7OmQyPUUt1Gv8GViyep08lHNYXdj8iC7eCHXoVHfQP6TBrX1ut-I/exec';

let callbackId = 0;
function requestNotices(params = {}) {
  return new Promise((resolve, reject) => {
    const callback = `__bcNoticeResponse${Date.now()}_${callbackId++}`;
    const script = document.createElement('script');
    const timeout = setTimeout(() => finish(new Error('Masa menunggu data notis tamat.')), 12000);
    function finish(error, value) {
      clearTimeout(timeout);
      delete window[callback];
      script.remove();
      error ? reject(error) : resolve(value);
    }
    window[callback] = result => {
      if (!result || result.ok !== true) return finish(new Error(result?.error || 'Notis belum dapat dimuatkan.'));
      finish(null, result.data);
    };
    const query = new URLSearchParams({...params, callback});
    script.onerror = () => finish(new Error('Sambungan kepada data notis gagal.'));
    script.src = `${NOTICE_SCRIPT_URL}?${query}`;
    document.head.append(script);
  });
}

export async function loadNotices(admin = false) {
  if (admin) throw new Error('Urus semua notis melalui halaman admin Apps Script.');
  const rows = await requestNotices();
  return rows.sort((a,b) => Date.parse(b.publishedAt || b.updatedAt || '') - Date.parse(a.publishedAt || a.updatedAt || ''));
}

export async function loadNotice(id) {
  if (!id) return null;
  return requestNotices({id});
}
