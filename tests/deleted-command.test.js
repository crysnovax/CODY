const test = require('node:test');
const assert = require('node:assert/strict');
const quoted = require('../library/quoted');
const command = require('../src/Commands/Utils/deleted');

const revoked = (jid, id) => ({ key: { remoteJid: jid, id }, update: { message: null } });
const envelope = (jid, id, text) => ({ key: { remoteJid: jid, id }, message: { conversation: text } });
function makeSock() {
    const sent = [];
    return { sent, async sendMessage(chat, content, options) { sent.push({ chat, content, options }); } };
}

test('deleted history is newest-first, indexed, chat-scoped, and ignores ordinary updates', async () => {
    const chat = 'deleted-history-group@g.us';
    const otherChat = 'other-history-group@g.us';
    const originals = Array.from({ length: 6 }, (_, i) => envelope(chat, `history-${i + 1}`, `deleted-${i + 1}`));
    originals.forEach(message => quoted.cacheMessage(message));
    await quoted.onDelete(null, originals.map(message => revoked(chat, message.key.id)), null);
    await quoted.onDelete(null, [
        { key: originals[0].key, update: { message: { conversation: 'not revoked' }, status: 1 } },
        { key: originals[0].key, update: {} },
        { key: originals[0].key, update: { status: 0 } },
    ], null);
    for (let index = 1; index <= 6; index += 1) {
        assert.equal(quoted.getLastDeleted(chat, index)?.message?.message?.conversation, `deleted-${7 - index}`);
    }
    assert.equal(quoted.getLastDeleted(chat, 7), null);
    assert.equal(quoted.getLastDeleted(otherChat, 1), null);
    assert.equal(quoted.getLastDeleted(chat, 0), null);
});

test('deletion event retrieves CODY custom-store wrappers and rejects a mismatched chat key', async () => {
    const chat = 'deleted-store-group@g.us';
    const otherChat = 'deleted-store-other@g.us';
    const original = envelope(chat, 'store-message', 'from custom store');
    const store = { messages: new Map([[`${chat}:${original.key.id}`, { message: original, timestamp: Date.now() }]]) };
    await quoted.onDelete(null, [revoked(chat, original.key.id)], store);
    assert.equal(quoted.getLastDeleted(chat, 1)?.message?.message?.conversation, 'from custom store');
    const mismatched = envelope(otherChat, 'mismatched-id', 'must not leak');
    store.messages.set(`${chat}:${mismatched.key.id}`, { message: mismatched, timestamp: Date.now() });
    await quoted.onDelete(null, [revoked(chat, mismatched.key.id)], store);
    assert.equal(quoted.getLastDeleted(chat, 1)?.message?.message?.conversation, 'from custom store');
    assert.equal(quoted.getLastDeleted(otherChat, 1), null);
});

test('`.deleted` preserves latest retrieval and returns indices 2 through 6', async () => {
    const chat = 'deleted-command-group@g.us';
    const originals = Array.from({ length: 6 }, (_, i) => envelope(chat, `command-${i + 1}`, `message-${i + 1}`));
    originals.forEach(message => quoted.cacheMessage(message));
    await quoted.onDelete(null, originals.map(message => revoked(chat, message.key.id)), null);
    for (let index = 1; index <= 6; index += 1) {
        const sock = makeSock();
        const replies = [];
        await command.execute(sock, { chat, key: { id: `request-${index}` } }, {
            args: index === 1 ? [] : [String(index)], reply: text => replies.push(text)
        });
        assert.deepEqual(replies, []);
        assert.ok(sock.sent.some(entry => entry.content?.text === `message-${7 - index}`), `index ${index} returns correct message`);
    }
});

test('out-of-range and invalid indices never return a deleted message from another chat', async () => {
    const chat = 'deleted-range-group@g.us';
    const otherChat = 'deleted-range-other@g.us';
    const original = envelope(otherChat, 'private-to-other-chat', 'secret other chat text');
    quoted.cacheMessage(original);
    await quoted.onDelete(null, [revoked(otherChat, original.key.id)], null);
    const sock = makeSock();
    const replies = [];
    await command.execute(sock, { chat, key: { id: 'range-request' } }, {
        args: ['2'], reply: text => replies.push(text)
    });
    assert.deepEqual(replies, ['⊘ *No deleted message #2 found in this chat.*']);
    assert.equal(sock.sent.some(entry => entry.content?.text === 'secret other chat text'), false);
    const invalidReplies = [];
    await command.execute(makeSock(), { chat, key: { id: 'invalid-request' } }, {
        args: ['0'], reply: text => invalidReplies.push(text)
    });
    assert.match(invalidReplies[0], /Usage:/);
    const tooHighReplies = [];
    await command.execute(makeSock(), { chat, key: { id: 'too-high-request' } }, {
        args: ['7'], reply: text => tooHighReplies.push(text)
    });
    assert.match(tooHighReplies[0], /1-6/);
});
