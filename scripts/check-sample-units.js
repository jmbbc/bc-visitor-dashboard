const admin = require('firebase-admin');
try { admin.initializeApp(); } catch(e) {}
const db = admin.firestore();
const ids = ['B2-9-5','B3-16-4','A-10-1'];
(async () => {
  for (const id of ids){
    const doc = await db.doc(`units/${id}`).get();
    console.log('---', id, 'exists:', doc.exists);
    if (doc.exists) console.log(doc.data());
  }
  process.exit(0);
})();