'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const previousCwd = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-antilink-caption-'));
fs.mkdirSync(path.join(tempRoot, 'database'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'database', 'antilink.json'), JSON.stringify({
    '120363000000000000@g.us': {
        enabled: true,
        action: 'delete',
        whitelist: [],
        permit: [],
        domains: []
    }
}));
process.chdir(tempRoot);
const { handleAntiLink } = require('../src/Commands/Admin/antilink.js');
process.chdir(previousCwd);

test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

for (const [label, messageType, caption] of [
    ['video caption', 'videoMessage', 'Check this out: https://video.example.org/watch'],
    ['image/link caption', 'imageMessage', 'Join here: https://chat.whatsapp.com/CaptionInvite123']
]) {
    test(`antilink deletes a group message containing a URL in its ${label}`, async () => {
        const sender = '15550001111@s.whatsapp.net';
        const chat = '120363000000000000@g.us';
        const key = { remoteJid: chat, participant: sender, id: `caption-${messageType}`, fromMe: false };
        const message = { [messageType]: { caption, url: 'https://mmg.whatsapp.net/media/transport' } };
        const mek = { key, message };
        const m = {
            isGroup: true,
            chat,
            sender,
            key,
            mtype: messageType,
            message,
            text: '',
            body: ''
        };
        const sends = [];
        const sock = {
            groupMetadata: async () => ({
                participants: [{ id: '15550002222@s.whatsapp.net', admin: 'admin' }]
            }),
            sendMessage: async (jid, content, options) => {
                sends.push({ jid, content, options });
                return { key: { id: `sent-${sends.length}` } };
            }
        };

        await handleAntiLink(sock, m, mek);

        const deletion = sends.find(({ content }) => content?.delete);
        assert.ok(deletion, 'the URL caption should trigger a delete request');
        assert.equal(deletion.jid, chat);
        assert.equal(deletion.content.delete.id, key.id);
        assert.ok(sends.some(({ content }) => content?.text?.includes('Link detected!')));
        assert.ok(!sends.some(({ content }) => content?.text?.includes('mmg.whatsapp.net')));
    });
}
