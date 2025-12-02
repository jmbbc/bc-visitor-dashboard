// scripts/find-duplicates.js
// Usage:
// 1) Place your Firebase service account JSON at the project root: ./serviceAccount.json
// 2) npm i firebase-admin minimist
// 3) node scripts/find-duplicates.js [--limit N] [--out file.json]

const admin = require('firebase-admin');
const fs = require('fs');

if (!fs.existsSync('./serviceAccount.json')) {
  console.error('Missing serviceAccount.json in repository root. Create one from your Firebase project settings and try again.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccount.json')) });
const db = admin.firestore();

const argv = require('minimist')(process.argv.slice(2));
const limit = argv.limit ? parseInt(argv.limit, 10) : null; // optional read limit
const outFile = argv.out || argv.o || null;

function isoDateOnlyKey(d) {
  if (!d) return null;
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2,'0');
  const dd = String(dt.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}

function normalizePhone(p) {
  return (p || '').replace(/[^0-9+]/g, '');
}

function nameKey(name) {
  if (!name) return '';
  return String(name).trim().toLowerCase().replace(/\s+/g, '_').slice(0,64);
}

async function scanResponses() {
  console.log('Scanning responses collection (this may take a while for large datasets)');
  let q = db.collection('responses').orderBy('createdAt', 'desc');
  if (limit) q = q.limit(limit);

  const snapshot = await q.get();
  console.log(`Fetched ${snapshot.size} documents`);

  const groups = new Map();

  snapshot.forEach(doc => {
    const d = doc.data();
    // server-side dedupe uses ETA date (payload.eta) to derive dateKey
    const dateKey = d.eta ? isoDateOnlyKey(d.eta.toDate ? d.eta.toDate() : d.eta) : (d.createdAt ? isoDateOnlyKey(d.createdAt.toDate ? d.createdAt.toDate() : d.createdAt) : null);
    const hostUnit = (d.hostUnit || '').replace(/\s+/g,'');
    const phone = normalizePhone(d.visitorPhone);
    const nKey = nameKey(d.visitorName);
    const dedupeFingerprint = `${dateKey || 'null'}|${hostUnit || 'null'}|${phone || nKey || 'noid'}`;

    if (!groups.has(dedupeFingerprint)) groups.set(dedupeFingerprint, []);
    groups.get(dedupeFingerprint).push({ id: doc.id, data: d });
  });

  // filter duplicates
  const duplicates = [];
  for (const [key, arr] of groups.entries()) {
    if (arr.length > 1) duplicates.push({ key, count: arr.length, docs: arr.map(x => x.id) });
  }

  console.log(`Found ${duplicates.length} duplicate group(s)`);
  if (duplicates.length) {
    duplicates.slice(0, 200).forEach((g, i) => {
      console.log(`\n[${i+1}] key=${g.key} count=${g.count}`);
      console.log('  docs:', g.docs.slice(0,10).join(', '));
    });
  }

  if (outFile) {
    const out = { fetched: snapshot.size, duplicates };
    fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
    console.log(`Wrote results to ${outFile}`);
  }

  return duplicates;
}

scanResponses().then(() => process.exit(0)).catch(err => {
  console.error('Error scanning responses:', err);
  process.exit(2);
});
