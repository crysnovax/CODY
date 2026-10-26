'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { writeFile } = require('node:fs/promises');
const { fromBuffer } = require('file-type');
const socialDl = require('../src/Plugin/socialDl');

function loadWithStub(file, method, stub) {
    const commandPath = require.resolve(file);
    const original = socialDl[method];
    socialDl[method] = stub;
    delete require.cache[commandPath];
    const command = require(commandPath);
    return {
        command,
        restore() {
            socialDl[method] = original;
            delete require.cache[commandPath];
        }
    };
}

function mockSock() {
    const sent = [];
    return {
        sent,
        sock: {
            sendPresenceUpdate: async () => {},
            sendMessage: async (...args) => { sent.push(args); return { key: { id: `sent-${sent.length}` } }; }
        }
    };
}

test('new platform command URL parsers recognize their provider links', () => {
    const apple = require('../src/Commands/Downloader/applemusic');
    const threads = require('../src/Commands/Downloader/threads');
    const rednote = require('../src/Commands/Downloader/rednote');
    const audiomack = require('../src/Commands/Downloader/audiomack');
    const appleSearch = require('../src/Commands/Search/applemusic');
    assert.equal(apple.name, 'applemusic');
    assert.equal(appleSearch.name, 'applemusicsearch');
    assert.equal(apple.findUrl('try https://music.apple.com/us/song/example/123?i=456'), 'https://music.apple.com/us/song/example/123?i=456');
    assert.equal(threads.findUrl('https://www.threads.net/@user/post/abc'), 'https://www.threads.net/@user/post/abc');
    assert.equal(rednote.findUrl('https://www.xiaohongshu.com/explore/abc?xsec_token=x'), 'https://www.xiaohongshu.com/explore/abc?xsec_token=x');
    assert.equal(audiomack.findUrl('https://audiomack.com/user/song/test'), 'https://audiomack.com/user/song/test');
});

test('Apple Music downloader sends audio and identifies a preview fallback clearly', async () => {
    const { command, restore } = loadWithStub('../src/Commands/Downloader/applemusic', 'downloadAppleMusic', async () => ({
        buffer: Buffer.from('preview-audio'), title: 'Example track', artist: 'Example artist', thumbnail: 'https://example.com/cover.jpg',
        isPreviewFallback: true, mimetype: 'audio/mp4', extension: 'm4a', mediaType: 'audio'
    }));
    const { sock, sent } = mockSock();
    const replies = [];
    try {
        await command.execute(sock, { chat: 'chat', key: {} }, { args: ['https://music.apple.com/us/song/example/123?i=456'], reply: async value => replies.push(value) });
        const audioMessage = sent.find(([, payload]) => payload.audio);
        assert.ok(audioMessage);
        assert.equal(audioMessage[1].mimetype, 'audio/mp4');
        assert.match(audioMessage[1].fileName, /\.m4a$/);
        assert.ok(sent.some(([, payload]) => payload.image && /official preview/i.test(payload.caption)));
        assert.deepEqual(replies, []);
    } finally { restore(); }
});

test('Threads and RedNote carousel handlers send every prepared image individually', async () => {
    const images = [
        { buffer: Buffer.from('image-one'), mimetype: 'image/jpeg' },
        { buffer: Buffer.from('image-two'), mimetype: 'image/png' }
    ];
    for (const [file, provider, url] of [
        ['../src/Commands/Downloader/threads', 'threads', 'https://threads.net/@user/post/abc'],
        ['../src/Commands/Downloader/rednote', 'rednote', 'https://www.xiaohongshu.com/explore/abc'],
        ['../src/Commands/Downloader/Pinterest', 'pinterest', 'https://www.pinterest.com/pin/123456/']
    ]) {
        const { command, restore } = loadWithStub(file, 'downloadUniversal', async () => ({ mediaType: 'photo', images, title: `${provider} post`, platform: provider }));
        const { sock, sent } = mockSock();
        const replies = [];
        try {
            await command.execute(sock, { chat: 'chat', key: {} }, { args: [url], reply: async value => replies.push(value) });
            const photos = sent.filter(([, payload]) => payload.image);
            assert.equal(photos.length, 2);
            assert.deepEqual(photos.map(([, payload]) => payload.image), images.map(item => item.buffer));
            assert.match(photos[0][1].caption, /1\/2/);
            assert.match(photos[1][1].caption, /2\/2/);
            assert.deepEqual(replies, provider === 'pinterest' ? ['_*✪ Downloading Pinterest media...*_'] : []);
        } finally { restore(); }
    }
});

