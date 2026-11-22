'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');

const commandPath = path.resolve(__dirname, '../src/Commands/Search/£x.js');
const originalLoad = Module._load;
const calls = { giphy: [], downloads: [], encodes: [], packs: [] };

function makeItems(count) {
    return Array.from({ length: count }, (_, index) => {
        const animated = index % 2 === 0;
        const base = `https://media.giphy.com/test/${index}`;
        return {
            images: {
                original: {
                    url: animated ? `${base}.gif` : `${base}.jpg`,
                    frames: animated ? '20' : '1'
                },
                original_still: { url: `${base}_still.jpg` }
            }
        };
    });
}

const axiosMock = {
    async get(url, options = {}) {
        if (url === 'https://api.giphy.com/v1/gifs/search') {
            calls.giphy.push(options.params);
            return { data: { data: makeItems(61) } };
        }
        calls.downloads.push(url);
        return { data: Buffer.from(`source:${url}`) };
    }
};

const childProcessMock = {
    execFile(binary, args, _options, callback) {
        const outputPath = args.at(-1);
        calls.encodes.push({ binary, args, outputPath });
        fs.writeFile(outputPath, Buffer.from('mock-webp'), error => callback(error || null, '', ''));
    }
};

Module._load = function (request, parent, isMain) {
    if (parent?.filename === commandPath) {
        if (request === 'axios') return axiosMock;
        if (request === '../Utils/sticker-converter') {
            return { Sticker: class { constructor(buffer) { this.buffer = buffer; } async toBuffer() { return this.buffer; } } };
        }
        if (request === '../../Plugin/packname') return { getStickerBranding: () => ({ pack: 'CODY Test', author: 'CODY' }) };
        if (request === 'node:child_process') return childProcessMock;
    }
    return originalLoad.call(this, request, parent, isMain);
};
let command;
try {
    delete require.cache[commandPath];
    command = require(commandPath);
} finally {
    Module._load = originalLoad;
}

test('Stickersearch creates one mixed pack of at most 60 results', async () => {
    calls.giphy.length = 0;
    calls.downloads.length = 0;
    calls.encodes.length = 0;
    calls.packs.length = 0;
    const replies = [];
    const message = { chat: 'chat@s.whatsapp.net', key: { id: 'search-command' } };
    const sock = {
        async sendMessage(chat, payload, options) {
            if (Array.isArray(payload.stickers)) {
                calls.packs.push({ chat, payload, options, filesExist: payload.stickers.every(sticker => fs.existsSync(sticker.data.url)) });
            }
            return { key: { id: 'mock-message' } };
        }
    };

    await command.execute(sock, message, {
        args: ['anime', 'happy'],
        senderName: 'Tester',
        reply: async text => replies.push(text)
    });

    assert.equal(calls.giphy.length, 1);
    assert.equal(calls.giphy[0].q, 'anime happy');
    assert.equal(calls.giphy[0].limit, 60);
    assert.equal(calls.giphy[0].rating, 'r');
    assert.equal(calls.downloads.length, 60);
    assert.equal(calls.packs.length, 1, 'all stickers should be sent in one pack message');
    assert.equal(calls.packs[0].payload.stickers.length, 60);
    assert.equal(calls.packs[0].filesExist, true, 'sticker media files must remain available while the pack is sent');
    assert.equal(calls.packs[0].payload.name, 'anime happy Stickers');
    assert.deepEqual(calls.packs[0].options, { quoted: message });
    assert.equal(calls.encodes.filter(encode => encode.args.includes('-loop')).length, 30);
    assert.equal(calls.encodes.filter(encode => !encode.args.includes('-loop')).length, 30);
    assert.ok(calls.encodes.every(encode => encode.binary === 'ffmpeg'), 'use the host FFmpeg command like tgsticker');
    assert.ok(replies.some(text => /60\* stickers as one pack \(30 animated, 30 static\)/.test(text)));
    assert.ok(calls.packs[0].payload.stickers.length <= command.limits.maxStickers);
});

test('Stickersearch chooses an animated original or a static still image', () => {
    const animated = command.helpers.chooseSource({ images: { original: { url: 'https://example.test/a.gif', frames: '15' } } });
    const still = command.helpers.chooseSource({
        images: {
            original: { url: 'https://example.test/b.gif', frames: '1' },
            original_still: { url: 'https://example.test/b.jpg' }
        }
    });
    assert.deepEqual(animated, { url: 'https://example.test/a.gif', animated: true });
    assert.deepEqual(still, { url: 'https://example.test/b.jpg', animated: false });
});

test('Stickersearch uses the system FFmpeg command like tgsticker', () => {
    assert.equal(command.helpers.ffmpegPath, 'ffmpeg');
});
