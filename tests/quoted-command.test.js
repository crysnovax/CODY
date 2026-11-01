'use strict';

const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'plogme') {
        return { downloadContentFromMessage: async function* () { yield Buffer.from('status-image'); } };
    }
    return originalLoad.call(this, request, parent, isMain);
};
global.prefix = '.';
const command = require('../src/Commands/Admin/qt');

after(() => {
    Module._load = originalLoad;
    delete global.prefix;
});

function makeSock() {
    const sent = [];
    return { sent, async sendMessage(chat, content, options) { sent.push({ chat, content, options }); } };
}
function invocation({ quoted, store = null } = {}) {
    const sock = makeSock();
    const replies = [];
    const m = { chat: 'reply-chat@g.us', key: { id: 'request-1' }, quoted };
    return {
        sock,
        replies,
        run: () => command.execute(sock, m, { reply: text => replies.push(text), store, prefix: '.' }),
    };
}

const targetMessage = (chat, id, quotedMessage) => ({
    key: { remoteJid: chat, id },
    message: {
        extendedTextMessage: {
            text: 'outer reply text',
            contextInfo: { quotedMessage },
        },
    },
});

test('.quoted gets nested content directly from the quoted envelope without relying on volatile store state', async () => {
    const inner = { conversation: 'the original content survives restart' };
    const target = targetMessage('reply-chat@g.us', 'outer-1', inner);
    const context = invocation({ quoted: { id: 'outer-1', chat: 'reply-chat@g.us', fakeObj: target } });
    await context.run();
    assert.deepEqual(context.replies, []);
    assert.ok(context.sock.sent.some(({ content }) => content?.text === 'the original content survives restart'));
});

test('.quoted loads by message key when the direct quoted envelope is absent and the store contains noisy entries', async () => {
    const target = targetMessage('reply-chat@g.us', 'outer-from-store', { conversation: 'recovered through store lookup' });
    const messages = new Map([
        ['reply-chat@g.us:noise-1', { message: { key: { remoteJid: 'reply-chat@g.us', id: 'noise-1' }, message: { conversation: 'unrelated' } } }],
        ['reply-chat@g.us:outer-from-store', { message: target, timestamp: Date.now() }],
    ]);
    const context = invocation({
        quoted: { id: 'outer-from-store', chat: 'reply-chat@g.us' },
        store: { messages },
    });
    await context.run();
    assert.deepEqual(context.replies, []);
    assert.ok(context.sock.sent.some(({ content }) => content?.text === 'recovered through store lookup'));
});

test('.quoted passes the socket to loadMessage for persistent stores', async () => {
    const target = targetMessage('reply-chat@g.us', 'persistent-lookup', { conversation: 'persistent store lookup works' });
    const context = invocation({
        quoted: { id: 'persistent-lookup', chat: 'reply-chat@g.us' },
        store: {
            async loadMessage(chat, id, sock) {
                assert.equal(chat, 'reply-chat@g.us');
                assert.equal(id, 'persistent-lookup');
                assert.equal(sock, context.sock);
                return target;
            },
        },
    });
    await context.run();
    assert.deepEqual(context.replies, []);
    assert.ok(context.sock.sent.some(({ content }) => content?.text === 'persistent store lookup works'));
});

test('.quoted unwraps groupStatusMessageV2 text before resending it', async () => {
    const groupStatus = { groupStatusMessageV2: { message: { conversation: 'group status text' } } };
    const target = targetMessage('reply-chat@g.us', 'outer-status-text', groupStatus);
    const context = invocation({ quoted: { id: 'outer-status-text', chat: 'reply-chat@g.us', fakeObj: target } });
    await context.run();
    assert.deepEqual(context.replies, []);
    assert.ok(context.sock.sent.some(({ content }) => content?.text === 'group status text'));
});

test('.quoted unwraps groupStatusMessageV2 image media and returns the media', async () => {
    const groupStatus = { groupStatusMessageV2: { message: { imageMessage: { caption: 'group status image' } } } };
    const target = targetMessage('reply-chat@g.us', 'outer-status-image', groupStatus);
    const context = invocation({ quoted: { id: 'outer-status-image', chat: 'reply-chat@g.us', fakeObj: target } });
    await context.run();
    assert.deepEqual(context.replies, []);
    assert.ok(context.sock.sent.some(({ content }) => Buffer.isBuffer(content?.image) && content.caption === 'group status image'));
});
