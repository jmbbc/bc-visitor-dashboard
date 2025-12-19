// scripts/find-by-plate.js
// Usage:
// 1) Put your Firebase service account JSON at project root as ./serviceAccount.json
// 2) npm i firebase-admin
// 3) node scripts/find-by-plate.js BNQ4466 B3-10-3

const admin = require('firebase-admin');
const fs = require('fs');

if (!fs.existsSync('./serviceAccount.json')) {
  console.error('Missing ./serviceAccount.json — place your key file at the project root and try again.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccount.json')) });
const db = admin.firestore();

const argv = process.argv.slice(2);
const plate = argv[0] || null;
const unit = argv[1] || null;

if (!plate && !unit) {
  console.log('Provide either a plate number or a unit to search (or both). Example: node scripts/find-by-plate.js BNQ4466 B3-10-3');
  process.exit(0);
}

async function find(plate, unit) {
  const matches = new Map(); // id -> doc

  async function pushSnap(snap) {
    snap.forEach(d => matches.set(d.id, d.data()));
  }

  if (plate) {
    console.log('Searching for vehicleNo ==', plate);
    const q1 = db.collection('responses').where('vehicleNo','==',plate);
    const snap1 = await q1.get(); await pushSnap(snap1);

    console.log('Searching for vehicleNumbers array-contains', plate);
    const q2 = db.collection('responses').where('vehicleNumbers','array-contains',plate);
    const snap2 = await q2.get(); await pushSnap(snap2);
  }

  if (unit) {
    console.log('Searching for hostUnit ==', unit);
    const q3 = db.collection('responses').where('hostUnit','==',unit);
    const snap3 = await q3.get(); await pushSnap(snap3);
  }

  console.log('\n--- Results ---');
  console.log('Found', matches.size, 'unique document(s)');
  for (const [id, data] of matches.entries()) {
    console.log('\nID:', id);
    console.log(JSON.stringify(data, null, 2));
  }
}

find(plate, unit).catch(err => { console.error('Search failed:', err); process.exit(2); });
