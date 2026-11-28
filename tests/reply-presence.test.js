'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    MAX_PRESENCE_DELAY_MS,
    isAudioMessage,
    isPresenceWorthyMessage,
    getPresenceDelayMs,
    prepareReplyPresence,
    clearReplyPresence
} = require('../library/reply-presence');

test('text replies use composing presence and pause after preparation', async () => {
    const calls = [];
    const sock = { sendPresenceUpdate: async (...args) => calls.push(args) };
    const content = { text: 'hello' };

    assert.equal(await prepareReplyPresence(sock, 'chat@g.us', content), true);
    assert.deepEqual(calls, [['composing', 'chat@g.us']]);
    assert.equal(await clearReplyPresence(sock, 'chat@g.us', content), true);
    assert.deepEqual(calls, [['composing', 'chat@g.us'], ['paused', 'chat@g.us']]);
});

test('audio replies use recording presence', async () => {
    const calls = [];
    const sock = { sendPresenceUpdate: async (...args) => calls.push(args) };

    assert.equal(isAudioMessage({ audio: Buffer.from('audio') }), true);
    await prepareReplyPresence(sock, 'chat@s.whatsapp.net', { audio: Buffer.from('audio'), ptt: true });
    assert.deepEqual(calls, [['recording', 'chat@s.whatsapp.net']]);
});

test('presence timing is variable but never exceeds two seconds', () => {
    assert.ok(getPresenceDelayMs({ text: 'short' }) < getPresenceDelayMs({ text: 'a'.repeat(100) }));
    assert.ok(getPresenceDelayMs({ text: 'a'.repeat(1000) }) <= MAX_PRESENCE_DELAY_MS);
    assert.equal(isPresenceWorthyMessage({ react: { text: '👍' } }), false);
    assert.equal(isPresenceWorthyMessage({ delete: { remoteJid: 'chat' } }), false);
});
