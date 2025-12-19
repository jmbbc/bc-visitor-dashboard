# Admin setup — Firestore rules & custom claims

This document explains how to allow the dashboard to read/write the `units` collection safely for admin users.

Recommended approach (secure):
1. Use Firebase Auth for admin users.
2. Add a custom claim `admin:true` to admin accounts.
3. Add Firestore rules that allow read/write on `units` only for authenticated users with the `admin` claim.

---

## Example Firestore rules
Copy this into your Firestore rules and deploy using Firebase console or `firebase deploy --only firestore:rules`.

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() { return request.auth != null && request.auth.token.admin == true; }

    // Allow read to units for everyone, and admin write/update/delete only
    match /units/{unitId} {
      allow get, list: if true;
      allow create, update, delete: if isAdmin();
    }

    // ... keep the rest of your rules unchanged for other collections
  }
}

---

## Setting the custom claim
Use the provided helper script `scripts/set-admin-claim.js` (requires `firebase-admin` and a service account).

1. Ensure you have a service account JSON and environment variable:

   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccount.json"

2. Install dependencies & run the script:

   npm install firebase-admin
   node scripts/set-admin-claim.js <FIREBASE_UID>

3. After you set the claim, the admin user must sign out and sign back in so the new token contains the custom claim.

---

If you prefer not to give client apps read permission, use server-side (Cloud Functions or admin scripts) to run imports/migrations.

---

## Local import script (no Blaze required)

If you don't want to enable Cloud Functions / Blaze, you can run a local import script that uses a service account to write to Firestore.

1. Ensure `GOOGLE_APPLICATION_CREDENTIALS` points to your service account JSON:

  ```powershell
  $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\serviceAccountKey.json'
  ```

2. Install dependencies (project root):

  ```powershell
  npm install
  ```

3. Run the import script (dry-run first to preview):

  ```powershell
  # preview parsed rows
  node scripts/import-units.js --file /path/to/units.csv --dry-run

  # commit to Firestore (requires explicit confirmation)
  node scripts/import-units.js --file /path/to/units.csv --yes
  ```

The script batches writes to `units/*` and sets `lastUpdatedBy` to your local username. This is a safe option that does not require switching plans.
