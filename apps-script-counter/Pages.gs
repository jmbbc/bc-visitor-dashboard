function doPost(e) {
  let reply;
  try {
    const { requestId, entry, action, idToken } = JSON.parse(e.parameter.payload);
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if (action === 'counter-list') {
      if (typeof requestId !== 'string' || !uuid.test(requestId)) throw new Error('Invalid request');
      reply = { type: 'counter-list', requestId, ok: false };
      reply.rows = listTodayCounterEntries_(idToken);
      reply.ok = true;
    } else {
      if (typeof requestId !== 'string' || !uuid.test(requestId) ||
          typeof entry?.id !== 'string' || !uuid.test(entry.id)) {
        throw new Error('Invalid request');
      }
      reply = { type: 'counter-save', requestId, id: entry.id, ok: false };
      const result = savePagesEntry_(entry);
      reply.ok = result.id === entry.id;
    }
  } catch (error) {
    if (reply?.type === 'counter-list') {
      const codes = ['COUNTER_CONFIG', 'COUNTER_AUTH_SERVICE', 'COUNTER_STAFF'];
      reply.code = codes.includes(error.message) ? error.message : 'COUNTER_READ';
      console.warn('Counter read failed: ' + reply.code);
    }
  }
  const message = JSON.stringify(reply || null).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput(
    '<script>window.top.postMessage(' + message + ', "https://jmbbc.github.io");</script>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function counterFieldError(details) {
  const placeholder = /^(?:n[\s./-]*a|test(?:ing)?|ujian|dummy|sample|contoh|asdf|qwerty|xxx+|abc|saja|entah|random|tidak tahu|tak tahu)$/i;
  for (const label of ['Nama', 'Nama pemandu', 'Nama penghuni', 'Tujuan',
    'Lokasi dituju', 'Lokasi kerja', 'Syarikat / Organisasi', 'Nama syarikat / organisasi']) {
    if (!Object.hasOwn(details, label)) continue;
    const value = details[label].trim();
    if (!value && label === 'Syarikat / Organisasi') continue;
    if (placeholder.test(value) || !/\p{L}/u.test(value) || /^(.)\1{2,}$/u.test(value)) {
      return 'Isi ' + label + ' dengan maklumat sebenar.';
    }
  }
  if (Object.hasOwn(details, 'Nombor telefon')) {
    const phone = details['Nombor telefon'].trim().replace(/[\s()-]/g, '');
    if (!/^\+?\d{7,15}$/.test(phone) || /^(\d)\1+$/.test(phone.replace(/^\+/, ''))) {
      return 'Masukkan nombor telefon yang sah.';
    }
  }
  if (Object.hasOwn(details, 'Nombor kenderaan')) {
    const plate = details['Nombor kenderaan'].trim().replace(/[\s-]/g, '');
    if (!/^[A-Z0-9]{2,15}$/i.test(plate) || !/[A-Z]/i.test(plate) || !/\d/.test(plate)) {
      return 'Masukkan nombor pendaftaran kenderaan yang sah, contohnya VAB 2187.';
    }
  }
  return '';
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
    visitor: ['Nama', 'Nombor telefon', 'Tujuan'],
    service: ['Nama', 'Nombor telefon', 'Tujuan', 'Syarikat / Organisasi'],
    sales: ['Nama', 'Nombor telefon', 'Tujuan'],
    other: ['Nama', 'Nombor telefon', 'Tujuan', 'Lokasi dituju'],
  };
  const category = entry.category;
  const need = (...fields) => fields.every(field => d[field]?.trim());
  const unit = value => /^(?:A|B[123])-(?:G|\d+)-\d+$/i.test(value || '');
  const utilityUnits = (d['Unit dituju'] || '').split(',').map(value => value.trim());

  if (typeof category !== 'string' || !Object.hasOwn(required, category) ||
      !need(...required[category]) ||
      (!need('Nombor kenderaan') && (category === 'ride' || d['Tanpa kenderaan'] !== 'Ya'))) {
    throw new Error('Medan wajib tidak lengkap.');
  }

  const fieldError = counterFieldError(d);
  if (fieldError) throw new Error(fieldError);
  if (category === 'ride' &&
      (!['Ambil penumpang', 'Hantar penumpang'].includes(d.Tujuan) ||
       !['Grab', 'Teksi', 'Lain-lain'].includes(d.Perkhidmatan))) {
    throw new Error('Pilih tujuan dan perkhidmatan e-hailing yang tersedia.');
  }
  if (category === 'resident' &&
      !['Kad tertinggal', 'Kad hilang', 'Kad rosak', 'Belum menerima kad'].includes(d['Sebab tiada kad'])) {
    throw new Error('Pilih sebab tiada kad akses yang tersedia.');
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