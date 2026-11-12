'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

global.prefix ??= '.';
const everyone = require('../src/Commands/Group/everyone.js');
const tagall = require('../src/Commands/Admin/tagall.js');
const { canTag, quotedText, participantIds } = require('../src/Plugin/groupTag.js');
const { isPrivateModeExempt } = require('../src/Plugin/crysMsg.js');
const registry = require('../src/Plugin/crysCmd.js');

test('everyone allows all senders in public mode but requires group staff in private mode', () => {
    assert.equal(canTag({ config: { status: { public: true } } }), true);
    assert.equal(canTag({ config: { status: { public: false } } }), false);
    assert.equal(canTag({ config: { status: { public: 'false' } } }), false);
    assert.equal(canTag({ config: { status: { public: false } }, isAdmin: true }), true);
    assert.equal(canTag({ config: { status: { public: false } }, isSudo: true }), true);
    assert.equal(canTag({ config: { status: { public: false } }, isDual: true }), true);
    assert.equal(canTag({ config: { status: { public: false } }, isOwner: true }), true);
});

test('private-mode router exception is explicit and leaves ordinary commands gated', () => {
    assert.equal(everyone.allowInPrivateMode, true);
    assert.equal(isPrivateModeExempt('everyone', everyone), true);
    assert.equal(isPrivateModeExempt('appeal', {}), true);
    assert.equal(isPrivateModeExempt('tagall', tagall), false);
});

test('everyone extracts quoted plain, extended, and caption text', () => {
    assert.equal(quotedText({ quoted: { msg: '  Plain quote  ' } }), 'Plain quote');
    assert.equal(quotedText({ quoted: { message: { extendedTextMessage: { text: 'Quoted text' } } } }), 'Quoted text');
    assert.equal(quotedText({ quoted: { message: { imageMessage: { caption: 'Photo caption' } } } }), 'Photo caption');
    assert.equal(quotedText({}), '');
});

test('everyone sends the green group tag with participant mentions and the chosen subject', async () => {
    const sent = [];
    const replies = [];
    const m = { chat: '12036301234567890@g.us', key: { id: 'quoted-message' } };
    const groupMeta = {
        participants: [
            { id: '234800000001@s.whatsapp.net' },
            { jid: '234800000002@s.whatsapp.net' },
            { phoneNumber: '234800000003' },
            { id: '234800000001@s.whatsapp.net' }
        ]
    };
    const sock = {
        sendMessage: async (...args) => sent.push(args),
        groupMetadata: async () => { throw new Error('must use router-provided group metadata'); }
    };

    await everyone.execute(sock, m, {
        args: ['Community', 'announcement'],
        prefix: '/',
        reply: async text => replies.push(text),
        config: { status: { public: true } },
        isAdmin: false,
        groupMeta
    });

    assert.equal(replies.length, 0);
    assert.equal(sent.length, 1);
    assert.equal(sent[0][0], m.chat);
    assert.equal(sent[0][1].text, `@${m.chat}`);
    assert.deepEqual(sent[0][1].contextInfo.mentionedJid, [
        '234800000001@s.whatsapp.net',
        '234800000002@s.whatsapp.net',
        '234800000003@s.whatsapp.net'
    ]);
    assert.deepEqual(sent[0][1].contextInfo.groupMentions, [
        { groupJid: m.chat, groupSubject: 'Community announcement' }
    ]);
    assert.deepEqual(sent[0][2], { quoted: m });
});

test('everyone uses quoted text and denies ordinary members in private mode', async () => {
    const sent = [];
    const replies = [];
    const m = {
        chat: '12036301234567890@g.us',
        quoted: { message: { conversation: 'Use this quoted message' } }
    };
    const groupMeta = { participants: [{ id: '234800000001@s.whatsapp.net' }] };
    const sock = { sendMessage: async (...args) => sent.push(args) };

    await everyone.execute(sock, m, {
        args: [], prefix: '!', reply: async text => replies.push(text),
        config: { status: { public: true } }, groupMeta
    });
    assert.equal(sent[0][1].contextInfo.groupMentions[0].groupSubject, 'Use this quoted message');

    await everyone.execute(sock, m, {
        args: ['Private'], prefix: '!', reply: async text => replies.push(text),
        config: { status: { public: false } }, groupMeta
    });
    assert.match(replies[0], /Only group admins\/moderators or bot staff/);
    assert.equal(sent.length, 1);

    await everyone.execute(sock, m, {
        args: ['Admin announcement'], prefix: '!', reply: async text => replies.push(text),
        config: { status: { public: false } }, isAdmin: true, groupMeta
    });
    assert.equal(sent.length, 2);
    assert.equal(sent[1][1].contextInfo.groupMentions[0].groupSubject, 'Admin announcement');
});

test('everyone prompts when neither text nor a text quote is available', async () => {
    const replies = [];
    await everyone.execute({ sendMessage: async () => assert.fail('must not send') }, {
        chat: '12036301234567890@g.us'
    }, {
        args: [], prefix: '/', reply: async text => replies.push(text),
        config: { status: { public: true } }, groupMeta: { participants: [] }
    });
    assert.match(replies[0], /Example: \/everyone hello/);
});

test('participantIds falls back to groupMetadata when router metadata is absent', async () => {
    const result = await participantIds({
        groupMetadata: async jid => ({ subject: 'Fallback', participants: [{ id: `${jid}-member` }] })
    }, 'group@g.us');
    assert.equal(result.metadata.subject, 'Fallback');
    assert.deepEqual(result.ids, ['group@g.us-member']);
});

test('tagall no longer claims everyone and registry dispatches everyone to its own command', () => {
    assert.equal(tagall.alias.includes('everyone'), false);
    assert.equal(everyone.name, 'everyone');
    registry.clearRegistry();
    registry.addCommand(tagall);
    registry.addCommand(everyone);
    assert.equal(registry.getCommand('tagall'), tagall);
    assert.equal(registry.getCommand('everyone'), everyone);
    registry.clearRegistry();
});
