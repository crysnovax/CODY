const assert = require('node:assert/strict');
const test = require('node:test');
const richgen = require('../src/Commands/Owner/richgen.js');

function context(args, calls, replies) {
    const sock = {
        sendRichGeneration: async (jid, content, quoted) => {
            calls.push({ type: 'send', jid, content, quoted });
            return { messageId: 'message-1', responseId: 'response-1', itemId: 'item-1' };
        },
        updateRichGeneration: async (jid, targetId, content, options) => {
            calls.push({ type: 'update', jid, targetId, content, options });
            return { responseId: options.responseId, itemId: options.itemId };
        }
    };
    return {
        sock,
        message: { chat: '12345@s.whatsapp.net', key: { id: 'quoted-1' } },
        context: { args, prefix: '.', reply: async value => replies.push(value) }
    };
}

test('richgen sends a native GENERATING card without replacement when requested', async () => {
    const calls = [];
    const replies = [];
    const value = context(['--state=generating', '--delay=0'], calls, replies);

    await richgen.execute(value.sock, value.message, value.context);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, 'send');
    assert.equal(calls[0].content.mediaType, 'video');
    assert.equal(calls[0].content.status, 'GENERATING');
    assert.match(replies[0], /Message ID: message-1/);
});

test('richgen replaces the GENERATING card in place with READY', async () => {
    const calls = [];
    const replies = [];
    const value = context(['--delay=0', '--url=https://example.com/video.mp4'], calls, replies);

    await richgen.execute(value.sock, value.message, value.context);

    assert.equal(calls.length, 2);
    assert.equal(calls[1].type, 'update');
    assert.equal(calls[1].targetId, 'message-1');
    assert.equal(calls[1].content.status, 'READY');
    assert.equal(calls[1].content.url, 'https://example.com/video.mp4');
    assert.deepEqual(calls[1].options, { itemId: 'item-1', responseId: 'response-1' });
    assert.match(replies[0], /READY replacement/);
});

test('richgen reports a helpful message when RichGen is unavailable', async () => {
    const replies = [];
    await richgen.execute({}, { chat: '12345@s.whatsapp.net' }, { args: [], reply: async value => replies.push(value) });
    assert.match(replies[0], /does not expose RichGen/i);
    assert.match(replies[0], /plogme/i);
});
