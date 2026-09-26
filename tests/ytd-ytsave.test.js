'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

global.prefix = global.prefix || '.';
const command = require('../src/Commands/Downloader/ytd.js');
const engine = require('../src/Plugin/ytsaveEngine.js');

test('ytd extracts YouTube URLs and maps media formats', () => {
    assert.equal(command.extractUrl('download https://youtu.be/abc123!!!'), 'https://youtu.be/abc123');
    assert.equal(command.extractUrl('https://www.youtube.com/watch?v=abc&list=PL1'), 'https://www.youtube.com/watch?v=abc&list=PL1');
    assert.deepEqual(command.sendKeysFor('track.mp3'), { key: 'audio', mimetype: 'audio/mpeg' });
    assert.deepEqual(command.sendKeysFor('clip.mp4'), { key: 'video', mimetype: 'video/mp4' });
});

test('ytd routes playlist/audio downloads through ytsave and cleans every result', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-ytd-command-'));
    const playlistFile = path.join(temp, 'Playlist', '01 - Song.mp3');
    fs.mkdirSync(path.dirname(playlistFile), { recursive: true });
    fs.writeFileSync(playlistFile, 'audio');

    const original = {
        isPlaylistUrl: engine.isPlaylistUrl,
        downloadVideo: engine.downloadVideo,
        downloadPlaylist: engine.downloadPlaylist,
        cleanup: engine.cleanup
    };
    const calls = [];
    let cleaned = null;
    engine.isPlaylistUrl = (url) => url.includes('list=');
    engine.downloadVideo = async () => { throw new Error('video path should not be selected'); };
    engine.downloadPlaylist = async (url, options) => {
        calls.push({ url, options });
        return { files: [playlistFile], output: temp, format: options.format };
    };
    engine.cleanup = (files) => {
        cleaned = files;
        for (const file of files) fs.rmSync(file, { force: true });
    };

    const sent = [];
    try {
        const count = await command.sendLocal(
            { sendMessage: async (...args) => sent.push(args) },
            { chat: '123@s.whatsapp.net', key: { id: 'msg-1' } },
            'https://www.youtube.com/playlist?list=PL1',
            'mp3'
        );
        assert.equal(count, 1);
        assert.deepEqual(calls, [{
            url: 'https://www.youtube.com/playlist?list=PL1',
            options: { format: 'mp3' }
        }]);
        assert.equal(sent.length, 1);
        assert.equal(sent[0][1].audio.toString(), 'audio');
        assert.equal(sent[0][1].mimetype, 'audio/mpeg');
        assert.deepEqual(cleaned, [playlistFile]);
        assert.equal(fs.existsSync(playlistFile), false);
    } finally {
        engine.isPlaylistUrl = original.isPlaylistUrl;
        engine.downloadVideo = original.downloadVideo;
        engine.downloadPlaylist = original.downloadPlaylist;
        engine.cleanup = original.cleanup;
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
