#!/usr/bin/env node
// scripts/report-unit-contacts.js
// Generate a report of unit contacts using units collection and responses collection.
// Usage: node scripts/report-unit-contacts.js [--out report.json] [--sample 20]

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

if (!fs.existsSync(path.resolve(__dirname, '..', 'serviceAccount.json'))) {
  console.error('Missing serviceAccount.json in repository root. Place service account JSON as serviceAccount.json');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccount.json')) });
const db = admin.firestore();

function normPhone(p){ return (p||'').replace(/[^0-9+]/g,'').trim(); }

async function loadStaticUnits(){
  try{
    const txt = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'units-list.js'), 'utf8');
    const m = txt.match(/window\.UNITS_STATIC\s*=\s*\[([\s\S]*?)\];/m);
    if (!m) return [];
    const inner = m[1];
    // crude parse: extract all quoted strings
    const ids = Array.from(inner.matchAll(/"([^"]+)"/g)).map(x => x[1]);
    return ids;
  } catch(e){ return []; }
}

(async function main(){
  const argv = require('minimist')(process.argv.slice(2));
  const out = argv.out || argv.o || `scripts/reports/unit-contacts-report-${new Date().toISOString().slice(0,10)}.json`;
  const sample = Number(argv.sample || argv.s || 20);
  try{
    const staticUnits = await loadStaticUnits();

    // load units collection
    const unitsSnap = await db.collection('units').get();
    const units = Object.create(null);
    unitsSnap.forEach(d => { units[d.id] = d.data(); });

    // load responses collection — we'll cap rows to avoid huge reads if needed
    const respSnap = await db.collection('responses').get();
    const responsesByUnit = Object.create(null);
    respSnap.forEach(d => {
      const r = d.data();
      const u = (r.hostUnit||'').trim();
      if (!u) return;
      responsesByUnit[u] = responsesByUnit[u] || [];
      // include a timestamp to pick latest
      const t = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().getTime() : (r.eta && r.eta.toDate ? r.eta.toDate().getTime() : 0);
      responsesByUnit[u].push(Object.assign({ _id: d.id, _ts: t }, r));
    });

    const allUnitsSet = new Set();
    staticUnits.forEach(u => u && allUnitsSet.add(u));
    Object.keys(units).forEach(u => u && allUnitsSet.add(u));
    Object.keys(responsesByUnit).forEach(u => u && allUnitsSet.add(u));

    const allUnits = Array.from(allUnitsSet).sort((a,b) => a.localeCompare(b));

    const report = { generatedAt: new Date().toISOString(), totals: {}, units: {} };
    let havePhoneInUnitDoc = 0;
    let haveNameOnlyInUnitDoc = 0;
    let havePhoneFromResponsesOnly = 0;
    let haveNeither = 0;

    for (const unitId of allUnits){
      const udoc = units[unitId] || {};
      const contacts = [];
      const add = (n,p,src) => { const np = normPhone(p); if (!n && !np) return; contacts.push({ name: (n||'').trim(), phone: (p||'').trim(), phoneNorm: np, src: src || 'unit' }); };
      add(udoc.ownerName || udoc.name || udoc.hostName, udoc.ownerPhone || udoc.phone || udoc.hostPhone, 'unit');
      add(udoc.contactName, udoc.contactPhone, 'unit');
      add(udoc.tenantName, udoc.tenantPhone, 'unit');

      // dedupe by normalized phone + name
      const seen = new Set();
      const deduped = [];
      for (const c of contacts){
        const key = `${(c.name||'').toLowerCase()}|${c.phoneNorm}`;
        if (seen.has(key)) continue; seen.add(key); deduped.push(c);
      }

      let source = 'unit';
      let finalContacts = deduped.slice();
      if (!finalContacts.length){
        // try responses
        const rows = responsesByUnit[unitId] || [];
        if (rows.length){
          // pick latest by ts
          rows.sort((a,b) => (b._ts || 0) - (a._ts || 0));
          rows.forEach(r => { if (r.hostName || r.hostPhone) finalContacts.push({ name: r.hostName || '', phone: r.hostPhone || '', phoneNorm: normPhone(r.hostPhone), src: 'responses', rowId: r._id }); });
          source = 'responses';
        }
      }

      const hasPhoneInUnit = deduped.some(c => c.phoneNorm);
      const hasPhoneFromResp = finalContacts.some(c => c.src === 'responses' && (c.phone || '').trim());
      const hasAnyPhone = finalContacts.some(c => c.phone || c.phoneNorm);
      const hasAnyName = finalContacts.some(c => c.name && c.name.trim());

      if (hasPhoneInUnit) havePhoneInUnitDoc++;
      else if (!hasPhoneInUnit && hasPhoneFromResp) havePhoneFromResponsesOnly++;
      else if (!hasAnyPhone && hasAnyName) haveNameOnlyInUnitDoc++;
      else if (!hasAnyPhone && !hasAnyName) haveNeither++;

      report.units[unitId] = { unitId, source, contacts: finalContacts.slice(0,5) };
    }

    report.totals.totalUnits = allUnits.length;
    report.totals.fromStaticList = staticUnits.length;
    report.totals.fromUnitsCollection = Object.keys(units).length;
    report.totals.fromResponses = Object.keys(responsesByUnit).length;
    report.totals.havePhoneInUnitDoc = havePhoneInUnitDoc;
    report.totals.havePhoneFromResponsesOnly = havePhoneFromResponsesOnly;
    report.totals.haveNameOnlyInUnitDoc = haveNameOnlyInUnitDoc;
    report.totals.haveNeither = haveNeither;

    // samples
    report.samples = {
      missingPhone: Object.keys(report.units).filter(k => { const u = report.units[k]; return !(u.contacts && u.contacts.some(c=>c.phone)); }).slice(0, sample),
      phoneFromResponsesOnly: Object.keys(report.units).filter(k => { const u = report.units[k]; return u.source === 'responses' && u.contacts && u.contacts.some(c=>c.phone); }).slice(0, sample),
    };

    // ensure reports dir exists
    const outDir = path.dirname(out);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');

    console.log('Report written to', out);
    console.log('Totals:', report.totals);
    console.log('Sample missing phone units (up to', sample, '):', report.samples.missingPhone);
    console.log('Sample units with phone from responses only (up to', sample, '):', report.samples.phoneFromResponsesOnly);
    process.exit(0);
  }catch(e){ console.error('Report failed', e); process.exit(1); }
})();
