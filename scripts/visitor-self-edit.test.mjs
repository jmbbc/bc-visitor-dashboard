import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('successful registration exposes a local-only management action',()=>{
  const html=read('visitor.html'),source=read('js/visitor.js');
  assert.match(html,/id="manageLastSubmissionBtn"[^>]*>Lihat \/ Kemaskini Pendaftaran/);
  assert.match(html,/tidak dihantar melalui WhatsApp/);
  assert.match(source,/enableWhatsAppAction\(payload, true\)/);
  assert.match(source,/const saved = getSavedLastSubmission\(\)/);
  assert.match(source,/loadSubmissionIntoForm\(saved\)/);
  assert.doesNotMatch(source,/Pautan kemas kini/);
});

test('self-edit keeps policy fields immutable and expires before entry or 24 hours',()=>{
  const rules=read('firestore.rules');
  assert.match(rules,/allow read: if paymentStaff\(\);/);
  assert.match(rules,/oldData\.status in \['Pending', 'Pending Payment'\]/);
  assert.match(rules,/request\.time < oldData\.createdAt \+ duration\.value\(24, 'h'\)/);
  assert.match(rules,/request\.time < oldData\.eta/);
  assert.match(rules,/affectedKeys\(\)\.hasOnly\(\[[\s\S]*?'vehicleNo','vehicleNumbers','vehicleRowsDetailed'/);
  assert.match(rules,/vehicleNumbers', \[\]\)\.size\(\) == oldData\.get\('vehicleNumbers', \[\]\)\.size\(\)/);
});
