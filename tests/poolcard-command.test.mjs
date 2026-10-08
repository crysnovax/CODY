import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const command = require('../src/Commands/Owner/poolcard.js');
const { normalizePoolcardButton } = require('../src/Plugin/poolcardButtonRouter.js');

const baseMessage = { chat: '123@s.whatsapp.net', key: { id: 'command-1' } };

test('poolcard sends a native in-message card with no URL CTA', async () => {
  const calls = [];
  const sock = { sendRichButtonGrid: async (...args) => { calls.push(args); return { key: { id: 'pool-card-1' } }; } };
  await command.execute(sock, baseMessage, { args: [], reply: async () => {} });
  assert.equal(calls.length, 1);
  const payload = calls[0][1];
  assert.equal(payload.cards.length, 1);
  assert.equal(payload.cards[0].buttons[0].id, 'poolcard:bet');
  assert.equal(payload.cards[0].buttons[1].id, 'poolcard:shoot');
  assert.equal('url' in payload.cards[0], false);
  assert.match(payload.cards[0].caption, /CREDITS/);
});

test('pool buttons normalize to poolcard actions', () => {
  assert.equal(normalizePoolcardButton('poolcard:bet'), '.poolcard bet');
  assert.equal(normalizePoolcardButton('poolcard:shoot'), '.poolcard shoot');
  assert.equal(normalizePoolcardButton('poolcard:reset'), '.poolcard reset');
});

test('poolcard updates the original card through sendMessage edit', async () => {
  const calls = [];
  const sock = {
    sendRichButtonGrid: async () => ({ key: { id: 'pool-card-2' } }),
    sendMessage: async (...args) => { calls.push(args); return {}; }
  };
  await command.execute(sock, baseMessage, { args: [], reply: async () => {} });
  const buttonMessage = { chat: baseMessage.chat, key: { id: 'button-1' }, quoted: { key: { id: 'pool-card-2' } } };
  await command.execute(sock, buttonMessage, { args: ['shoot'], reply: async () => {} });
  const edit = calls.find(([, content, options]) => options?.edit);
  assert.ok(edit);
  assert.deepEqual(edit[2].edit, { remoteJid: baseMessage.chat, id: 'pool-card-2' });
  assert.match(edit[1].cards[0].caption, /WIN/);
});
