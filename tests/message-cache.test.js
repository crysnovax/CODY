'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mediaPayloadScore, storeBestMessage } = require('../src/Plugin/messageCache');

test('a sparse view-once update does not replace the cached full media envelope', () => {
    const chat = 'chat@g.us';
    const id = 'view-once-cache-key';
    const full = {
        key: { remoteJid: chat, id },
        message: {
            imageMessage: {
                mimetype: 'image/jpeg',
                url: 'https://media.example/image',
                directPath: '/media/image',
                mediaKey: Buffer.alloc(32, 9),
                viewOnce: true,
            },
        },
    };
    const sparse = {
        key: { remoteJid: chat, id },
        message: { imageMessage: { viewOnce: true } },
    };
    const messages = new Map();
    const store = { messages };

    assert.equal(storeBestMessage(store, full), true);
    assert.ok(mediaPayloadScore(full) > mediaPayloadScore(sparse));
    assert.equal(storeBestMessage(store, sparse), false);
    assert.equal(messages.get(`${chat}:${id}`).message, full);
});

test('a newer full media envelope may replace an older cached envelope', () => {
    const chat = 'chat@g.us';
    const id = 'view-once-cache-upgrade';
    const sparse = { key: { remoteJid: chat, id }, message: { videoMessage: { viewOnce: true } } };
    const full = {
        key: { remoteJid: chat, id },
        message: { videoMessage: { mimetype: 'video/mp4', mediaKey: Buffer.alloc(32, 3), directPath: '/video' } },
    };
    const messages = new Map([[`${chat}:${id}`, { message: sparse, timestamp: 1 }]]);
    const store = { messages };

    assert.equal(storeBestMessage(store, full, 2), true);
    assert.equal(messages.get(`${chat}:${id}`).message, full);
    assert.equal(messages.get(`${chat}:${id}`).timestamp, 2);
});
