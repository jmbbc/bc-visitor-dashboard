import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../js/dashboard.js',import.meta.url),'utf8');

test('data management navigation fails closed until admin claim is verified',()=>{
  assert.match(source,/let dashboardHasAdminClaim = false/);
  assert.match(source,/navUnitSummary\.hidden = !dashboardHasAdminClaim/);
  assert.match(source,/applyAdminPageAccess\(false\);\s*setAdminLoggedIn\(false\)/);
});

test('direct page request and click are both guarded by admin claim',()=>{
  assert.match(source,/if \(!DASHBOARD_PREVIEW_MODE && !dashboardHasAdminClaim\)/);
  assert.match(source,/if \(key === 'unitsummary' && !DASHBOARD_PREVIEW_MODE && !dashboardHasAdminClaim\)/);
});

test('non-overnight locks do not invalidate an admin-confirmed cooldown date',()=>{
  const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');
  assert.match(rules,/data\.stayOver != 'Yes' \|\| data\.lastAnyEnd >= data\.endDate/);
});
