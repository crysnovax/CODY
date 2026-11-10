const assert = require('node:assert/strict');
const test = require('node:test');
const { selectMessageForProcessing } = require('../src/Plugin/messageBatch');

const status = {
    key: { remoteJid: 'status@broadcast', id: 'STATUS-1' },
    message: { conversation: 'story text' }
};
const command = {
    key: { remoteJid: '15550001111@s.whatsapp.net', id: 'CMD-1', fromMe: false },
    message: { conversation: '.ping' }
};

test('a leading status stanza cannot mask a user command later in the same upsert batch', () => {
    assert.equal(selectMessageForProcessing([status, command], '.'), command);
});

test('a command is preferred over an earlier routable non-command message', () => {
    const ordinary = {
        key: { remoteJid: '15550001111@s.whatsapp.net', id: 'MSG-1', fromMe: false },
        message: { conversation: 'hello' }
    };
    assert.equal(selectMessageForProcessing([ordinary, command], '.'), command);
});

test('status-only and malformed batches do not produce a command candidate', () => {
    assert.equal(selectMessageForProcessing([status, { key: {}, message: null }], '.'), null);
    assert.equal(selectMessageForProcessing(null, '.'), null);
});

test('self-echo command text is not prioritized over an incoming command', () => {
    const selfEcho = {
        key: { remoteJid: '15550001111@s.whatsapp.net', id: 'SELF-1', fromMe: true },
        message: { conversation: '.menu' }
    };
    assert.equal(selectMessageForProcessing([selfEcho, command], '.'), command);
});
