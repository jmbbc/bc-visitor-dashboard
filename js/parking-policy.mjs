// Offline policy prototype. No Firebase/DOM dependencies; not wired to production.
export const POLICY_VERSION = 'draft-2026-09-08';
const DAY = 86400000;
function integer(value, min = 0) {
  if (!Number.isSafeInteger(value) || value < min) throw new Error('Invalid integer');
  return value;
}
function category(value) {
  if (![1, 2, 3].includes(value)) throw new Error('Invalid category');
  return value;
}
function epoch(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use YYYY-MM-DD');
  const time = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Invalid date');
  return time;
}
const iso = time => new Date(time).toISOString().slice(0, 10);
export function arrearsCategory(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) throw new Error('Invalid arrears');
  return amount <= 1 ? 1 : amount <= 400 ? 2 : 3;
}
export function datesInclusive(start, end) {
  const a = epoch(start), b = epoch(end);
  if (b < a || (b - a) / DAY > 3660) throw new Error('Invalid date range');
  return Array.from({ length: (b - a) / DAY + 1 }, (_, i) => iso(a + i * DAY));
}
export function dailyRateSen(cat, day, role = 'main') {
  category(cat); integer(day, 1);
  if (role === 'additional') return {1: 1000, 2: 1500, 3: 2500}[cat];
  if (role !== 'main') throw new Error('Invalid vehicle role');
  if (cat === 3) return 1500;
  const free = cat === 1 ? 3 : 1;
  const rate = Math.max(0, Math.ceil((day - free) / 3)) * 500;
  return cat === 1 ? Math.min(2000, rate) : rate;
}
// Caller supplies complete, canonical history for ONE vehicle in ONE cycle.
// This helper cannot establish unit eligibility or authorize category exceptions.
export function quoteSameCategory({cat, start, end, priorDates = [], role = 'main',
  previousCategory = cat, category3Exception = false}) {
  category(cat); category(previousCategory);
  if (previousCategory !== cat) throw new Error('Category transition requires review');
  if (typeof category3Exception !== 'boolean') throw new Error('Invalid exception');
  if (!['main', 'additional'].includes(role)) throw new Error('Invalid vehicle role');
  const requested = datesInclusive(start, end);
  if (requested.length > 30) throw new Error('Maximum 30 days per application');
  const prior = new Set(priorDates.map(d => { epoch(d); return d; }));
  if ([...prior].some(d => d > end)) throw new Error('Future history requires review');
  const all = [...new Set([...prior, ...requested])].sort();
  const lines = requested.map(date => ({date, day: all.indexOf(date) + 1,
    alreadyRegistered: prior.has(date),
    amountSen: prior.has(date) ? 0 : dailyRateSen(cat, all.indexOf(date) + 1, role)}));
  return {policyVersion: POLICY_VERSION, lines, totalSen: lines.reduce((n, r) => n + r.amountSen, 0), cycleDays: all.length};
}
// Input must cover ALL non-cancelled overnight vehicles for this unit.
export function nextFreeDate(registrations) {
  const ends = registrations.filter(r => !r.cancelled).map(r => {
    datesInclusive(r.start, r.end);
    return epoch(r.end);
  });
  return ends.length ? iso(Math.max(...ends) + 4 * DAY) : null;
}

// Review routing only, NOT an approval or a revised quote. Dates must already
// be Malaysia calendar dates. changeDate is the category update date, not the
// date an admin opens the review. Caller must recheck cycle eligibility when
// applying any adjustment. No inference about actual vehicle arrival is made.
export function assessCategoryChange({originalCategory, currentCategory, startDate, changeDate}) {
  category(originalCategory); category(currentCategory);
  const start = epoch(startDate), changed = epoch(changeDate);
  const timing = changed < start ? 'before_entry' : changed === start ? 'on_entry_date' : 'after_entry_date';
  const requiresReview = originalCategory !== currentCategory;
  return Object.freeze({
    policyVersion: POLICY_VERSION,
    originalCategory, currentCategory, startDate, changeDate, timing,
    requiresReview,
    status: requiresReview ? 'needs_review' : 'unchanged',
    reviewPath: !requiresReview ? 'none' : timing === 'after_entry_date'
      ? 'continuation_or_manual_adjustment' : 'whole_registration_adjustment',
    automaticChargeChange: false,
    automaticFreeDaysReset: false,
    preserveOriginalCharge: true,
    preservePayments: true,
    requiresCycleEligibilityCheck: requiresReview,
    requiresAdminReason: requiresReview
  });
}
