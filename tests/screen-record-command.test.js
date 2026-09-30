'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const command = require('../src/Commands/Tools/ScreenRecord.js');

test('screen-record command extracts and normalizes unique URLs', () => {
    assert.deepEqual(command.extractUrls('example.com, https://example.com/page! example.org'), [
        'https://example.com/',
        'https://example.com/page',
        'https://example.org/'
    ]);
});

test('downloadRecording resolves Snapshot metadata then downloads the MP4', async () => {
    const calls = [];
    const httpClient = {
        get: async (url, options) => {
            calls.push({ url, options });
            if (url.endsWith('/record')) return { data: { status: 'completed', videoUrl: '/api/videos/abc.mp4' } };
            return { data: Uint8Array.from([0, 1, 2, 3]) };
        }
    };

    const buffer = await command.downloadRecording('https://example.com/', 'mobile', httpClient);
    assert.deepEqual(buffer, Buffer.from([0, 1, 2, 3]));
    assert.equal(calls[0].url, 'https://snapshot.xwolf.space/api/record');
    assert.deepEqual(calls[0].options.params, { siteUrl: 'https://example.com/', viewport: 'mobile' });
    assert.equal(calls[1].url, 'https://snapshot.xwolf.space/api/videos/abc.mp4');
    assert.equal(calls[1].options.responseType, 'arraybuffer');
});

test('screen-record command sends only the video payload', async () => {
    const sent = [];
    const replies = [];
    const originalDownload = command.downloadRecording;
    command.downloadRecording = async (url, viewport) => {
        assert.equal(url, 'https://example.com/');
        assert.equal(viewport, 'mobile');
        return Buffer.from('mp4');
    };

    try {
        await command.execute({
            sendMessage: async (...args) => sent.push(args)
        }, {
            body: '.wssrmobile example.com',
            chat: 'chat@s.whatsapp.net',
            key: { id: 'incoming' }
        }, {
            args: ['example.com'],
            reply: async value => replies.push(value)
        });
    } finally {
        command.downloadRecording = originalDownload;
    }

    assert.equal(replies.length, 0);
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0][1], {
        video: Buffer.from('mp4'),
        mimetype: 'video/mp4',
        fileName: 'website-screen-recording.mp4'
    });
});
