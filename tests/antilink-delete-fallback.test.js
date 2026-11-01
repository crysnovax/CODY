'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { deleteTargetMessage } = require('../src/Commands/Admin/antilink');

test('AntiLink retries a fallback message key after WhatsApp rejects the first key', async () => {
    const attempts = [];
    const originalError = console.error;
    console.error = () => {};
    try {
        const deleted = await deleteTargetMessage({
            async sendMessage(chat, content) {
                attempts.push({ chat, key: content.delete });
                if (content.delete.id === 'bad-key') throw new Error('invalid delete key');
            },
        }, 'room@g.us',
        { remoteJid: 'room@g.us', id: 'bad-key' },
        { id: 'actual-message-key' });
        assert.equal(deleted, true);
    } finally {
        console.error = originalError;
    }
    assert.deepEqual(attempts.map(item => item.key.id), ['bad-key', 'actual-message-key']);
    assert.equal(attempts[1].key.remoteJid, 'room@g.us');
});
