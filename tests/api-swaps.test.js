const test = require('node:test');
const assert = require('node:assert/strict');

// Mvi.js and unid.js interpolate the global prefix into their metadata, which
// the real loader sets before requiring command files.
global.prefix = global.prefix || '.';

const unid = require('../src/Commands/Downloader/unid');
const movieintel = require('../src/Commands/Search/Mvi');
const bancheck = require('../src/Commands/Owner/bancheck');

test('unidownload maps the prexzy aio v2 payload', () => {
    const media = unid.normalizeResult({
        platform: 'TikTok',
        result: {
            without_water_mark_mp4: 'https://cdn.example/video.mp4',
            water_mark_mp4: 'https://cdn.example/video-wm.mp4',
            mp3: 'https://cdn.example/audio.mp3',
            desc: 'a caption',
            author: 'someone',
            duration: 12,
            pics: [],
            thumb: 'https://cdn.example/thumb.jpg'
        }
    });

    assert.equal(media.video, 'https://cdn.example/video.mp4');
    assert.equal(media.audio, 'https://cdn.example/audio.mp3');
    assert.equal(media.platform, 'TikTok');
    assert.equal(media.title, 'a caption');
    assert.equal(media.duration, 12);
});

test('unidownload collects photo slideshow images', () => {
    const media = unid.normalizeResult({
        result: {
            pics: ['https://cdn.example/1.jpg', { url: 'https://cdn.example/2.jpg' }, { url: 'not-a-url' }]
        }
    });
    assert.deepEqual(media.images, ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg']);
});

test('movieintel maps the prexzy search payload', () => {
    const items = movieintel.getResults({
        results: { items: [{ title: 'Merlin', releaseDate: '2012-10-06', season: 5, genre: 'Drama' }] }
    });

    assert.equal(items.length, 1);
    assert.equal(movieintel.itemTitle(items[0]), 'Merlin S5');
    assert.match(movieintel.buildCaption(items[0]), /Merlin S5/);
});

test('movieintel treats a missing items array as no results', () => {
    assert.deepEqual(movieintel.getResults({ results: {} }), []);
    assert.deepEqual(movieintel.getResults(undefined), []);
});

test('bancheck.checkNumber unwraps the kyuux data envelope', async () => {
    const realFetch = global.fetch;
    global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { number: '15*****111', status: 'Safe', banned: false } })
    });
    try {
        const data = await bancheck.checkNumber('15550001111');
        assert.equal(data.status, 'Safe');
        assert.equal(data.banned, false);
    } finally {
        global.fetch = realFetch;
    }
});

test('bancheck.checkNumber throws on an unsuccessful envelope', async () => {
    const realFetch = global.fetch;
    global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: false, message: 'no number supplied' })
    });
    try {
        await assert.rejects(() => bancheck.checkNumber(''), /no number supplied/);
    } finally {
        global.fetch = realFetch;
    }
});
