'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const QRCode = require('qrcode');
const command = require('../src/Commands/Utils/QRcode');

test('qrread replies with the decoded QR payload for a quoted image', async () => {
    const payload = 'regression-payload-qrread';
    const png = await QRCode.toBuffer(payload, {
        type: 'png',
        width: 500,
        margin: 1,
        errorCorrectionLevel: 'H'
    });
    const replies = [];
    const sock = { sendMessage: async () => ({}) };
    const message = {
        body: '/qrread',
        chat: '15550000000@s.whatsapp.net',
        key: { id: 'qrread-test' },
        quoted: { mtype: 'imageMessage', download: async () => png }
    };

    await command.execute(sock, message, {
        args: [],
        prefix: '/',
        reply: async text => replies.push(text)
    });

    assert.equal(replies.length, 1);
    assert.match(replies[0], /QR Decoded/);
    assert.match(replies[0], new RegExp(payload));
    assert.doesNotMatch(replies[0], /Error reading QR/);
});

test('qrread error replies do not put the configured prefix before the message', async () => {
    const replies = [];
    const message = {
        body: '/qrread',
        chat: '15550000000@s.whatsapp.net',
        key: { id: 'qrread-error-test' },
        quoted: { mtype: 'imageMessage', download: async () => { throw new Error('invalid image data'); } }
    };

    await command.execute({ sendMessage: async () => ({}) }, message, {
        args: [],
        prefix: '/',
        reply: async text => replies.push(text)
    });

    assert.equal(replies.length, 1);
    assert.match(replies[0], /^✘ Error reading QR:/);
    assert.match(replies[0], /invalid image data/);
    assert.doesNotMatch(replies[0], /^\//);
});
