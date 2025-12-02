// scripts/cleanup-duplicates.js
// Usage (dry-run):
//   node scripts/cleanup-duplicates.js --limit 1000 --out clean-report.json --keep latest
// To actually delete (CAREFUL):
//   node scripts/cleanup-duplicates.js --limit 1000 --out clean-report.json --keep latest --apply
// Options:
//   --limit N      limit number of documents to scan (default: all)
//   --out FILE     write report JSON to FILE
//   --keep [latest|earliest]  which doc to keep in each duplicate group (default: latest)
//   --group KEY    only process a single dedupe key (format: YYYY-MM-DD|Unit|idPart)
//   --apply        actually delete duplicates (requires careful confirmation)

const admin = require('firebase-admin');
const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));

if (!fs.existsSync('./serviceAccount.json')) {
  console.error('Missing serviceAccount.json in repository root. Create one from your Firebase project settings and try again.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require('../serviceAccount.json')) });
const db = admin.firestore();

const limit = argv.limit ? parseInt(argv.limit, 10) : null;
const outFile = argv.out || null;
const keep = String(argv.keep || 'latest').toLowerCase();
const apply = Boolean(argv.apply);
const onlyGroup = argv.group || argv.g || null;

function isoDateOnlyKey(d) {
  if (!d) return null;
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2,'0');
  const dd = String(dt.getDate()).padStart(2,'0');
  return `${yy}-${mm}-${dd}`;
}

function normalizePhone(p) { return (p || '').replace(/[^0-9+]/g, ''); }
function nameKey(name) { if (!name) return ''; return String(name).trim().toLowerCase().replace(/\s+/g,'_').slice(0,64); }

async function scanAndPlan() {
  console.log('Scanning responses... (this may be slow for large collections)');
  let q = db.collection('responses').orderBy('createdAt', 'desc');
  if (limit) q = q.limit(limit);
  const snap = await q.get();
  console.log(`Fetched ${snap.size} documents`);

  const groups = new Map();
  snap.forEach(doc => {
    const d = doc.data();
    const dateKey = d.eta ? isoDateOnlyKey(d.eta.toDate ? d.eta.toDate() : d.eta) : (d.createdAt ? isoDateOnlyKey(d.createdAt.toDate ? d.createdAt.toDate() : d.createdAt) : null);
    const hostUnit = (d.hostUnit || '').replace(/\s+/g,'');
    const phone = normalizePhone(d.visitorPhone);
    const nKey = nameKey(d.visitorName);
    const key = `${dateKey || 'null'}|${hostUnit || 'null'}|${phone || nKey || 'noid'}`;
    if (onlyGroup && key !== onlyGroup) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({id: doc.id, data: d});
  });

  const duplicates = [];
  for (const [key, arr] of groups.entries()) {
    if (arr.length > 1) {
      // sort by createdAt ascending (oldest first)
      arr.sort((a,b) => {
        const at = a.data.createdAt && a.data.createdAt.toDate ? a.data.createdAt.toDate().getTime() : 0;
        const bt = b.data.createdAt && b.data.createdAt.toDate ? b.data.createdAt.toDate().getTime() : 0;
        return at - bt;
      });
      let keepDoc;
      if (keep === 'earliest') keepDoc = arr[0]; else keepDoc = arr[arr.length-1];
      const toDelete = arr.filter(x => x.id !== keepDoc.id).map(x => ({ id: x.id, createdAt: x.data.createdAt ? (x.data.createdAt.toDate ? x.data.createdAt.toDate().toISOString() : x.data.createdAt) : null }));
      duplicates.push({key, keep: keepDoc.id, keepCreatedAt: keepDoc.data.createdAt ? (keepDoc.data.createdAt.toDate ? keepDoc.data.createdAt.toDate().toISOString() : keepDoc.data.createdAt) : null, deleteCount: toDelete.length, deleteDocs: toDelete});
    }
  }

  // Summary
  const totalDupGroups = duplicates.length;
  const totalDocsToDelete = duplicates.reduce((s,g)=>s+g.deleteCount,0);
  console.log(`Found ${totalDupGroups} duplicate group(s); ${totalDocsToDelete} documents would be deleted (keep=${keep})`);
  if (totalDupGroups === 0) return { duplicates, totalDupGroups, totalDocsToDelete };

  // show sample
  duplicates.slice(0, 50).forEach((g, i) => {
    console.log(`\n[${i+1}] ${g.key} => keep ${g.keep} (createdAt=${g.keepCreatedAt}) delete ${g.deleteCount} ->`, g.deleteDocs.slice(0,10).map(d=>d.id).join(', '));
  });

  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify({fetched: snap.size, duplicates}, null, 2));
    console.log(`Wrote report to ${outFile}`);
  }

  return { duplicates, totalDupGroups, totalDocsToDelete };
}

async function performDeletes(duplicates) {
  if (!duplicates || duplicates.length===0) return {deleted:0};
  // collect ids to delete
  const ids = [];
  duplicates.forEach(g=> g.deleteDocs.forEach(d => ids.push(d.id)));
  console.log(`About to delete ${ids.length} documents (in batches).`);
  if (!apply) { console.log('Not applying deletes — run with --apply to actually delete.'); return {deleted:0}; }

  // delete in batches of 200
  const batchSize = 200;
  let deleted = 0;
  for (let i=0;i<ids.length;i+=batchSize) {
    const batch = db.batch();
    const chunk = ids.slice(i, i+batchSize);
    chunk.forEach(id => batch.delete(db.collection('responses').doc(id)));
    await batch.commit();
    deleted += chunk.length;
    console.log(`Deleted batch: ${i}..${i+chunk.length-1} (${chunk.length})`);
  }
  return { deleted };
}

(async function main(){
  try{
    const { duplicates, totalDupGroups, totalDocsToDelete } = await scanAndPlan();
    if (!duplicates || duplicates.length===0) { console.log('No duplicates to process.'); process.exit(0); }

    if (apply) {
      console.log('\n-- apply flag detected: performing deletes.');
      const res = await performDeletes(duplicates);
      console.log(`Deleted ${res.deleted} documents.`);
    } else {
      console.log('\nDry-run complete. No deletes performed. Re-run with --apply to actually delete duplicates.');
    }
    process.exit(0);
  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(2);
  }
})();
