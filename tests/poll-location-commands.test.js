const test = require('node:test');
const assert = require('node:assert/strict');

const addpoll = require('../src/Commands/Tools/addpoll.js');
const reqloc = require('../src/Commands/Tools/reqloc.js');
const cancelreqloc = require('../src/Commands/Tools/cancelreqloc.js');

const message = { chat: '123@s.whatsapp.net', key: { id: 'command' } };

function harness() {
  const sent = [];
  const replies = [];
  return {
    sent,
    replies,
    sock: { sendMessage: async (...args) => sent.push(args) },
    reply: async (text) => replies.push(text)
  };
}

test('addpoll is public and always enables adding options', async () => {
  assert.equal(addpoll.adminOnly, false);
  assert.equal(addpoll.groupOnly, false);
  const h = harness();
  const before = Date.now();
  await addpoll.execute(h.sock, message, { args: ['Release preference', '|', 'Stable', '|', 'Beta'], reply: h.reply });
  const poll = h.sent[0][1].poll;
  assert.equal(poll.name, 'Release preference');
  assert.deepEqual(poll.values, ['Stable', 'Beta']);
  assert.equal(poll.selectableCount, 1);
  assert.equal(poll.hideVoter, false);
  assert.equal(poll.canAddOption, true);
  assert.ok(poll.endDate instanceof Date);
  assert.ok(poll.endDate.getTime() >= before + 28_800_000 - 1000);
});

test('addpoll cannot disable canAddOption', async () => {
  const h = harness();
  await addpoll.execute(h.sock, message, { args: ['Question', '|', 'A', '|', 'B', '--no-add-option'], reply: h.reply });
  assert.equal(h.sent[0][1].poll.canAddOption, true);
});

test('reqloc sends a location request', async () => {
  const h = harness();
  await reqloc.execute(h.sock, message, { reply: h.reply });
  assert.deepEqual(h.sent[0][1], { requestLocation: true });
});

test('cancelreqloc cancels the replied-to live-location message', async () => {
  const h = harness();
  const liveLocationMessage = { key: { remoteJid: message.chat, id: 'live-location' } };
  await cancelreqloc.execute(h.sock, { ...message, quoted: liveLocationMessage }, { reply: h.reply });
  assert.deepEqual(h.sent[0][1], { requestLocationUpdate: { key: liveLocationMessage.key, cancel: true } });
});
