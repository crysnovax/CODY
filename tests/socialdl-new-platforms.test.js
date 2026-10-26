'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { writeFile } = require('node:fs/promises');
const { fromBuffer } = require('file-type');
const socialDl = require('../src/Plugin/socialDl');

function loadWithStub(file, method, stub) {
    const commandPath = require.resolve(file);
    const sharedFactoryPath = require.resolve('../src/Plugin/socialVideoCommand');
    const original = socialDl[method];
    socialDl[method] = stub;
    delete require.cache[commandPath];
    delete require.cache[sharedFactoryPath];
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

const shortDramaCommands = [
    ['dramabox', 'DramaBox', 'https://sharet.dramabox.com/play?bid=42000021648&cid=701326021&cindex=23&lan=en'],
    ['dramafren', 'DramaFren', 'https://dramafren.org/watch/example/'],
    ['goodshort', 'GoodShort', 'https://www.goodshort.com/episode/example-31001365025/067-17989995'],
    ['flextv', 'FlexTV', 'https://www.flextv.cc/episodes/episode-1-a-pinch-of-little-witch-A3zjDM5ZXY'],
    ['moboreels', 'MoboReels', 'https://www.moboreels.com/episode/daddy-will-you-love-me-112418322-01'],
    ['reelshort', 'ReelShort', 'https://www.reelshort.com/en/embed/6aafa7fc530d47585a054f74-aqthox3d16'],
    ['anydrama', 'AnyDrama', 'https://any-drama.com/en/watch/shortmax-mommy-im-not-lyingupdating-18550'],
    ['shortmax', 'ShortMax', 'https://www.shorttv.live/episode/mommy-im-not-lying-18550-1'],
    ['flickreels', 'FlickReels', 'https://www.flickreels.net/playlist/drama/12345/episode-1']
];

test('new social-dl platform commands recognize their provider links', () => {
    for (const [name, , url] of shortDramaCommands) {
        const command = require(`../src/Commands/Downloader/${name}`);
        assert.equal(command.name, name);
        assert.equal(command.findUrl(`download this: ${url}`), url);
    }
    const dramabox = require('../src/Commands/Downloader/dramabox');
    assert.equal(dramabox.findUrl('https://sharet.dramabox.com/play?bid=42000021648&cid=701326021&cindex=23&lan=en'), shortDramaCommands[0][2]);
    assert.equal(dramabox.findUrl('https://www.dramaboxdb.com/ep/42000021648_title/701326021_Episode-24'), 'https://www.dramaboxdb.com/ep/42000021648_title/701326021_Episode-24');
});

test('new social-dl platform commands use universal save and deliver video media', async () => {
    for (const [name, label, url] of shortDramaCommands) {
        const { command, restore } = loadWithStub(`../src/Commands/Downloader/${name}`, 'downloadUniversal', async (suppliedUrl, options) => {
            assert.equal(suppliedUrl, url);
            assert.deepEqual(options, { quality: 'best', lan: 'en' });
            return { buffer: Buffer.from(`${name}-video`), title: `${label} episode`, platform: name === 'reelshort' ? 'anydrama' : name, mimetype: 'video/mp4', extension: 'mp4', mediaType: 'video' };
        });
        const { sock, sent } = mockSock();
        const replies = [];
        try {
            await command.execute(sock, { chat: 'chat', key: {} }, { args: [url, '--best', '--lan', 'en'], reply: async value => replies.push(value) });
            const video = sent.find(([, payload]) => payload.video);
            assert.ok(video, `${name} should send a video payload`);
            assert.deepEqual(video[1].video, Buffer.from(`${name}-video`));
            assert.match(video[1].caption, new RegExp(`${label} Downloader`));
            assert.deepEqual(replies, []);
        } finally { restore(); }
    }
});

test('short-drama commands support quality/lang aliases and reject unsupported flags', async () => {
    const url = shortDramaCommands[0][2];
    const calls = [];
    const { command, restore } = loadWithStub('../src/Commands/Downloader/dramabox', 'downloadUniversal', async (suppliedUrl, options) => {
        calls.push({ suppliedUrl, options });
        return { buffer: Buffer.from('video'), title: 'DramaBox episode', platform: 'dramabox', mimetype: 'video/mp4', extension: 'mp4', mediaType: 'video' };
    });
    const { sock } = mockSock();
    const replies = [];
    try {
        await command.execute(sock, { chat: 'chat', key: {} }, { args: [url, '--quality', '720p', '--lang', 'id', '--no-watermark'], reply: async value => replies.push(value) });
        assert.deepEqual(calls, [{ suppliedUrl: url, options: { quality: '720p', lan: 'id', noWatermark: true } }]);

        await command.execute(sock, { chat: 'chat', key: {} }, { args: [url, '--unknown'], reply: async value => replies.push(value) });
        assert.equal(calls.length, 1);
        assert.match(replies[0], /Unsupported option: --unknown/);
        assert.match(replies[0], /--best/);
    } finally { restore(); }
});


test('HLS and MPD source metadata use an MP4 output extension', () => {
    assert.equal(socialDl.universalOutputExtension({ downloadExtension: 'm3u8' }), 'mp4');
    assert.equal(socialDl.universalOutputExtension({ downloadExtension: 'mpd' }), 'mp4');
    assert.equal(socialDl.universalOutputExtension({ downloadExtension: 'm4v' }), 'm4v');
    assert.equal(socialDl.universalOutputExtension({ downloadExtension: 'm3u8' }, true), 'm3u8');
});
