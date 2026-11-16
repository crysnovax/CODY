'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
let officialDownloads = 0;
let reuploadRequests = 0;

Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'plogme') {
        return {
            downloadContentFromMessage: async function* () { yield Buffer.from('direct-path-fallback'); },
            downloadMediaMessage: async (envelope, type, options, context) => {
                officialDownloads += 1;
                assert.equal(type, 'buffer');
                assert.equal(envelope.message.imageMessage.viewOnce, true);
                assert.equal(typeof context.reuploadRequest, 'function');
                await context.reuploadRequest(envelope);
                reuploadRequests += 1;
                return Buffer.from('reuploaded-view-once-bytes');
            },
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};

delete require.cache[require.resolve('../src/Commands/Converter/view-once')];
const vv = require('../src/Commands/Converter/view-once');
Module._load = originalLoad;

test('vv uses the complete fakeObj envelope and reuploads expired view-once media', async () => {
    const sent = [];
    const updates = [];
    const media = { mimetype: 'image/jpeg', viewOnce: true };
    const envelope = {
        key: {
            remoteJid: '120363431035040465@g.us',
            participant: '216441169146077@lid',
            fromMe: false,
            id: 'view-once-id',
        },
        message: { imageMessage: media },
        participant: '216441169146077@lid',
    };
    const sock = {
        sendMessage: async (...args) => { sent.push(args); },
        ev: { on() {} },
        updateMediaMessage: async message => { updates.push(message); return message; },
    };
    const m = {
        body: '.vv',
        chat: '120363431035040465@g.us',
        sender: 'owner@s.whatsapp.net',
        key: { id: 'command-id', remoteJid: '120363431035040465@g.us' },
        quoted: {
            ...media,
            mtype: 'imageMessage',
            fakeObj: envelope,
        },
    };

    await vv.execute(sock, m, {
        args: [],
        prefix: '.',
        reply: async text => { throw new Error(text); },
    });

    assert.equal(officialDownloads, 1);
    assert.equal(reuploadRequests, 1);
    assert.equal(updates.length, 1);
    assert.equal(sent[0][1].image.toString(), 'reuploaded-view-once-bytes');
});
