export const categories = ['Acara', 'Penyelenggaraan', 'Makluman'];
export function validUrl(value) {
  if (!value) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}
export function validateNotice(n) {
  if (!n.title?.trim() || n.title.length > 140) throw Error('Tajuk wajib, maksimum 140 aksara.');
  if (!n.body?.trim() || n.body.length > 12000) throw Error('Kandungan wajib, maksimum 12,000 aksara.');
  if (!categories.includes(n.category)) throw Error('Kategori tidak sah.');
  if (!['draft', 'published'].includes(n.status)) throw Error('Status tidak sah.');
  if (!validUrl(n.imageUrl) || !validUrl(n.attachmentUrl)) throw Error('Pautan mesti menggunakan HTTPS.');
  if (n.inFeed && (n.category !== 'Acara' || !n.startsAt || !n.endsAt)) throw Error('Feed memerlukan acara dengan tarikh mula dan tamat.');
  if ((n.startsAt || n.endsAt) && (!n.startsAt || !n.endsAt || !Number.isFinite(Date.parse(n.startsAt)) || !Number.isFinite(Date.parse(n.endsAt)) || Date.parse(n.endsAt) < Date.parse(n.startsAt))) throw Error('Semak tarikh mula dan tamat.');
  return n;
}
export function upcoming(items, now = Date.now()) {
  return items.filter(n => n.status === 'published' && n.inFeed && n.category === 'Acara' && Date.parse(n.endsAt) > now)
    .sort((a,b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
export function matchesNotice(n, search, category) {
  return (!category || n.category === category) && `${n.title} ${n.body} ${n.location}`.toLocaleLowerCase('ms').includes(search.toLocaleLowerCase('ms'));
}
export function malaysiaInput(iso) { return iso ? new Date(Date.parse(iso) + 8*3600000).toISOString().slice(0,16) : ''; }
export function fromMalaysiaInput(value) { return value ? new Date(`${value}:00+08:00`).toISOString() : ''; }
