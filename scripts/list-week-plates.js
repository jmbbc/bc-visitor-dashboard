import fs from 'fs';
import admin from 'firebase-admin';

// Date range for the requested week (inclusive start, exclusive end)
const START = new Date('2025-12-15');
const END = new Date('2025-12-22');

// Load service account
const svcPath = new URL('../serviceAccount.json', import.meta.url);
const svc = JSON.parse(await fs.promises.readFile(svcPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(svc) });
const db = admin.firestore();

const isPelawat = (r) => (r.category || '').toLowerCase() === 'pelawat';
const isStayOver = (r) => (r.stayOver || '').toLowerCase() === 'yes';

const collectPlates = (r) => {
  const vals = [];
  if (r.vehicleNo) vals.push(String(r.vehicleNo));
  if (Array.isArray(r.vehicleNumbers)) vals.push(...r.vehicleNumbers.map(String));
  else if (typeof r.vehicleNumbers === 'string' && !r.vehicleNo) vals.push(String(r.vehicleNumbers));
  return vals.map((p) => p.trim()).filter(Boolean);
};

const snap = await db
  .collection('responses')
  .where('eta', '>=', START)
  .where('eta', '<', END)
  .get();

const plates = new Set();
const details = [];
snap.forEach((doc) => {
  const r = doc.data();
  if (!isPelawat(r) || !isStayOver(r)) return;
  const entryPlates = collectPlates(r);
  entryPlates.forEach((p) => plates.add(p));
  // capture details for Ahh 1225 (case-insensitive match)
  const match = entryPlates.some((p) => p.trim().toLowerCase() === 'ahh 1225'.toLowerCase());
  if (match) {
    details.push({
      id: doc.id,
      eta: r.eta && r.eta.toDate ? r.eta.toDate() : r.eta,
      etd: r.etd && r.etd.toDate ? r.etd.toDate() : r.etd,
      hostUnit: r.hostUnit || '',
      plates: entryPlates
    });
  }
});

const list = [...plates].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
console.log(JSON.stringify(list, null, 2));
console.log('\nDetails for Ahh 1225:');
console.log(JSON.stringify(details, null, 2));
process.exit(0);
