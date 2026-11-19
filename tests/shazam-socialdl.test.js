'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const command = require('../src/Commands/Search/shazam');
const socialDl = require('../src/Plugin/socialDl');

const chat = '15550000000@s.whatsapp.net';
const sender = '15550000000@s.whatsapp.net';

test('ACRCloud signature uses the original host and endpoint order', () => {
    const config = {
        host: 'identify-eu-west-1.acrcloud.com',
        endpoint: '/v1/identify',
        data_type: 'audio',
        signature_version: '1',
        access_key: 'test-access-key',
        access_secret: 'test-access-secret'
    };
    const timestamp = 1700000000;
    const stringToSign = [
        'POST', 'identify-eu-west-1.acrcloud.com', '/v1/identify', 'audio', '1', String(timestamp)
    ].join('\n');

    assert.equal(
        command.helpers.buildStringToSign('POST', config.host, config.endpoint, config.data_type, config.signature_version, timestamp),
        stringToSign
    );
    const expectedSignature = crypto.createHmac('sha1', config.access_secret)
        .update(stringToSign, 'utf8')
        .digest('base64');
    assert.equal(command.helpers.buildIdentifySignature(timestamp, config), expectedSignature);
});

function makeMessage(id) {
    return { chat, sender, key: { id, remoteJid: chat } };
}

test('Shazam uses the requested location button card with MP3 and MP4 command IDs', async () => {
    const calls = [];
    const message = makeMessage('shazam-card');
    const song = { title: 'Test song', artist: 'Test artist', album: 'Test album', released: '2026', duration: '180s' };
    const video = { url: 'https://youtube.com/watch?v=abc123' };
    const thumbnail = Buffer.from('thumbnail');
    const sock = { sendLocationButtonCard: async (...args) => calls.push(args) };

    await command.helpers.sendChoiceCard(sock, message, song, video, '/', thumbnail);

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], chat);
    assert.equal(calls[0][1].title, 'New Cody • Online');
    assert.equal(calls[0][1].subtitle, 'Type npm i plogme@2.2.5');
    assert.equal(calls[0][1].text, '╭━︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎➲ MENU︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ︎ ━╮\nChoose an option below.');
    assert.equal(calls[0][1].thumbnail, thumbnail);
    assert.deepEqual(calls[0][1].buttons, [
        { id: '/shazam mp3', text: '🎵 MP3' },
        { id: '/shazam mp4', text: '🎬 MP4' }
    ]);
});

test('Shazam button actions use social-dl in audio-only MP3 and video MP4 modes', async () => {
    const originalDownload = socialDl.downloadYouTube;
    const originalSend = socialDl.sendDownloadedMedia;
    const calls = [];
    const sent = [];
    const message = makeMessage('shazam-download');
    const key = command.helpers.sessionKey(message);
    command.activeSessions.set(key, {
        title: 'Test song',
        videoUrl: 'https://www.youtube.com/watch?v=abc123',
        createdAt: Date.now()
    });
    socialDl.downloadYouTube = async (url, options) => {
        calls.push({ url, options });
        return {
            buffer: Buffer.from('test-media'),
            mimetype: options.audioOnly ? 'audio/mpeg' : 'video/mp4',
            extension: options.audioOnly ? 'mp3' : 'mp4',
            mediaType: options.audioOnly ? 'audio' : 'video'
        };
    };
    socialDl.sendDownloadedMedia = async (...args) => sent.push(args);
    const replies = [];
    const sock = { sendMessage: async () => ({}) };

    try {
        await command.execute(sock, message, { args: ['mp3'], reply: async text => replies.push(text) });
        await command.execute(sock, message, { args: ['mp4'], reply: async text => replies.push(text) });

        assert.deepEqual(calls, [
            { url: 'https://www.youtube.com/watch?v=abc123', options: { audioOnly: true } },
            { url: 'https://www.youtube.com/watch?v=abc123', options: { audioOnly: false } }
        ]);
        assert.equal(sent.length, 2);
        assert.equal(sent[0][2].fileName, 'Test_song.mp3');
        assert.equal(sent[1][2].fileName, 'Test_song.mp4');
        assert.equal(replies.length, 0);
    } finally {
        socialDl.downloadYouTube = originalDownload;
        socialDl.sendDownloadedMedia = originalSend;
        command.activeSessions.delete(key);
    }
});
