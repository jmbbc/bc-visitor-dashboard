#!/usr/bin/env node
/*
  scripts/import-units.js

  Usage:
    # set GOOGLE_APPLICATION_CREDENTIALS to your service account json file
    node scripts/import-units.js --file units.csv [--dry-run] [--batch-size 200] [--force]

    Notes:
      - `--dry-run` can be used without a service account and prints a validation report.
      - `--force` allows proceeding when problematic rows are detected.
      - `--annotate` will save the original CSV unit value into the target Firestore document (field: `originalUnit`).

  Notes:
    - `--dry-run` can be used without a service account and prints a validation report.
    - `--force` allows proceeding when problematic rows are detected.

  This script parses a CSV and writes rows to `units/{unitId}` using the
  Firebase Admin SDK (service account). It is intended for admin usage
  on a local machine and avoids needing Cloud Functions or changing the
  project's billing plan.
*/

const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const admin = require('firebase-admin');

function parseCSV(text){
  if (!text || !String(text).trim()) return [];
  const lines = String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l=>l.trim().length);
  function parseLine(line){
    const fields = []; let cur = ''; let inQ = false;
    for (let i=0;i<line.length;i++){ const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; continue; } inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { fields.push(cur); cur = ''; continue; }
      cur += ch;
    }
    fields.push(cur); return fields.map(f => String(f).trim());
  }
  function normalizeHeader(h){ if (!h) return ''; const s = String(h).trim().toLowerCase(); const compact = s.replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
    if (['unit','unitid','units','rumah'].includes(compact)) return 'unit';
    if (['amaun','amount','arrearsamount','amt','jumlah'].includes(compact)) return 'arrearsAmount';
    if (['category','kategori','kategoriunit'].includes(compact)) return 'category';
    if (['arrears','tunggakan'].includes(compact)) return 'arrears';
    return h.trim(); }

  const header = parseLine(lines[0]).map(normalizeHeader);
  const rows = [];
  for (let i=1;i<lines.length;i++){
    const parts = parseLine(lines[i]); if (!parts.length) continue; let obj = {};
    if (!header || header.length === 0 || header.every(h => !h)){
      if (parts.length >= 2) obj.unit = parts[0], obj.arrearsAmount = parts[1]; else continue;
    } else {
      for (let j=0;j<header.length;j++){ const key = header[j] || (`col${j}`); obj[key] = parts[j] || ''; }
    }

    // preserve row index for reporting
    obj._rowIndex = i;
    // keep original unit for audit/logging
    obj._originalUnit = obj.unit || '';
    // basic cleaning: trim and remove trailing dots/commas produced by export errors
    if (obj.unit) {
      let u = String(obj.unit).trim();
      // remove trailing dots and trailing commas
      u = u.replace(/[\.,\s]+$/g, '');
      obj.unit = u;
      obj._unitCleaned = (String(obj._originalUnit).trim() !== u);
    }

    // parse/clean arrearsAmount
    if (obj.arrearsAmount !== undefined && obj.arrearsAmount !== null && String(obj.arrearsAmount).trim() !== ''){
      const raw = String(obj.arrearsAmount);
      const n = Number(raw.replace(/[^0-9\-\.]/g,''));
      obj._rawArrearsAmount = raw;
      obj.arrearsAmount = Number.isFinite(n) ? n : null;
      if (obj.arrearsAmount === null) obj._problems = (obj._problems||[]).concat([`non-numeric arrearsAmount: "${raw}"`]);
    } else obj.arrearsAmount = null;

    // compute arrears boolean if not explicitly provided
    if (obj.arrears === undefined || obj.arrears === null || String(obj.arrears).trim() === '') obj.arrears = (typeof obj.arrearsAmount === 'number') ? (obj.arrearsAmount > 0) : false; else obj.arrears = String(obj.arrears).toLowerCase().trim() === 'true';

    // flag missing/empty unit
    if (!obj.unit || String(obj.unit).trim() === '') obj._problems = (obj._problems||[]).concat(['missing unit']);

    rows.push(obj);
  }
  return rows;
}

