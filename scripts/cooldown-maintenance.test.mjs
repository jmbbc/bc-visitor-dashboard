import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {categoryFromUnit, cooldownResetEligibility} from '../js/cooldown-maintenance-policy.mjs';

const root = new URL('../', import.meta.url);

test('kategori unit menggunakan nilai tunggakan semasa', () => {
  assert.equal(categoryFromUnit({arrearsAmount: 1}), 1);
  assert.equal(categoryFromUnit({arrearsAmount: 1.01}), 2);
  assert.equal(categoryFromUnit({arrearsAmount: 400}), 2);
  assert.equal(categoryFromUnit({arrearsAmount: 400.01}), 3);
});

test('counter Kategori 1 dan 2 hanya layak selepas tiga hari cooldown lengkap', () => {
  const input = {mainUsageDays: 3, lastAnyEnd: '2026-09-11'};
  assert.deepEqual(
    cooldownResetEligibility({...input, category: 1, today: '2026-09-14'}),
    {eligible: false, reason: 'cooldown_active', nextEligible: '2026-09-15'}
  );
  assert.deepEqual(
    cooldownResetEligibility({...input, category: 2, today: '2026-09-15'}),
    {eligible: true, reason: 'cooldown_complete', nextEligible: '2026-09-15'}
  );
});

test('counter kosong dan Kategori 3 tidak ditawarkan untuk reset', () => {
  assert.equal(cooldownResetEligibility({category: 1, mainUsageDays: 0, lastAnyEnd: '2026-09-11', today: '2026-09-15'}).reason, 'already_reset');
  assert.equal(cooldownResetEligibility({category: 3, mainUsageDays: 12, lastAnyEnd: '2026-09-11', today: '2026-09-15'}).reason, 'category_3');
});

test('panel, semakan transaksi dan kebenaran admin disambungkan', () => {
  const html = readFileSync(new URL('dashboard.html', root), 'utf8');
  const module = readFileSync(new URL('js/dashboard-cooldown-maintenance.mjs', root), 'utf8');
  const rules = readFileSync(new URL('firestore.rules', root), 'utf8');
  assert.match(html, /id="cooldownMaintenancePanel"/);
  assert.match(html, /dashboard-cooldown-maintenance\.mjs/);
  assert.match(module, /token\.claims\.admin!==true/);
  assert.match(module, /runTransaction/);
  assert.match(module, /tx\.get\(lockRef\)/);
  assert.match(module, /tx\.get\(unitRef\)/);
  assert.match(module, /parkingReviewedAt:serverTimestamp\(\)/);
  assert.doesNotMatch(module, /counterReset(?:At|By|Reason)/);
  assert.match(rules, /match \/overnightLocks\/\{lockId\}[\s\S]*?allow list: if isAdmin\(\);/);
});
