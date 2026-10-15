'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'sharp') {
        return input => ({ resize: () => ({ jpeg: () => ({ toBuffer: async () => input }) }) });
    }
    if (request === 'plogme') {
        return {
            generateMessageIDV2: () => 'generated-status-id',
            prepareWAMessageMedia: async () => ({}),
            generateWAMessageContent: async () => ({}),
            buildLinkPreview: async () => ({ title: '', description: '' })
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const gsdm = require('../src/Commands/Group/gsdm');
const addmeta = require('../src/Commands/Group/addmeta');
Module._load = originalLoad;

const GROUP = '120363425204601114@g.us';

test('gsdm resolves group JIDs and WhatsApp invite links', async () => {
    assert.equal(await gsdm.resolveGroupTarget({}, GROUP), GROUP);
    const sock = {
        groupGetInviteInfo: async code => ({ id: GROUP, code })
    };
    assert.equal(await gsdm.resolveGroupTarget(sock, 'https://chat.whatsapp.com/InviteCode'), GROUP);
});

test('gsdm delegates content to gstatus while keeping the confirmation in the DM', async () => {
    const sent = [];
    const relayed = [];
    const replies = [];
    const sock = {
        user: { id: 'bot@s.whatsapp.net' },
        groupMetadata: async () => ({ participants: [] }),
        sendMessage: async (chat, content) => sent.push({ chat, content }),
        sendGroupStatus: async (jid, content) => {
            relayed.push({ jid, content });
            return { key: { id: 'status-id' } };
        }
    };
    const message = {
        chat: '15550000000@s.whatsapp.net',
        sender: '15550000000@s.whatsapp.net',
        key: { remoteJid: '15550000000@s.whatsapp.net', id: 'dm-message' },
        quoted: {}
    };
    await gsdm.execute(sock, message, {
        args: [GROUP, 'hello', 'from', 'DM'],
        text: `${GROUP} hello from DM`,
        reply: value => replies.push(value)
    });
    assert.equal(relayed[0].jid, GROUP);
    assert.deepEqual(relayed[0].content, { text: 'hello from DM' });
    assert.equal(sent[0].chat, message.chat);
    assert.match(replies.at(-1), /Posted successfully/);
});

test('addmeta supports here, group JIDs, and invite links', async () => {
    const calls = [];
    const replies = [];
    const sock = {
        aiGroupAddBot: async jid => calls.push(jid),
        groupGetInviteInfo: async () => ({ id: GROUP })
    };
    await addmeta.execute(sock, { chat: GROUP }, { args: ['here'], reply: value => replies.push(value) });
    await addmeta.execute(sock, { chat: '15550000000@s.whatsapp.net' }, { args: [GROUP], reply: value => replies.push(value) });
    await addmeta.execute(sock, { chat: '15550000000@s.whatsapp.net' }, { args: ['https://chat.whatsapp.com/InviteCode'], reply: value => replies.push(value) });
    assert.deepEqual(calls, [GROUP, GROUP, GROUP]);
    assert.equal(replies.length, 3);
    assert.match(replies[0], /Meta AI added/);
});

test('backup and restore no longer contain editable progress-message logic', () => {
    const source = require('fs').readFileSync(require('path').join(__dirname, '../src/Commands/System/BKRS.js'), 'utf8');
    assert.doesNotMatch(source, /progressMsg|updateProgress|edit:\s*progress/);
});