async function main(){
  const argv = minimist(process.argv.slice(2));
  const file = argv.file || argv.f;
  const dry = !!argv['dry-run'] || !!argv.dry;
  const batchSize = Number(argv['batch-size'] || argv.b || 200);
  const annotate = !!argv.annotate || !!argv.a;
  if (!file) { console.error('Usage: node scripts/import-units.js --file units.csv [--dry-run]'); process.exit(1); }
  const fp = path.resolve(process.cwd(), file);
  if (!fs.existsSync(fp)) { console.error('File not found:', fp); process.exit(1); }


  const text = fs.readFileSync(fp, 'utf8');
  const rows = parseCSV(text);
  console.log(`Parsed ${rows.length} rows from ${file}`);
  if (!rows.length) return;

  // build summary (duplicates, problems, cleaned)
  const unitCounts = {}; const duplicates = {};
  let cleanedCount = 0; let problemCount = 0;
  for (const r of rows){
    const id = (r.unit||'').trim();
    if (!unitCounts[id]) unitCounts[id] = 0;
    unitCounts[id]++;
    if (r._unitCleaned) cleanedCount++;
    if (r._problems && r._problems.length) problemCount++;
  }
  for (const k of Object.keys(unitCounts)) if (unitCounts[k] > 1) duplicates[k] = unitCounts[k];

  if (dry){
    console.log('Dry run summary:');
    console.log(`  rows: ${rows.length}`);
    console.log(`  unique units: ${Object.keys(unitCounts).length}`);
    console.log(`  duplicates: ${Object.keys(duplicates).length}`);
    console.log(`  annotate: ${annotate}`);
    if (Object.keys(duplicates).length) console.log('  sample duplicates:', Object.entries(duplicates).slice(0,20));
    console.log(`  cleaned unit ids: ${cleanedCount}`);
    console.log(`  problematic rows: ${problemCount}`);
    if (problemCount){
      console.log('Sample problematic rows:');
      console.log(rows.filter(r => r._problems && r._problems.length).slice(0,10));
    }
    if (cleanedCount){
      console.log('Sample cleaned units (original -> cleaned):');
      console.log(rows.filter(r => r._unitCleaned).slice(0,10).map(r => ({row: r._rowIndex, original: r._originalUnit, cleaned: r.unit})));
    }
    return;
  }

  // require explicit confirmation to proceed (prevent accidental import)
  const confirmed = !!argv.yes || !!argv.y || !!argv.confirm;
  const force = !!argv.force || !!argv.f;
  if (problemCount && !force){ console.log(`Found ${problemCount} problematic rows. Re-run with --force to proceed or fix CSV and retry.`); process.exit(1); }
  if (!confirmed) { console.log('Run without --dry-run requires confirmation. Re-run with --yes to perform import.'); process.exit(0); }
  if (annotate) console.log('Annotate enabled: original CSV unit value will be written to `originalUnit` for each row.');

  // initialize admin SDK (only required for actual import)
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS){ console.error('GOOGLE_APPLICATION_CREDENTIALS is not set. Set it to your service account JSON path and retry.'); process.exit(1); }
  try { admin.initializeApp(); } catch(e) { /* already init */ }
  const db = admin.firestore();

  let batch = db.batch(); let ops = 0; let committed = 0;
  for (const r of rows){
    const id = (r.unit || r.unitId || r.Unit || '').trim(); if (!id) continue;
    const docRef = db.doc(`units/${id}`);
    const payload = { category: (r.category||'').trim(), arrears: !!r.arrears, arrearsAmount: (typeof r.arrearsAmount === 'number') ? r.arrearsAmount : null, lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(), lastUpdatedBy: process.env.USER || process.env.USERNAME || 'import-script' };
    if (annotate) {
      // preserve the original CSV unit value for audit; don't overwrite an existing originalUnit if present
      payload.originalUnit = r._originalUnit || null;
    }
    batch.set(docRef, payload, { merge: true }); ops++;
    if (ops >= batchSize){ try { await batch.commit(); committed++; } catch(e){ console.error('batch commit failed', e); process.exit(1); } batch = db.batch(); ops = 0; }
  }
  if (ops > 0){ try { await batch.commit(); committed++; } catch(e){ console.error('final batch commit failed', e); process.exit(1); } }
  console.log(`Import complete. Batches committed: ${committed}`);
}

main().catch(err => { console.error('import-units err', err); process.exit(1); });
