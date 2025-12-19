/*
  scripts/seed-cooldown-policy.js

  Seeds or updates the parking cooldown policy document used by the
  Cloud Function `createResponseWithDedupe`.

  Usage:
    1) Ensure firebase-admin is installed and GOOGLE_APPLICATION_CREDENTIALS
       points to your serviceAccount.json (or ADC is configured).
    2) Run:
       node scripts/seed-cooldown-policy.js

  Optional env overrides:
    ENABLED=true|false
    ARREARS_CD_DAYS=3
    HIGH_ARREARS_THRESHOLD=400
    HIGH_ARREARS_CD_DAYS=0
    NO_ARREARS_CD_DAYS=0
*/

const admin = require('firebase-admin');

try {
  admin.initializeApp();
} catch (e) {
  // already initialized
}

const db = admin.firestore();

async function main() {
  const enabled = (process.env.ENABLED || 'true').toLowerCase() !== 'false';
  const arrearsCooldownDays = Number(process.env.ARREARS_CD_DAYS || 3);
  const highArrearsThreshold = Number(process.env.HIGH_ARREARS_THRESHOLD || 400);
  const highArrearsCooldownDays = Number(process.env.HIGH_ARREARS_CD_DAYS || 0);
  const noArrearsCooldownDays = Number(process.env.NO_ARREARS_CD_DAYS || 0);

  const docRef = db.doc('parkingMeta/cooldownPolicy');
  const payload = {
    enabled,
    arrearsCooldownDays,
    highArrearsThreshold,
    highArrearsCooldownDays,
    noArrearsCooldownDays,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await docRef.set(payload, { merge: true });
  console.log('Seeded parkingMeta/cooldownPolicy with:', payload);
}

main().catch((err) => {
  console.error('Failed to seed cooldown policy:', err && err.message ? err.message : err);
  process.exit(1);
});
