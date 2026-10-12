'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { canRunBroadcast } = require('../src/Plugin/broadcastAccess');

// The project dependencies are not installed in every test workspace; these
// two lightweight stubs are only needed to load spamgs without starting jobs.
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
    if (request === 'node-cron') return { schedule: () => ({ stop() {} }) };
    if (request === 'plogme') return { proto: { WebMessageInfo: { fromObject: value => value } } };
    return originalLoad.call(this, request, parent, isMain);
};
const broadcast = require('../src/Commands/Admin/broadcast');
const spamgs = require('../src/Commands/Admin/spamgs');
Module._load = originalLoad;

test('broadcast and spamgs can be invoked outside group chats', () => {
    for (const command of [broadcast, spamgs]) {
        assert.equal(command.groupOnly, false, `${command.name} must not be group-only`);
        assert.equal(command.adminOnly, false, `${command.name} uses its own context-aware permission check`);
    }
});

test('mass group commands allow group admins in groups and owner/dual accounts in DMs only', () => {
    assert.equal(canRunBroadcast({ isGroup: true }, { isAdmin: true }), true);
    assert.equal(canRunBroadcast({ isGroup: true }, { isGroupAdmin: true }), true);
    assert.equal(canRunBroadcast({ isGroup: true }, {}), false);
    assert.equal(canRunBroadcast({ isGroup: false }, { isOwner: true }), true);
    assert.equal(canRunBroadcast({ isGroup: false }, { isDual: true }), true);
    assert.equal(canRunBroadcast({ isGroup: false }, { isSudo: true }), false);
    assert.equal(canRunBroadcast({ isGroup: false }, {}), false);
});

test('broadcast and spamgs reject unauthorized DMs before touching group APIs', async () => {
    const replies = [];
    let groupFetches = 0;
    const sock = { groupFetchAllParticipating: async () => { groupFetches++; return {}; } };
    for (const command of [broadcast, spamgs]) {
        const reply = async text => { replies.push(text); };
        await command.execute(sock, { isGroup: false, chat: 'private@s.whatsapp.net' }, {
            args: ['hello'], prefix: '.', reply,
        });
    }
    assert.equal(groupFetches, 0);
    assert.equal(replies.length, 2);
    assert.ok(replies.every(text => /Only the bot owner/.test(text)));
});

test('owner can invoke both all-groups commands from a private chat', async () => {
    const replies = [];
    const sock = { groupFetchAllParticipating: async () => ({}) };
    const m = { isGroup: false, chat: 'owner@s.whatsapp.net' };
    await broadcast.execute(sock, m, {
        args: ['hello'], isOwner: true, reply: async text => { replies.push(text); },
    });
    await spamgs.execute(sock, m, {
        args: ['1', '1s', 'hello'], prefix: '.', isOwner: true,
        reply: async text => { replies.push(text); },
    });
    assert.equal(replies.length, 2);
    assert.ok(replies.every(text => !/Only the bot owner/.test(text)));
});

test('broadcast forwards the complete quoted envelope instead of sending invisible text', async () => {
    const sent = [];
    const source = {
        key: { remoteJid: 'source@g.us', id: 'quoted-rich-1', fromMe: false },
        message: {
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: [{ messageType: 1, messageText: 'Testing' }],
                    },
                },
            },
        },
    };
    const sock = {
        groupFetchAllParticipating: async () => ({
            'one@g.us': {},
            'two@g.us': {},
        }),
        sendMessage: async (...args) => { sent.push(args); return {}; },
    };
    const replies = [];
    await broadcast.execute(sock, {
        isGroup: true,
        chat: 'source@g.us',
        quoted: { fakeObj: source },
    }, {
        args: ['Testing', '┊', 'broadcast', '┊', '⚉'],
        isAdmin: true,
        reply: async text => replies.push(text),
    });
    assert.equal(sent.length, 2);
    assert.ok(sent.every(([, content]) => content.forward === source));
    assert.ok(sent.every(([, content]) => content.force === true));
    assert.ok(sent.every(([, content]) => content.text === undefined));
    assert.match(replies[0], /original quoted message/);
});

test('spamgs sends quoted content as a native group status to every group', async () => {
    const sent = [];
    const source = {
        key: { remoteJid: 'source@g.us', id: 'quoted-status-1', fromMe: false },
        message: { imageMessage: { caption: 'scheduled image' } },
    };
    const sock = {
        groupFetchAllParticipating: async () => ({
            'one@g.us': {},
            'two@g.us': {},
            'not-a-group@s.whatsapp.net': {},
        }),
        sendMessage: async (...args) => { sent.push(args); return {}; },
    };
    const replies = [];
    await spamgs.execute(sock, {
        isGroup: true,
        chat: 'source@g.us',
        quoted: { fakeObj: source },
    }, {
        args: ['1', '1s'],
        isAdmin: true,
        prefix: '.',
        reply: async text => replies.push(text),
    });
    assert.equal(sent.length, 2);
    assert.deepEqual(sent.map(([jid]) => jid), ['one@g.us', 'two@g.us']);
    assert.ok(sent.every(([, content]) => content.forward === source));
    assert.ok(sent.every(([, content]) => content.force === true));
    assert.ok(sent.every(([, content]) => content.groupStatus === true));
    assert.match(replies[0], /posted 1 time\(s\) to 2 group\(s\)/);
});
