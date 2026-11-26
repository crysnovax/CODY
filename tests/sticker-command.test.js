'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const exifPath = require.resolve('../library/exif');
require.cache[exifPath] = {
    id: exifPath,
    filename: exifPath,
    loaded: true,
    exports: { addExif: async buffer => buffer },
};

const stickerCommand = require('../src/Commands/Media/sticker');

test('.sticker accepts a replied sticker and sends sticker media', async () => {
    const sent = [];
    const source = Buffer.from('webp-sticker');
    const quoted = {
        mtype: 'stickerMessage',
        mimetype: 'image/webp',
        download: async () => source,
    };
    const message = {
        chat: 'group@g.us',
        quoted,
        key: { id: 'command-id' },
    };

    await stickerCommand.execute({
        sendMessage: async (_chat, content, options) => sent.push({ content, options }),
    }, message, { reply: async () => {} });

    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].content, { sticker: source });
    assert.deepEqual(sent[0].options, { quoted: message });
});

test('sticker detection accepts normalized and raw sticker shapes', () => {
    assert.equal(stickerCommand.isStickerMessage({ mtype: 'stickerMessage' }), true);
    assert.equal(stickerCommand.isStickerMessage({ stickerMessage: {} }), true);
    assert.equal(stickerCommand.isStickerMessage({ message: { stickerMessage: {} } }), true);
    assert.equal(stickerCommand.isStickerMessage({ mtype: 'imageMessage' }), false);
});
