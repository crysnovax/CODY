const test = require('node:test');
const assert = require('node:assert/strict');
const ping = require('../src/Commands/Bot/ping');

test('ping sends one quoted final reply for a direct LID chat without an edit', async () => {
    const chat = '120495828323239@lid';
    const message = {
        chat,
        key: { remoteJid: chat, id: 'ping-command-id', fromMe: false },
        messageTimestamp: Math.floor(Date.now() / 1000),
    };
    const sent = [];
    const sock = {
        async sendMessage(...args) {
            sent.push(args);
            return { key: { remoteJid: chat, id: 'ping-reply-id', fromMe: true } };
        },
    };
    const reply = text => sock.sendMessage(chat, { text }, { quoted: message });

    await ping.execute(sock, message, { reply });

    assert.equal(sent.length, 1);
    assert.equal(sent[0][0], chat);
    assert.equal(sent[0][2].quoted, message);
    assert.match(sent[0][1].text, /Pong! \d+ms/);
    assert.equal('edit' in sent[0][1], false);
});
