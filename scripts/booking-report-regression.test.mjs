import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const visitor = readFileSync(new URL('../js/visitor.js', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../js/dashboard.js', import.meta.url), 'utf8');

test('advance booking removes input maximum and obsolete submit restriction', () => {
  const start = visitor.indexOf('// Advance registration is allowed');
  const end = visitor.indexOf('function updateVehicleControlsForCategory', start);
  const input = {max: '2026-09-03', removeAttribute(key) { delete this[key]; }};
  vm.runInNewContext(visitor.slice(start, end), {
    etaEl: input, clientIsoDateOnlyKey: () => '2026-09-01', window: {}, Date
  });
  assert.equal(input.min, '2026-09-01');
  assert.equal(input.max, undefined);
  assert.ok(!visitor.includes('__VISITOR_FORM_MAX_DATE_KEY'));
});

test('visitor submission errors expose a phone-friendly reference code', () => {
  assert.match(visitor, /Kod rujukan: VF-QUOTA/);
  assert.match(visitor, /showSubmissionErrorSupport\('VF-QUOTA',message\)/);
  assert.match(visitor, /Salin Maklumat Ralat/);
  assert.match(visitor, /Hantar melalui WhatsApp/);
  assert.match(visitor, /https:\/\/wa\.me\/\?text=/);
  assert.match(visitor, /mockError'\)===\s*'1'/);
  assert.match(visitor, /paparan simulasi sahaja/);
});

async function fetchFixtureRows(records, overflow = false) {
  const start = dashboard.indexOf('const maxRows = 2000;');
  const end = dashboard.indexOf('weekResponseCache[weekKey] = rows;', start);
  assert.ok(start > 0 && end > start);
  const context = {
    from: new Date('2026-09-07'), to: new Date('2026-09-14'), col: {},
    Timestamp: {fromDate: d => d},
    where: (field, op, value) => ({field, op, value}),
    orderBy: () => ({}), limit: value => ({limit: value}),
    query: (_, ...filters) => filters,
    getDocs: async filters => {
      const matches = records.filter(r => filters.every(f => !f.field ||
        (f.op === '>=' ? r[f.field] >= f.value : r[f.field] < f.value)));
      return {size: overflow ? 2001 : matches.length,
        forEach: cb => matches.forEach(r => cb({id:r.id, data:() => r}))};
    }
  };
  return vm.runInNewContext(`(async () => { let rows; ${dashboard.slice(start, end)} return rows; })()`, context);
}

test('weekly retrieval includes long carry-over and deduplicates current arrivals', async () => {
  const rows = await fetchFixtureRows([
    {id:'long', eta:new Date('2026-09-01'), etd:new Date('2026-09-15')},
    {id:'current', eta:new Date('2026-09-08'), etd:new Date('2026-09-09')},
    {id:'legacy', eta:new Date('2026-09-10')},
    {id:'expired', eta:new Date('2026-09-01'), etd:new Date('2026-09-06')}
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows.filter(r => r.id === 'current').length, 1);
  assert.ok(rows.some(r => r.id === 'long'));
});

test('read ceiling fails explicitly rather than showing a truncated report', async () => {
  await assert.rejects(fetchFixtureRows([], true), /melebihi had bacaan/);
});

test('weekly usage alone does not label a unit as violating SOP', () => {
  assert.ok(!dashboard.includes('<span>Melebihi had</span>'));
  assert.ok(!dashboard.includes("tr.className = 'is-over-limit'"));
  assert.ok(dashboard.includes('Caj dan status pembayaran belum disahkan'));
});
