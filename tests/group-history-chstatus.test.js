'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const toggleHistory = require('../src/Commands/Group/togglehistory');
const channelStatus = require('../src/Commands/Tools/chstatus');

const channelJid = '120363402922206865@newsletter';
const chat = '15550000000@s.whatsapp.net';

function makeMessage(quoted) {
    return { chat, key: { id: 'command-1' }, ...(quoted ? { quoted } : {}) };
}

test('togglehistory enables all-member group-history sharing for admins', async () => {
    const calls = [];
    const replies = [];
    await toggleHistory.execute({ toggleGroupHistory: async (...args) => calls.push(args) },
        { chat: '12345@g.us' },
        { args: ['on'], prefix: '/', reply: async value => replies.push(value) });
    assert.deepEqual(calls, [['12345@g.us', true]]);
    assert.match(replies[0], /enabled for all members/i);
});

test('togglehistory off restricts sharing to admins', async () => {
    const calls = [];
    await toggleHistory.execute({ toggleGroupHistory: async (...args) => calls.push(args) },
        { chat: '12345@g.us' },
        { args: ['off'], reply: async () => {} });
    assert.deepEqual(calls, [['12345@g.us', false]]);
});

test('togglehistory rejects missing mode and private chats without calling the socket method', async () => {
    let calls = 0;
    const replies = [];
    const sock = { toggleGroupHistory: async () => { calls++; } };
    await toggleHistory.execute(sock, { chat: '12345@g.us' }, { args: [], reply: async value => replies.push(value) });
    await toggleHistory.execute(sock, { chat }, { args: ['on'], reply: async value => replies.push(value) });
    assert.equal(calls, 0);
    assert.match(replies[0], /Usage:/);
    assert.match(replies[1], /only be used in a group/i);
});

test('chstatus posts text to a channel JID using sendNewsletterStatus', async () => {
    const calls = [];
    const replies = [];
    const sock = {
        sendNewsletterStatus: async (...args) => calls.push(args),
        sendMessage: async () => { throw new Error('should not need a regular channel message'); }
    };
    await channelStatus.execute(sock, makeMessage(), {
        args: [channelJid, 'A', 'status'],
        reply: async value => replies.push(value)
    });
    assert.deepEqual(calls, [[channelJid, { text: 'A status' }]]);
    assert.match(replies.at(-1), /posted successfully/i);
});

test('chstatus resolves an invite link and posts a replied image with caption', async () => {
    const calls = [];
    const resolved = [];
    const image = Buffer.from('image-bytes');
    const sock = {
        newsletterGetInviteInfo: async link => {
            resolved.push(link);
            return { id: channelJid };
        },
        sendNewsletterStatus: async (...args) => calls.push(args),
        sendMessage: async () => ({})
    };
    const link = 'https://whatsapp.com/channel/0029Vb6pe77K0IBn48HLKb38';
    await channelStatus.execute(sock, makeMessage({
        mtype: 'imageMessage',
        mimetype: 'image/jpeg',
        caption: 'Original caption',
        download: async () => image
    }), {
        args: [link],
        reply: async () => {}
    });
    assert.deepEqual(resolved, [link]);
    assert.deepEqual(calls, [[channelJid, { image, mimetype: 'image/jpeg', caption: 'Original caption' }]]);
});

test('chstatus posts a replied video and uses extra command text as its caption', async () => {
    const calls = [];
    const video = Buffer.from('video-bytes');
    const sock = {
        sendNewsletterStatus: async (...args) => calls.push(args),
        sendMessage: async () => ({})
    };
    await channelStatus.execute(sock, makeMessage({
        mtype: 'videoMessage',
        mimetype: 'video/mp4',
        download: async () => video
    }), {
        args: [channelJid, 'Video', 'caption'],
        reply: async () => {}
    });
    assert.deepEqual(calls, [[channelJid, { video, mimetype: 'video/mp4', caption: 'Video caption' }]]);
});
