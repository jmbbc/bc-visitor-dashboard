const DAY_MS = 24 * 60 * 60 * 1000;

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isoWeekParts(value) {
  const source = asDate(value);
  if (!source) throw new TypeError('Tarikh pendaftaran tidak sah');
  const date = new Date(Date.UTC(source.getFullYear(), source.getMonth(), source.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / DAY_MS) + 1) / 7);
  return { year: String(date.getUTCFullYear()).slice(-2), week: String(week).padStart(2, '0') };
}

export function createRegistrationVerification(responseId, etaDate) {
  const id = String(responseId || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (id.length < 8) throw new TypeError('ID pendaftaran tidak sah');
  const parts = isoWeekParts(etaDate);
  const suffix = id.slice(-8);
  return `BC-${parts.year}W${parts.week}-${suffix}`;
}

// Sah hingga 11:59:59 malam pada hari selepas tarikh keluar.
export function verificationExpiryDate(etdDate) {
  const source = asDate(etdDate);
  if (!source) throw new TypeError('Tarikh keluar tidak sah');
  return new Date(source.getFullYear(), source.getMonth(), source.getDate() + 2, 0, 0, 0, 0);
}

export function normalizeVerificationCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function isVerificationCode(value) {
  return /^BC-\d{2}W\d{2}-[A-Z0-9]{8}$/.test(normalizeVerificationCode(value));
}
