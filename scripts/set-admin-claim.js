/*
  scripts/set-admin-claim.js

  Usage:
    1) Install firebase-admin in a node environment where you have service account access.
       npm install firebase-admin

    2) Set environment variable GOOGLE_APPLICATION_CREDENTIALS to point at your serviceAccount.json
       (or pass path to file in the code below)

    3) Run to set admin claim on a user UID:
       node scripts/set-admin-claim.js <uid>

  This script toggles the 'admin' custom claim on the specified user.
*/

const admin = require('firebase-admin');

if (!process.argv[2]) {
  console.error('Usage: node scripts/set-admin-claim.js <uid>');
  process.exit(1);
}

const uid = process.argv[2];

try {
  // initialize using default credentials (GOOGLE_APPLICATION_CREDENTIALS env var or ADC)
  admin.initializeApp();
} catch (e) {
  console.warn('Firebase admin already initialized');
}

async function main(){
  try {
    const user = await admin.auth().getUser(uid);
    const current = user.customClaims || {};
    const willSet = Object.assign({}, current, { admin: true });
    await admin.auth().setCustomUserClaims(uid, willSet);
    console.log(`Set admin claim for uid=${uid}. User now has claims:`, willSet);
    console.log('Tip: user must re-auth (login) to refresh token and apply claims in client.');
  } catch (err) {
    console.error('Failed to set admin claim:', err && err.message ? err.message : err);
  }
}

main();
