'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mention = require('../src/Commands/Owner/mention');

function makePcmWav(durationMs = 160) {
    const sampleRate = 8000;
    const samples = Math.floor(sampleRate * durationMs / 1000);
    const dataSize = samples * 2;
    const wav = Buffer.alloc(44 + dataSize);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + dataSize, 4);
    wav.write('WAVE', 8);
    wav.write('fmt ', 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(sampleRate, 24);
    wav.writeUInt32LE(sampleRate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(dataSize, 40);
    for (let i = 0; i < samples; i++) {
        wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 5000), 44 + i * 2);
    }
    return wav;
}

test('ordinary WAV audio converts to an Ogg Opus voice-note payload', async () => {
    const converted = await mention.convertToVoiceNote(makePcmWav());
    assert.ok(converted.length > 100);
    assert.equal(converted.subarray(0, 4).toString(), 'OggS');
});

test('mention voice playback sends the configured buffer as a quoted PTT audio note', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-mention-voice-'));
    const audioPath = path.join(directory, 'voice.ogg');
    const audio = Buffer.from('OggS-test-opus-payload');
    fs.writeFileSync(audioPath, audio);
    const previous = { ...mention.mentionConfig };
    try {
        mention.mentionConfig.voice = audioPath;
        mention.mentionConfig.voiceMime = 'audio/ogg; codecs=opus';
        mention.mentionConfig.voicePtt = true;
        let sent;
        await mention.sendMentionVoice({ sendMessage: async (...args) => { sent = args; } }, '123@g.us', { quoted: { key: 'source-message' } });
        assert.equal(sent[0], '123@g.us');
        assert.ok(sent[1].audio.equals(audio));
        assert.equal(sent[1].mimetype, 'audio/ogg; codecs=opus');
        assert.equal(sent[1].ptt, true);
        assert.equal(sent[2].quoted.key, 'source-message');
    } finally {
        Object.assign(mention.mentionConfig, previous);
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
