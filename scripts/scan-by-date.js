// scripts/scan-by-date.js
// Usage: node scripts/scan-by-date.js 2025-11-28
// Scans the 'responses' collection for documents where eta or createdAt falls on the given date.

const admin = require('firebase-admin');
const fs = require('fs');

if (!fs.existsSync('./serviceAccount.json')) {
  console.error('Missing serviceAccount.json in repository root. Place your key there to run this script.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccount.json')) });
const db = admin.firestore();

const dateStr = process.argv[2];
if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
  console.error('Usage: node scripts/scan-by-date.js YYYY-MM-DD');
  process.exit(1);
}

function parseDateStart(d) { return new Date(`${d}T00:00:00Z`); }
function parseDateEnd(d) { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); return t; }

(async () => {
  try {
    const from = parseDateStart(dateStr);
    const to = parseDateEnd(dateStr);

    console.log('Scanning date:', dateStr, 'from', from.toISOString(), 'to', to.toISOString());

    // Query using eta (timestamps)
    const etaQ = db.collection('responses')
      .where('eta', '>=', from)
      .where('eta', '<', to)
      .orderBy('eta', 'asc')
      .limit(50);

    const etaSnap = await etaQ.get();
    console.log('eta query matched:', etaSnap.size);
    etaSnap.forEach(d => {
      const data = d.data();
      console.log('-', d.id, 'eta=', data.eta && data.eta.toDate ? data.eta.toDate().toISOString() : data.eta, 'createdAt=', data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt);
    });

    // Query using createdAt range
    const createdQ = db.collection('responses')
      .where('createdAt', '>=', from)
      .where('createdAt', '<', to)
      .orderBy('createdAt', 'asc')
      .limit(50);

    const createdSnap = await createdQ.get();
    console.log('createdAt query matched:', createdSnap.size);
    createdSnap.forEach(d => {
      const data = d.data();
      console.log('-', d.id, 'eta=', data.eta && data.eta.toDate ? data.eta.toDate().toISOString() : data.eta, 'createdAt=', data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt);
    });

    // if both counts are zero, scan a small recent set and try a loose match on strings
    if (etaSnap.size === 0 && createdSnap.size === 0) {
      console.log('No results from both eta and createdAt queries — attempting a small loose scan (recent docs)');
      const loose = await db.collection('responses').orderBy('createdAt','desc').limit(500).get();
      let matched = 0;
      loose.forEach(d => {
        const data = d.data();
        const tryParse = (v) => {
          if (!v) return null;
          if (v && v.toDate) return v.toDate();
          const parsed = new Date(v);
          return isNaN(parsed.getTime()) ? null : parsed;
        };
        const etaDt = tryParse(data.eta);
        const createdDt = tryParse(data.createdAt);
        const match = (etaDt && etaDt.toISOString().slice(0,10) === dateStr) || (createdDt && createdDt.toISOString().slice(0,10) === dateStr);
        if (match) {
          matched++;
          console.log('-', d.id, 'eta=', data.eta, 'createdAt=', data.createdAt);
        }
      });
      console.log('loose scan matched:', matched);
    }

    process.exit(0);
  } catch (err) {
    console.error('scan error', err.message || err);
    process.exit(2);
  }
})();