test('Audiomack command sends M4A audio with the track metadata', async () => {
    const { command, restore } = loadWithStub('../src/Commands/Downloader/audiomack', 'downloadAudiomack', async () => ({
        buffer: Buffer.from('audiomack-audio'), title: 'Example song', artist: 'Artist', thumbnail: 'https://example.com/cover.jpg', mimetype: 'audio/mp4', extension: 'm4a', mediaType: 'audio'
    }));
    const { sock, sent } = mockSock();
    const replies = [];
    try {
        await command.execute(sock, { chat: 'chat', key: {} }, { args: ['https://audiomack.com/user/song/test'], reply: async value => replies.push(value) });
        const audioMessage = sent.find(([, payload]) => payload.audio);
        assert.ok(audioMessage);
        assert.equal(audioMessage[1].mimetype, 'audio/mp4');
        assert.match(audioMessage[1].fileName, /\.m4a$/);
        assert.ok(sent.some(([, payload]) => payload.image && /Example song/.test(payload.caption)));
        assert.deepEqual(replies, []);
    } finally { restore(); }
});

test('Audiomack audio/mp4 container passes the type check only when the response declares audio', async () => {
    const fixture = Buffer.from('000000186674797069736f6d0000020069736f6d6d703431', 'hex');
    const detected = await fromBuffer(fixture);
    assert.deepEqual(detected, { ext: 'mp4', mime: 'video/mp4' });

    const accepted = await socialDl.saveToBuffer(async file => {
        await writeFile(file, fixture);
        return { contentType: 'audio/mp4; charset=binary' };
    }, { extension: 'm4a', audio: true });
    assert.deepEqual(accepted, fixture);

    await assert.rejects(() => socialDl.saveToBuffer(async file => {
        await writeFile(file, fixture);
        return { contentType: 'video/mp4' };
    }, { extension: 'm4a', audio: true }), error => error.message === 'MEDIA_TYPE_MISMATCH');
});

test('generic sender sends photo results as images instead of video buffers', async () => {
    const { sent, sock } = mockSock();
    const result = await socialDl.sendDownloadedMedia(sock, { chat: 'chat', key: {} }, {
        mediaType: 'photo', title: 'Pinterest pin', images: [{ buffer: Buffer.from('jpeg'), mimetype: 'image/jpeg' }]
    }, 'Pinterest');
    assert.deepEqual(result, { sent: 1, total: 1, failed: 0, album: false });
    assert.ok(sent[0][1].image);
    assert.equal(sent[0][1].video, undefined);
});

test('generic sender groups URL-backed carousel images into the WhatsApp album API', async () => {
    let albumCall;
    const sock = {
        sendMessage: async () => { throw new Error('individual send should not be used'); },
        sendAlbumMessage: async (...args) => { albumCall = args; return { key: { id: 'album-1' } }; }
    };
    const images = [
        { buffer: Buffer.from('one'), mimetype: 'image/jpeg', url: 'https://cdn.example.com/one.jpg' },
        { buffer: Buffer.from('two'), mimetype: 'image/jpeg', url: 'https://cdn.example.com/two.jpg' }
    ];
    const result = await socialDl.sendDownloadedMedia(sock, { chat: 'chat', key: {} }, {
        mediaType: 'photo', title: 'Carousel', images
    }, 'Threads');
    assert.equal(result.album, true);
    assert.equal(result.sent, 2);
    assert.equal(albumCall[0], 'chat');
    assert.equal(albumCall[1].length, 2);
    assert.equal(albumCall[1][0].image.url, images[0].url);
    assert.equal(albumCall[2].footer, 'Photo carousel · 2 images');
});

test('TikTok downloader sends every carousel image rather than a video payload', async () => {
    const images = [
        { buffer: Buffer.from('tiktok-image-one'), mimetype: 'image/jpeg' },
        { buffer: Buffer.from('tiktok-image-two'), mimetype: 'image/jpeg' }
    ];
    const { command, restore } = loadWithStub('../src/Commands/Downloader/Tikd', 'downloadTikTok', async () => ({ mediaType: 'photo', images, title: 'TikTok carousel' }));
    const { sock, sent } = mockSock();
    const replies = [];
    try {
        await command.execute(sock, { chat: 'chat', key: {} }, { args: ['https://www.tiktok.com/@user/photo/123'], reply: async value => replies.push(value) });
        const photos = sent.filter(([, payload]) => payload.image);
        assert.equal(photos.length, 2);
        assert.equal(sent.some(([, payload]) => payload.video), false);
        assert.deepEqual(replies, []);
    } finally { restore(); }
});
