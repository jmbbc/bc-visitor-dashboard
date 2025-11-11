<script type="module">
  // ===== REPLACE these values with your Firebase web app config =====
  // Get them from Firebase Console → Project settings → Your apps (Web)
  const firebaseConfig = {
    apiKey: "REPLACE_API_KEY",
    authDomain: "REPLACE_AUTH_DOMAIN",
    projectId: "REPLACE_PROJECT_ID",
    storageBucket: "REPLACE_STORAGE_BUCKET",
    messagingSenderId: "REPLACE_MESSAGING_SENDER_ID",
    appId: "REPLACE_APP_ID"
  };
  // ==================================================================

  import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
  import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
  import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

  window.__FIREBASE_APP = initializeApp(firebaseConfig);
  window.__FIRESTORE = getFirestore(window.__FIREBASE_APP);
  window.__AUTH = getAuth(window.__FIREBASE_APP);
</script>
