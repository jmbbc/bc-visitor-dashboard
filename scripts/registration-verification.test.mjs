import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRegistrationVerification,verificationExpiryDate,isVerificationCode,isoWeekParts,normalizeVerificationCode} from '../js/registration-verification.mjs';

test('verification code is bound to the registration id and ETA ISO week',()=>{
  const code=createRegistrationVerification('resp-1789920000000-k7p4m2ab',new Date(2026,8,21));
  assert.equal(code,'BC-26W39-K7P4M2AB');
  assert.equal(isVerificationCode(code),true);
  assert.deepEqual(isoWeekParts(new Date(2026,8,21)),{year:'26',week:'39'});
});

test('Sunday submission does not expire a Monday arrival code',()=>{
  const expiry=verificationExpiryDate(new Date(2026,8,21));
  assert.equal(expiry.getFullYear(),2026);
  assert.equal(expiry.getMonth(),8);
  assert.equal(expiry.getDate(),23);
  assert.equal(expiry.getHours(),0);
});

test('normalization is safe for guard entry',()=>{
  assert.equal(normalizeVerificationCode(' bc-26w39-k7p4m2ab '),'BC-26W39-K7P4M2AB');
});

test('visitor, WhatsApp, dashboard and backward-compatible rules are wired',()=>{
  const visitor=readFileSync(new URL('../js/visitor.js',import.meta.url),'utf8');
  const dashboard=readFileSync(new URL('../js/dashboard.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');
  assert.match(visitor,/Kod Pengesahan Sistem:/);
  assert.match(visitor,/verificationCode/);
  assert.match(dashboard,/where\('verificationCode', '==', code\)/);
  assert.match(html,/id="verificationForm"/);
  assert.match(rules,/verificationCode\.matches/);
  assert.match(rules,/!\('verificationCode' in data\)/);
});
