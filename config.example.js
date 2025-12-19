// config.example.js
// Copy this file to config.local.js and update values before running dashboard locally.
// IMPORTANT: DO NOT commit config.local.js (it's added to .gitignore) — it may contain secrets.

window.__APP_CONFIG = window.__APP_CONFIG || {};
// Default admin password for local development. Change this in config.local.js in production.
window.__APP_CONFIG.adminPassword = 'admin';

// Optional: other runtime config can go here
