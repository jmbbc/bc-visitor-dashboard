/* Build compact unit cooldown state from existing responses. Dry-run by default.
   Usage: GOOGLE_APPLICATION_CREDENTIALS=... node scripts/backfill-unit-parking-state.js
          GOOGLE_APPLICATION_CREDENTIALS=... node scripts/backfill-unit-parking-state.js --apply
   Existing responses and charges are never modified. */
const admin=require('firebase-admin');
const fs=require('node:fs');
const path=require('node:path');
const APPLY=process.argv.includes('--apply');
admin.initializeApp();
const db=admin.firestore();
const key=d=>`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
const date=v=>{const d=v?.toDate?v.toDate():new Date(v);return Number.isNaN(d.getTime())?null:new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));};
const category=(r,fallback)=>{const n=Number(r.unitArrearsAmount);return Number.isFinite(n)?(n<=1?1:n<=400?2:3):([1,2,3].includes(Number(r.unitCategory))?Number(r.unitCategory):fallback);};
const cancelled=r=>['rejected','cancelled','canceled','dibatalkan','ditolak'].includes(String(r.status||'').trim().toLowerCase());
function summarize(rows){
  rows.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id));
  let state=null; const reasons=new Set();
  for(const row of rows){
    if(!row.cat){reasons.add('missing_category');continue;}
    if(!state||row.start.getTime()>=state.lastAnyEnd.getTime()+4*86400000){state={category:row.cat,cycleStart:row.start,dates:new Set(),lastMainEnd:row.end,lastAnyEnd:row.anyEnd};}
    else {
      if(state.category!==row.cat)reasons.add('category_transition');
      // Historical overlaps share the unit's single main entitlement day. They
      // are deduplicated below and do not rewrite any historical charge.
      if(row.end>state.lastMainEnd)state.lastMainEnd=row.end;
      if(row.anyEnd>state.lastAnyEnd)state.lastAnyEnd=row.anyEnd;
    }
    for(let d=new Date(row.start);d<=row.end;d.setUTCDate(d.getUTCDate()+1))state.dates.add(key(d));
  }
  if(!state)return null;
  if(state.category!==3&&state.dates.size>30)reasons.add('cycle_over_30_days');
  return {review:reasons.size>0,reasons:[...reasons],state};
}
(async()=>{
  const [snapshot,unitSnapshot]=await Promise.all([db.collection('responses').get(),db.collection('units').get()]), units=new Map(), currentCategories=new Map();
  unitSnapshot.forEach(doc=>{const u=doc.data()||{},amount=Number(u.arrearsAmount),cat=Number.isFinite(amount)?(amount<=1?1:amount<=400?2:3):Number(u.category);if([1,2,3].includes(cat))currentCategories.set(String(doc.id).replace(/\s+/g,'').toUpperCase(),cat);});
  snapshot.forEach(doc=>{
    const r=doc.data(); if(r.category!=='Pelawat'||String(r.stayOver).toLowerCase()!=='yes'||cancelled(r))return;
    const unit=String(r.hostUnit||'').replace(/\s+/g,'').toUpperCase(),start=date(r.eta),end=date(r.etd)||start;
    if(!unit||!start||!end||end<start)return;
    let anyEnd=end;
    for(const v of Array.isArray(r.vehicleRowsDetailed)?r.vehicleRowsDetailed:[]){const e=date(v?.endDate);if(e&&e>anyEnd)anyEnd=e;}
    if(!units.has(unit))units.set(unit,[]);
    units.get(unit).push({id:doc.id,start,end,anyEnd,cat:category(r,currentCategories.get(unit)||null)});
  });
  const updates=[],review=[],reasonCounts={};
  for(const [unit,rows] of units){const result=summarize(rows);if(!result){reasonCounts.no_valid_category=(reasonCounts.no_valid_category||0)+1;continue;}if(result.review){review.push(unit);for(const reason of result.reasons)reasonCounts[reason]=(reasonCounts[reason]||0)+1;continue;}const s=result.state;
    updates.push({unit,data:{parkingCategory:s.category,cycleStart:admin.firestore.Timestamp.fromDate(s.cycleStart),mainUsageDays:s.dates.size,lastMainEnd:admin.firestore.Timestamp.fromDate(s.lastMainEnd),lastAnyEnd:admin.firestore.Timestamp.fromDate(s.lastAnyEnd),parkingPolicyVersion:'2026-09-08',parkingReviewRequired:false,parkingStateMigratedAt:admin.firestore.FieldValue.serverTimestamp()}});
  }
  if(APPLY){for(let i=0;i<updates.length;i+=400){const batch=db.batch();for(const u of updates.slice(i,i+400))batch.set(db.doc(`overnightLocks/unit-${u.unit}`),u.data,{merge:true});await batch.commit();}}
  const report={generatedAt:new Date().toISOString(),apply:APPLY,responsesRead:snapshot.size,unitDocsRead:unitSnapshot.size,unitsFound:units.size,unitsReady:updates.length,unitsRequiringReview:review.length,unitsWithoutUsableState:units.size-updates.length-review.length,reasonCounts,reviewUnits:review};
  const output=path.resolve('private-reports','unit-parking-state-backfill.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,reviewUnits:undefined}));
})().catch(error=>{console.error('Backfill failed:',error.code||error.message);process.exitCode=1;});
