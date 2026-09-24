const test = require('node:test');
const assert = require('node:assert/strict');
const {
    extractEditedMessage,
    normalizeEditUpdate,
    normalizeEditUpdates
} = require('../src/Plugin/editEvent');

test('extracts the plogme 2.0.5 messages.update human-edit shape', () => {
    const edited = { conversation: 'new human text' };
    assert.deepEqual(extractEditedMessage({
        message: { editedMessage: { message: edited } }
    }), edited);
});

test('extracts raw protocol and forwarded edit shapes', () => {
    const edited = { extendedTextMessage: { text: 'edited text' } };
    assert.deepEqual(extractEditedMessage({ protocolMessage: { editedMessage: edited } }), edited);
    assert.deepEqual(extractEditedMessage({
        message: { botForwardedMessage: { message: { protocolMessage: { editedMessage: edited } } } }
    }), edited);
});

test('normalizes human edit to the target key and direct updated message', () => {
    const key = { remoteJid: '12345@s.whatsapp.net', id: 'original-id', fromMe: false };
    const edited = { conversation: 'edited text' };
    const result = normalizeEditUpdate({
        key,
        update: { message: { editedMessage: { message: edited } } }
    });
    assert.equal(result.key, key);
    assert.deepEqual(result.update.message, edited);
    assert.deepEqual(result.message.editedMessage, edited);
    assert.equal(result.update.remoteJid, key.remoteJid);
    assert.equal(result.update.id, key.id);
});

test('normalizes edits when plogme nests the target key inside update.key', () => {
    const key = { remoteJid: 'group@g.us', id: 'nested-target', participant: 'user@s.whatsapp.net' };
    const edited = { conversation: 'human group edit' };
    const result = normalizeEditUpdate({
        update: { key, message: { editedMessage: { message: edited } } }
    });
    assert.equal(result.key, key);
    assert.equal(result.update.remoteJid, key.remoteJid);
    assert.equal(result.update.id, key.id);
    assert.equal(result.update.participant, key.participant);
    assert.deepEqual(result.message.editedMessage, edited);
});

test('normalizes protocol edit batches without changing unrelated updates', () => {
    const unchanged = { key: { id: 'other' }, update: { status: 2 } };
    const edited = { conversation: 'edited' };
    const result = normalizeEditUpdates([
        unchanged,
        { key: { id: 'target' }, update: { protocolMessage: { editedMessage: edited } } }
    ]);
    assert.equal(result[0], unchanged);
    assert.deepEqual(result[1].update.message, edited);
    assert.deepEqual(result[1].message.editedMessage, edited);
    assert.equal(result[1].update.id, 'target');
});
