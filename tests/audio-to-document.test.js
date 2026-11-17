'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const audio2doc = require('../src/Commands/Converter/audio2doc');
const voice2doc = require('../src/Commands/Converter/voice2doc');

function context(quoted) {
    const sent = [];
    const replies = [];
    const sock = {
        async sendMessage(chat, content, options) { sent.push({ chat, content, options }); },
    };
    const m = { chat: 'chat@s.whatsapp.net', key: { id: 'request-1' }, quoted };
    return { sock, m, sent, replies, opts: { reply: value => replies.push(value), prefix: '.', args: [] } };
}

test('audio2doc sends a regular audio file as a document', async () => {
    const quoted = { mtype: 'audioMessage', mimetype: 'audio/mpeg', fileName: 'track.mp3', ptt: false, download: async () => Buffer.from('audio-bytes') };
    const c = context(quoted);
    await audio2doc.execute(c.sock, c.m, c.opts);
    const document = c.sent.find(item => item.content.document);
    assert.equal(document.content.mimetype, 'audio/mpeg');
    assert.equal(document.content.fileName, 'track.mp3');
    assert.deepEqual(document.content.document, Buffer.from('audio-bytes'));
    assert.deepEqual(c.replies, []);
});

test('voice2doc sends a voice note as an ogg document', async () => {
    const quoted = { mtype: 'audioMessage', mimetype: 'audio/ogg; codecs=opus', ptt: true, download: async () => Buffer.from('voice-bytes') };
    const c = context(quoted);
    await voice2doc.execute(c.sock, c.m, c.opts);
    const document = c.sent.find(item => item.content.document);
    assert.equal(document.content.fileName, 'voice_note.ogg');
    assert.equal(document.content.mimetype, 'audio/ogg; codecs=opus');
});

test('audio2doc rejects voice notes and voice2doc rejects regular audio', async () => {
    const voice = context({ mtype: 'audioMessage', mimetype: 'audio/ogg', ptt: true, download: async () => Buffer.from('voice') });
    await audio2doc.execute(voice.sock, voice.m, voice.opts);
    assert.match(voice.replies[0], /regular audio/i);

    const audio = context({ mtype: 'audioMessage', mimetype: 'audio/mpeg', ptt: false, download: async () => Buffer.from('audio') });
    await voice2doc.execute(audio.sock, audio.m, audio.opts);
    assert.match(audio.replies[0], /voice note/i);
});
