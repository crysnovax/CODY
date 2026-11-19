'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'plogme') {
        return {
            downloadContentFromMessage: async function* () {
                yield Buffer.from('media-bytes');
            }
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const tovv = require('../src/Commands/Converter/Tovv');
Module._load = originalLoad;

function makeMessage(quoted) {
    return {
        chat: '15550000000@s.whatsapp.net',
        key: { id: 'tovv-command' },
        quoted
    };
}

test('tovv converts a replied text message into view-once text', async () => {
    const sent = [];
    const replies = [];
    const sock = { sendMessage: async (...args) => sent.push(args) };
    const message = makeMessage({
        mtype: 'extendedTextMessage',
        text: 'read once only',
        msg: { extendedTextMessage: { text: 'read once only' } }
    });

    await tovv.execute(sock, message, { reply: async value => replies.push(value) });

    const outgoing = sent.find(([, content]) => content?.text);
    assert.deepEqual(outgoing[1], { text: 'read once only', viewOnce: true });
    assert.equal(outgoing[0], message.chat);
    assert.deepEqual(outgoing[2], { quoted: message });
    assert.equal(replies.length, 0);
});

test('tovv still accepts replied image and video media', async () => {
    const sent = [];
    const sock = { sendMessage: async (...args) => sent.push(args) };

    for (const [mtype, mimetype, key] of [
        ['imageMessage', 'image/jpeg', 'image'],
        ['videoMessage', 'video/mp4', 'video']
    ]) {
        sent.length = 0;
        await tovv.execute(sock, makeMessage({
            mtype,
            mimetype,
            text: 'caption',
            msg: { mimetype }
        }), { reply: async () => {} });
        const outgoing = sent.find(([, content]) => content?.[key]);
        assert.ok(outgoing, `${key} payload should still be sent`);
        assert.equal(outgoing[1][key].toString(), 'media-bytes');
        assert.equal(outgoing[1].viewOnce, true);
    }
});
