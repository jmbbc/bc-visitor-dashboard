import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('successful registration exposes a local-only management action',()=>{
  const html=read('visitor.html'),source=read('js/visitor.js');
  assert.match(html,/id="manageLastSubmissionBtn"[^>]*>Betulkan Pendaftaran Ini/);
  assert.match(html,/Guna Semula Maklumat/);
  assert.match(html,/tidak dihantar melalui WhatsApp/);
  assert.match(source,/enableWhatsAppAction\(payload, true\)/);
  assert.match(source,/const saved = mockManagementSubmission \|\| getSavedLastSubmission\(\)/);
  assert.match(source,/loadSubmissionIntoForm\(saved\)/);
  assert.doesNotMatch(source,/Pautan kemas kini/);
});

test('management mock is local-only and exposes the post-submit state',()=>{
  const source=read('js/visitor.js');
  assert.match(source,/previewParams\.get\('mockManage'\)==='1'/);
  assert.match(source,/mockManagementSubmission=sample/);
  assert.doesNotMatch(source,/mockManage[\s\S]{0,900}saveLastSubmission\(sample\)/);
  assert.match(source,/enableWhatsAppAction\(\{mock:true\},true\)/);
  assert.match(source,/data tidak dihantar ke Firebase atau WhatsApp/);
});

test('self-edit keeps policy fields immutable and expires before entry or 24 hours',()=>{
  const rules=read('firestore.rules'),source=read('js/visitor.js');
  assert.match(rules,/allow read: if paymentStaff\(\);/);
  assert.match(rules,/oldData\.status in \['Pending', 'Pending Payment'\]/);
  assert.match(rules,/request\.time < oldData\.createdAt \+ duration\.value\(24, 'h'\)/);
  assert.match(rules,/request\.time < oldData\.eta/);
  assert.match(rules,/affectedKeys\(\)\.hasOnly\(\[[\s\S]*?'vehicleNo','vehicleNumbers','vehicleRowsDetailed'/);
  assert.match(rules,/vehicleNumbers', \[\]\)\.size\(\) == oldData\.get\('vehicleNumbers', \[\]\)\.size\(\)/);
  assert.doesNotMatch(source,/tx\.get\(targetRespRef\)/);
  assert.match(source,/Visitor clients intentionally cannot read response documents/);
  assert.match(source,/e\.code = 'AMENDMENT_NOT_ALLOWED'/);
});
