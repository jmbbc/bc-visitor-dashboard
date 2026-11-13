function doPost(e) {
  let reply;
  try {
    const { requestId, entry } = JSON.parse(e.parameter.payload);
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if (typeof requestId !== 'string' || !uuid.test(requestId) ||
        typeof entry?.id !== 'string' || !uuid.test(entry.id)) {
      throw new Error('Invalid request');
    }
    reply = { type: 'counter-save', requestId, id: entry.id, ok: false };
    const result = savePagesEntry_(entry);
    reply.ok = result.id === entry.id;
  } catch (_) {
    // Return an unconfirmed result without exposing storage errors.
  }
  const message = JSON.stringify(reply || null).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<script>window.top.postMessage(' + message + ', "https://jmbbc.github.io");</script>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function savePagesEntry_(entry) {
  const d = entry.details;
  if (!d || typeof d !== 'object' || Array.isArray(d) ||
      Object.keys(d).length > 20 ||
      Object.values(d).some(value => typeof value !== 'string' || value.length > 500)) {
    throw new Error('Butiran tidak sah.');
  }

  const required = {
    ride: ['Nama pemandu', 'Tujuan', 'Perkhidmatan'],
    delivery: ['Jenis penghantaran'],
    resident: ['Nama penghuni', 'Nombor telefon', 'Sebab tiada kad'],
    office: ['Nama', 'Nombor telefon', 'Tujuan'],
    visitor: ['Nama', 'Nombor telefon'],
    service: ['Nama', 'Nombor telefon', 'Tujuan', 'Syarikat / Organisasi'],
    sales: ['Nama', 'Nombor telefon', 'Tujuan'],
    other: ['Nama', 'Nombor telefon', 'Tujuan', 'Lokasi dituju'],
  };
  const category = entry.category;
  const need = (...fields) => fields.every(field => d[field]?.trim());
  const unit = value => /^[A-Z0-9]+-\d+-\d+$/i.test(value || '');
  const utilityUnits = (d['Unit dituju'] || '').split(',').map(value => value.trim());

  if (typeof category !== 'string' || !Object.hasOwn(required, category) ||
      !need(...required[category]) ||
      (!need('Nombor kenderaan') && (category === 'ride' || d['Tanpa kenderaan'] !== 'Ya'))) {
    throw new Error('Medan wajib tidak lengkap.');
  }

  const validDestination = {
    ride: d['Lokasi menunggu'] === 'Lobi Blok A',
    delivery: d['Jenis penghantaran'] === 'Makanan' ? unit(d['Unit dituju']) :
      d['Jenis penghantaran'] === 'Bungkusan / Barang' &&
      (d['Bilangan rumah'] === 'Banyak rumah' ? d.Destinasi === 'Kawasan PG' :
        d['Bilangan rumah'] === 'Satu rumah' && unit(d['Unit dituju'])),
    resident: unit(d['Unit rumah']),
    office: d['Jenis urusan'] === 'Pejabat Pengurusan' && d['Lokasi dituju'] === 'Pejabat Pengurusan',
    visitor: unit(d['Unit dituju']),
    service: d.Destinasi === 'Pejabat Pengurusan' ||
      (d.Destinasi === 'Kawasan bersama' && need('Lokasi kerja')) ||
      (d.Destinasi === 'Satu unit' && utilityUnits.length === 1 && utilityUnits.every(unit)) ||
      (d.Destinasi === 'Beberapa unit' && utilityUnits.length >= 2 &&
        utilityUnits.every(unit) && new Set(utilityUnits).size === utilityUnits.length),
    sales: d.Destinasi === 'Pejabat Pengurusan',
    other: true,
  };
  if (!validDestination[category] || (category === 'service' &&
      (!['TNB', 'Air Selangor', 'Time', 'TM', 'Astro', 'Lain-lain'].includes(d['Syarikat / Organisasi']) ||
       (d['Syarikat / Organisasi'] === 'Lain-lain' && !need('Nama syarikat / organisasi'))))) {
    throw new Error('Butiran destinasi atau organisasi tidak sah.');
  }
  return saveCounterEntry_(entry);
}