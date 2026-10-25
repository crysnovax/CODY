'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
    if (request === 'plogme') {
        return {
            downloadContentFromMessage: async function* () { yield Buffer.from('view-once-bytes'); },
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const vv = require('../src/Commands/Converter/view-once');
Module._load = originalLoad;

async function invoke(message, command = '.vv') {
    const sent = [];
    const replies = [];
    const sock = {
        sendMessage: async (...args) => { sent.push(args); return {}; },
        ev: { on() {} },
    };
    const m = {
        body: command,
        chat: 'test-group@g.us',
        sender: 'user@s.whatsapp.net',
        key: { id: 'command-1', remoteJid: 'test-group@g.us' },
        quoted: { message },
    };
    await vv.execute(sock, m, {
        args: [], prefix: '.', reply: async text => replies.push(text),
    });
    return { sent, replies };
}

test('vv unlocks a view-once text message', async () => {
    const { sent, replies } = await invoke({ viewOnceMessageV2: { message: { conversation: 'private text' } } });
    assert.deepEqual(sent[0][1], { text: 'private text' });
    assert.equal(sent[0][0], 'test-group@g.us');
    assert.equal(replies.length, 0);
});

test('vv resends voice-note audio without a caption and preserves ptt metadata', async () => {
    const { sent, replies } = await invoke({ viewOnceMessage: { message: {
        messageContextInfo: {}, audioMessage: { mimetype: 'audio/ogg; codecs=opus', ptt: true },
    } } });
    assert.deepEqual(sent[0][1], { audio: Buffer.from('view-once-bytes'), mimetype: 'audio/ogg; codecs=opus', ptt: true });
    assert.equal(replies.length, 0);
});

test('vv resends view-once documents with filename and MIME type', async () => {
    const { sent, replies } = await invoke({ viewOnceMessageV2: { message: {
        documentMessage: { mimetype: 'application/pdf', fileName: 'notice.pdf' },
    } } });
    assert.equal(sent[0][1].document.toString(), 'view-once-bytes');
    assert.equal(sent[0][1].fileName, 'notice.pdf');
    assert.equal(sent[0][1].mimetype, 'application/pdf');
    assert.equal(replies.length, 0);
});

test('vv uses caption-capable payloads for images and videos', async () => {
    for (const [key, expectedKey] of [['imageMessage', 'image'], ['videoMessage', 'video']]) {
        const { sent } = await invoke({ viewOnceMessageV2: { message: { [key]: { mimetype: 'application/octet-stream' } } } });
        assert.equal(sent[0][1][expectedKey].toString(), 'view-once-bytes');
        assert.match(sent[0][1].caption, /View-once unlocked/);
    }
});

test('vvp sends recovered view-once text directly to the requester', async () => {
    const { sent } = await invoke({ viewOnceMessageV2Extension: { message: { extendedTextMessage: { text: 'secret note' } } } }, '.vvp');
    assert.deepEqual(sent[0], ['user@s.whatsapp.net', { text: 'secret note' }]);
});
