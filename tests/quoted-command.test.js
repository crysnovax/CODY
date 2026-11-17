'use strict';

const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'plogme') {
        return {
            downloadContentFromMessage: async function* () { yield Buffer.from('status-image'); },
            jidNormalizedUser: jid => jid,
            areJidsSameUser: (left, right) => left === right,
            getContentType: message => Object.keys(message || {})[0],
            proto: { WebMessageInfo: { fromObject: value => value } },
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
global.prefix = '.';
const { smsg } = require('../library/serialize');
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

test('.quoted prefers a stored complete reply over an incomplete embedded copy', async () => {
    const originalText = 'the original link message from the complete cached notice';
    const direct = {
        key: { remoteJid: 'reply-chat@g.us', id: 'outer-incomplete' },
        message: {
            extendedTextMessage: {
                text: 'Link detected',
                contextInfo: { participant: 'bot@s.whatsapp.net' },
            },
        },
    };
    const stored = targetMessage('reply-chat@g.us', 'outer-incomplete', { conversation: originalText });
    const context = invocation({
        quoted: { id: 'outer-incomplete', chat: 'reply-chat@g.us', fakeObj: direct },
        store: {
            async loadMessage() { return direct; },
            messages: new Map([['reply-chat@g.us:outer-incomplete', { message: stored, timestamp: Date.now() }]]),
        },
    });
    await context.run();
    assert.deepEqual(context.replies, []);
    assert.ok(context.sock.sent.some(({ content }) => content?.text === originalText));
});

test('.quoted returns yes for the serialized chain yes → y → .quoted', async () => {
    const chat = 'reply-chat@g.us';
    const sock = makeSock();
    sock.user = { id: 'bot@s.whatsapp.net' };
    sock.decodeJid = jid => jid;
    sock.groupMetadata = async () => ({ participants: [] });
    const commandMessage = await smsg(sock, {
        key: { remoteJid: chat, participant: 'user@s.whatsapp.net', fromMe: false, id: 'command-2' },
        message: {
            extendedTextMessage: {
                text: '.quoted',
                contextInfo: {
                    stanzaId: 'reply-y',
                    participant: 'user@s.whatsapp.net',
                    remoteJid: chat,
                    quotedMessage: {
                        extendedTextMessage: {
                            text: 'y',
                            contextInfo: {
                                stanzaId: 'original-yes',
                                participant: 'user@s.whatsapp.net',
                                remoteJid: chat,
                                quotedMessage: { conversation: 'yes' },
                            },
                        },
                    },
                },
            },
        },
    }, null);
    const replies = [];
    await command.execute(sock, commandMessage, { reply: text => replies.push(text), store: null, prefix: '.' });
    assert.deepEqual(replies, []);
    assert.ok(sock.sent.some(({ content }) => content?.text === 'yes'));
});

test('.quoted.download passes the complete envelope for direct view-once media', async () => {
    const chat = 'reply-chat@g.us';
    let downloadedEnvelope;
    const sock = makeSock();
    sock.user = { id: 'bot@s.whatsapp.net' };
    sock.decodeJid = jid => jid;
    sock.downloadMediaMessage = async envelope => {
        downloadedEnvelope = envelope;
        return Buffer.from('view-once-image');
    };
    const commandMessage = await smsg(sock, {
        key: { remoteJid: chat, participant: 'user@s.whatsapp.net', fromMe: false, id: 'command-vv' },
        message: {
            extendedTextMessage: {
                text: '.vv',
                contextInfo: {
                    stanzaId: 'view-once-image-id',
                    participant: 'user@s.whatsapp.net',
                    remoteJid: chat,
                    quotedMessage: {
                        imageMessage: {
                            mimetype: 'image/jpeg',
                            directPath: '/media/direct-path',
                            mediaKey: Buffer.alloc(32),
                            viewOnce: true,
                        },
                    },
                },
            },
        },
    }, null);

    const result = await commandMessage.quoted.download();

    assert.deepEqual(result, Buffer.from('view-once-image'));
    assert.equal(downloadedEnvelope.message.imageMessage.viewOnce, true);
    assert.equal(downloadedEnvelope.key.remoteJid, chat);
    assert.equal(downloadedEnvelope.key.participant, 'user@s.whatsapp.net');
    assert.equal(downloadedEnvelope.key.id, 'view-once-image-id');
});

test('.quoted chooses the text message context over an outer stale quote', async () => {
    const target = targetMessage('reply-chat@g.us', 'outer-conflict', { conversation: 'yes' });
    target.message.contextInfo = { quotedMessage: { conversation: 'u' } };
    const context = invocation({
        quoted: { id: 'outer-conflict', chat: 'reply-chat@g.us', fakeObj: target },
    });
    await context.run();
    assert.deepEqual(context.replies, []);
    assert.ok(context.sock.sent.some(({ content }) => content?.text === 'yes'));
    assert.ok(!context.sock.sent.some(({ content }) => content?.text === 'u'));
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

test('.quoted returns the inner message for a DM chain without participant metadata', async () => {
    const chat = 'user@s.whatsapp.net';
    const sock = makeSock();
    sock.user = { id: 'bot@s.whatsapp.net' };
    sock.decodeJid = jid => jid;
    const commandMessage = await smsg(sock, {
        key: { remoteJid: chat, fromMe: false, id: 'dm-command' },
        message: { extendedTextMessage: { text: '.quoted', contextInfo: {
            stanzaId: 'dm-b', remoteJid: chat,
            quotedMessage: { extendedTextMessage: { text: 'b', contextInfo: {
                stanzaId: 'dm-a', remoteJid: chat,
                quotedMessage: { conversation: 'a' },
            } } },
        } } },
    }, null);
    const replies = [];
    await command.execute(sock, commandMessage, { reply: text => replies.push(text), store: null, prefix: '.' });
    assert.deepEqual(replies, []);
    assert.ok(sock.sent.some(({ content }) => content?.text === 'a'));
    assert.ok(!sock.sent.some(({ content }) => content?.text === 'b'));
});
