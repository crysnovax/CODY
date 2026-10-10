'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const command = require('../src/Commands/Tools/tochannel');
const { resolveTarget, hasExplicitNonAdminRole, isAdminPublishError } = command.helpers;

test('resolves a WhatsApp channel JID and trailing post text', () => {
    assert.deepEqual(resolveTarget(['120363402922206865@newsletter', 'Hello', 'channel']), {
        jid: '120363402922206865@newsletter', link: null, inviteCode: null, text: 'Hello channel'
    });
});

test('resolves a channel invite link', () => {
    const target = resolveTarget(['https://whatsapp.com/channel/0029Vb6pe77K0IBn48HLKb38']);
    assert.equal(target.inviteCode, '0029Vb6pe77K0IBn48HLKb38');
    assert.equal(target.link, 'https://whatsapp.com/channel/0029Vb6pe77K0IBn48HLKb38');
});

test('recognizes explicit non-admin channel viewer roles', () => {
    assert.equal(hasExplicitNonAdminRole({ viewer_metadata: { role: 'FOLLOWER' } }), true);
    assert.equal(hasExplicitNonAdminRole({ viewer_metadata: { role: 'ADMIN' } }), false);
    assert.equal(hasExplicitNonAdminRole({}), false);
    assert.equal(isAdminPublishError(new Error('not authorized to publish')), true);
});

test('posts text to a newsletter JID', async () => {
    const sent = [];
    const replies = [];
    const sock = {
        newsletterMetadata: async (type, jid) => ({ id: jid, viewer_metadata: { role: 'ADMIN' } }),
        sendMessage: async (...args) => sent.push(args)
    };
    await command.execute(sock, { chat: 'user@s.whatsapp.net', key: { id: 'msg1' } }, {
        args: ['120363402922206865@newsletter', 'Hello', 'there'],
        reply: async text => replies.push(text)
    });
    assert.equal(sent[0][0], '120363402922206865@newsletter');
    assert.deepEqual(sent[0][1], { text: 'Hello there' });
    assert.match(replies.at(-1), /Posted to channel/);
});

test('resolves the supplied channel invite URL and posts to its newsletter JID', async () => {
    const sent = [];
    const resolvedLinks = [];
    const sock = {
        newsletterGetInviteInfo: async link => {
            resolvedLinks.push(link);
            return { id: '120363402922206865@newsletter', viewer_metadata: { role: 'ADMIN' } };
        },
        sendMessage: async (...args) => sent.push(args)
    };
    await command.execute(sock, { chat: 'user@s.whatsapp.net', key: { id: 'msg-link' } }, {
        args: ['https://whatsapp.com/channel/0029Vb6pe77K0IBn48HLKb38', 'A', 'post'],
        reply: async () => {}
    });
    assert.deepEqual(resolvedLinks, ['https://whatsapp.com/channel/0029Vb6pe77K0IBn48HLKb38']);
    assert.equal(sent[0][0], '120363402922206865@newsletter');
    assert.deepEqual(sent[0][1], { text: 'A post' });
});

test('downloads and posts replied video media with its caption', async () => {
    const sent = [];
    const rawVideo = Buffer.from('video bytes');
    const sock = {
        newsletterMetadata: async (_type, jid) => ({ id: jid, viewer_metadata: { role: 'OWNER' } }),
        sendMessage: async (...args) => sent.push(args)
    };
    await command.execute(sock, {
        chat: 'user@s.whatsapp.net', key: { id: 'msg2' },
        quoted: { mtype: 'videoMessage', mimetype: 'video/mp4', caption: 'A clip', download: async () => rawVideo }
    }, {
        args: ['120363402922206865@newsletter'], reply: async () => {}
    });
    assert.equal(sent[0][0], '120363402922206865@newsletter');
    assert.equal(sent[0][1].video, rawVideo);
    assert.equal(sent[0][1].caption, 'A clip');
});

test('returns the admin error without sending when channel metadata says viewer is not an admin', async () => {
    const replies = [];
    let sendCount = 0;
    const sock = {
        newsletterMetadata: async (_type, jid) => ({ id: jid, viewer_metadata: { role: 'FOLLOWER' } }),
        sendMessage: async () => { sendCount++; }
    };
    await command.execute(sock, { chat: 'user@s.whatsapp.net', key: { id: 'msg3' } }, {
        args: ['120363402922206865@newsletter', 'Hello'], reply: async text => replies.push(text)
    });
    assert.equal(sendCount, 0);
    assert.match(replies[0], /You are not an admin in this channel/);
});
