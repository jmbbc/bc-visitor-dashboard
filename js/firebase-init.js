// js/firebase-init.js (module)
// Inisialisasi Firebase dan pendedahan objek global untuk modul lain

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// ===== REPLACE these values with your Firebase web app config =====
const firebaseConfig = {
  apiKey: "AIzaSyDxN4OAFzzsQ9clUG9RqewWZ6hJ4HIWLMc",
  authDomain: "banjariavisitor.firebaseapp.com",
  projectId: "banjariavisitor",
  storageBucket: "banjariavisitor.firebasestorage.app",
  messagingSenderId: "82057315329",
  appId: "1:82057315329:web:7ad070a5a4fc6ecac82c00"
};
// ==================================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Expose to global so other modules (visitor.js, dashboard.js) can use them
window.__FIREBASE_APP = app;
window.__FIRESTORE = db;
window.__AUTH = auth;

// Debugging helpers: immediate console feedback
console.info('firebase-init: initialized app ->', !!app);
console.info('firebase-init: FIRESTORE ready ->', !!window.__FIRESTORE);
console.info('firebase-init: AUTH ready ->', !!window.__AUTH);

// Log auth state changes for easier troubleshooting
if (window.__AUTH && typeof window.__AUTH.onAuthStateChanged === 'function') {
  window.__AUTH.onAuthStateChanged(u => console.info('firebase-init: onAuthStateChanged ->', u ? (u.email || u.uid) : 'signed out'));
}
