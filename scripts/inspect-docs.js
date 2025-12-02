// scripts/inspect-docs.js
// Usage: node scripts/inspect-docs.js resp-id-1 resp-id-2 ...

const admin = require('firebase-admin');
const fs = require('fs');

if (!fs.existsSync('./serviceAccount.json')) {
  console.error('Missing serviceAccount.json in repository root.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccount.json')) });
const db = admin.firestore();

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error('Pass at least one document id to inspect');
  process.exit(1);
}

(async function() {
  for (const id of ids) {
    try {
      const doc = await db.collection('responses').doc(id).get();
      if (!doc.exists) {
        console.log(`${id}: NOT FOUND`);
        continue;
      }
      const d = doc.data();
      // Print a concise view
      console.log('\n---', id, '---');
      console.log('hostUnit:', d.hostUnit);
      console.log('visitorName:', d.visitorName);
      console.log('visitorPhone:', d.visitorPhone);
      console.log('eta:', d.eta ? (d.eta.toDate ? d.eta.toDate().toISOString() : d.eta) : undefined);
      console.log('createdAt:', d.createdAt ? (d.createdAt.toDate ? d.createdAt.toDate().toISOString() : d.createdAt) : undefined);
      console.log('raw keys:', Object.keys(d).join(', '));
    } catch (e) {
      console.error('Error reading', id, e.message || e);
    }
  }
  process.exit(0);
})();
