'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const socialDl = require('../src/Plugin/socialDl');
const commandPath = require.resolve('../src/Commands/Downloader/Spotify');

function loadSpotifyCommand(download) {
    const original = socialDl.downloadSpotify;
    socialDl.downloadSpotify = download;
    delete require.cache[commandPath];
    const command = require(commandPath);
    return {
        command,
        restore() {
            socialDl.downloadSpotify = original;
            delete require.cache[commandPath];
        }
    };
}

test('Spotify command sends MP3 when the socket has no presence-update method', async () => {
    const calls = [];
    const { command, restore } = loadSpotifyCommand(async url => {
        calls.push(url);
        return { buffer: Buffer.from('spotify-mp3'), title: 'Track', artist: 'Artist', thumbnail: null };
    });
    const sent = [];
    const replies = [];
    try {
        await command.execute({
            sendMessage: async (...args) => { sent.push(args); }
        }, { chat: 'chat-id', key: {} }, {
            args: ['https://open.spotify.com/track/7jT3LcNj4XPYOlbNkPWNhU'],
            reply: async message => replies.push(message)
        });
        assert.deepEqual(calls, ['https://open.spotify.com/track/7jT3LcNj4XPYOlbNkPWNhU']);
        assert.equal(sent.length, 1);
        assert.deepEqual(sent[0][1].audio, Buffer.from('spotify-mp3'));
        assert.equal(sent[0][1].mimetype, 'audio/mpeg');
        assert.deepEqual(replies, []);
    } finally {
        restore();
    }
});

test('Spotify command does not describe downloader errors as a private-link problem', async () => {
    const { command, restore } = loadSpotifyCommand(async () => { throw new Error('provider unavailable'); });
    const replies = [];
    const originalError = console.error;
    console.error = () => {};
    try {
        await command.execute({ sendMessage: async () => {} }, { chat: 'chat-id', key: {} }, {
            args: ['https://open.spotify.com/track/7jT3LcNj4XPYOlbNkPWNhU'],
            reply: async message => replies.push(message)
        });
        assert.equal(replies.length, 1);
        assert.match(replies[0], /link may be fine/i);
        assert.match(replies[0], /Spotify downloader error/i);
    } finally {
        console.error = originalError;
        restore();
    }
});
