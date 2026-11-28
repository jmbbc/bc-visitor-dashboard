function listTodayCounterEntries_(idToken) {
  const properties = PropertiesService.getScriptProperties();
  const apiKey = properties.getProperty('COUNTER_FIREBASE_API_KEY');
  const staff = (properties.getProperty('COUNTER_STAFF_UIDS') || '')
    .split(',').map(uid => uid.trim()).filter(Boolean);
  if (!apiKey || !staff.length) throw new Error('COUNTER_CONFIG');
  if (typeof idToken !== 'string' || idToken.length > 8192) {
    throw new Error('Akses ditolak.');
  }

  let response;
  try {
    response = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken }),
      muteHttpExceptions: true,
    }
    );
  } catch (_) {
    throw new Error('COUNTER_AUTH_SERVICE');
  }
  if (response.getResponseCode() !== 200) throw new Error('COUNTER_AUTH_SERVICE');
  const account = JSON.parse(response.getContentText()).users?.[0];
  if (!account || account.disabled || !staff.includes(account.localId)) {
    throw new Error('COUNTER_STAFF');
  }

  const sheet = SpreadsheetApp.openById(properties.getProperty('COUNTER_SPREADSHEET_ID'))
    .getSheetByName(COUNTER_SHEET);
  if (!sheet) throw new Error('Tab kaunter tidak dijumpai.');
  const count = sheet.getLastRow() - 1;
  if (count < 1) return [];

  const zone = 'Asia/Kuala_Lumpur';
  const today = Utilities.formatDate(new Date(), zone, 'yyyy-MM-dd');
  const rows = sheet.getRange(2, 1, count, COUNTER_COLUMNS.length).getValues();
  return rows.filter(([, time]) =>
    time instanceof Date && Utilities.formatDate(time, zone, 'yyyy-MM-dd') === today
  ).sort((a, b) => b[1] - a[1]).map(([id, time, category, , , json]) => {
    let details;
    try { details = JSON.parse(json) || {}; } catch (_) { details = {}; }
    return {
      id,
      details: Object.fromEntries([
        'Tujuan', 'Perkhidmatan', 'Jenis penghantaran', 'Bilangan rumah',
        'Sebab tiada kad', 'Jenis urusan', 'Syarikat / Organisasi',
        'Nama syarikat / organisasi', 'Lokasi kerja', 'Nombor telefon',
      ].filter(label => typeof details[label] === 'string' && details[label].trim())
        .map(label => [label, details[label].trim()])),
      enteredAt: time.toISOString(),
      category,
      name: details.Nama || details['Nama pemandu'] || details['Nama penghuni'] || '',
      destination: details['Unit dituju'] || details['Unit rumah'] ||
        details['Lokasi menunggu'] || details['Lokasi dituju'] ||
        details['Lokasi kerja'] || details.Destinasi || '',
      vehicle: details['Nombor kenderaan'] || '',
    };
  });
}
