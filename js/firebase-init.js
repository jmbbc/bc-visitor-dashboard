// js/firebase-init.js  (MODULE - plain JS, tiada <script> wrapper)
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

// expose to other modules via window so your visitor.js / dashboard.js can use
window.__FIREBASE_APP = app;
window.__FIRESTORE = db;
window.__AUTH = auth;
