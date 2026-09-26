const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const patcher = require('../scripts/patch-plogme.cjs');

const plogmeRoot = path.join(__dirname, '..', 'node_modules', 'plogme');
const hasPlogme = fs.existsSync(plogmeRoot);

test('every plogme patch is recognised and already applied after install', { skip: !hasPlogme }, () => {
  const { applied, unknown } = patcher.apply();
  assert.deepEqual(unknown, []);
  assert.deepEqual(applied, []);
});

test('patched plogme sources no longer reference undefined bindings', { skip: !hasPlogme }, () => {
  const send = fs.readFileSync(path.join(plogmeRoot, 'lib', 'Socket', 'messages-send.js'), 'utf8');
  assert.equal(send.includes('originalSend('), false);
  assert.equal(send.includes('\n                userJid,\n'), false);
});

test('rich responses build a code block when no language is given', { skip: !hasPlogme }, async () => {
  const { prepareRichResponseMessage } = await import('plogme/lib/Utils/rich-message-utils.js');
  const message = prepareRichResponseMessage({ headerText: 'CODY', code: 'const a = 1;' });
  const encoded = JSON.stringify(message);
  assert.ok(encoded.includes('codeLanguage'));
  assert.ok(encoded.includes('javascript'));
});
