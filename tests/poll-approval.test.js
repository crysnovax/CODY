'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const approval = require('../src/Plugin/pollApproval');
const kickall = require('../src/Commands/Group/Closegc');
const kickinactive = require('../src/Commands/Admin/kickinactive');

function makeSock(chatId, participants) {
    let pollId = `poll-${Math.random().toString(36).slice(2)}`;
    const sent = [];
    const sock = {
        user: { id: 'bot@s.whatsapp.net' },
        ev: new EventEmitter(),
        sent,
        groupMetadata: async id => {
            assert.equal(id, chatId);
            return { participants };
        },
        sendMessage: async (jid, content) => {
            sent.push({ jid, content });
            if (content?.poll) return {
                key: { id: pollId, remoteJid: chatId, fromMe: true },
                message: { messageContextInfo: { messageSecret: content.poll.messageSecret } },
            };
            return { key: { id: `message-${sent.length}`, remoteJid: jid } };
        },
    };
    return { sock, get pollId() { return pollId; } };
}

function voteUpdate(chatId, pollId, voter, option, voteId = `${voter}-${option}`) {
    return [{
        key: { id: pollId, remoteJid: chatId, fromMe: true },
        update: { pollUpdates: [{
            pollCreationMessageKey: { id: pollId },
            pollUpdateMessageKey: { id: voteId, remoteJid: chatId, participant: voter },
            vote: { selectedOptions: [approval._optionHash(option)] },
        }] },
    }];
}

const admin = id => ({ id, admin: 'admin' });

test('approval requires a strict majority of current human admins; bot is not part of quorum', async () => {
    const chatId = `group-majority-${Date.now()}@g.us`;
    const { sock, pollId } = makeSock(chatId, [
        admin('bot@s.whatsapp.net'),
        admin('admin1@s.whatsapp.net'),
        admin('admin2@s.whatsapp.net'),
        admin('admin3@s.whatsapp.net'),
    ]);
    let ran = 0;
    await approval.requestPollApproval(sock, {
        chatId,
        actionLabel: 'test action',
        title: 'Continue?',
        timeoutMs: 60_000,
        onApproved: async () => { ran += 1; },
    });

    await approval._processUpdates(sock, voteUpdate(chatId, pollId, 'admin1@s.whatsapp.net', 'Continue'));
    assert.equal(ran, 0, 'one of three human admins is below majority');
    await approval._processUpdates(sock, voteUpdate(chatId, pollId, 'admin2@s.whatsapp.net', 'Continue'));
    assert.equal(ran, 1, 'two of three human admins is a strict majority');
    assert.equal(approval._pendingByPoll.has(pollId), false);
});

test('non-admin votes do not approve an action and any current admin can cancel', async () => {
    const chatId = `group-cancel-${Date.now()}@g.us`;
    const { sock, pollId } = makeSock(chatId, [
        admin('bot@s.whatsapp.net'),
        admin('admin1@s.whatsapp.net'),
        admin('admin2@s.whatsapp.net'),
        { id: 'member@s.whatsapp.net', admin: null },
    ]);
    let ran = 0;
    await approval.requestPollApproval(sock, {
        chatId,
        actionLabel: 'test cancel action',
        title: 'Continue?',
        timeoutMs: 60_000,
        onApproved: async () => { ran += 1; },
    });

    await approval._processUpdates(sock, voteUpdate(chatId, pollId, 'member@s.whatsapp.net', 'Continue'));
    assert.equal(ran, 0, 'a non-admin cannot contribute to the quorum');
    await approval._processUpdates(sock, voteUpdate(chatId, pollId, 'admin1@s.whatsapp.net', 'Cancel'));
    assert.equal(ran, 0, 'cancel must not execute the pending action');
    assert.equal(approval._pendingByPoll.has(pollId), false);
    assert.ok(sock.sent.some(item => /cancelled by a group admin/i.test(item.content.text || '')));
});

test('kickall alias does not remove members until the approval poll reaches quorum', async () => {
    const chatId = `group-kickall-${Date.now()}@g.us`;
    const participants = [
        { id: 'bot@s.whatsapp.net', admin: 'admin' },
        { id: 'owner@s.whatsapp.net', admin: 'admin' },
        { id: 'member@s.whatsapp.net', admin: null },
    ];
    const { sock, pollId } = makeSock(chatId, participants);
    const removals = [];
    let leaves = 0;
    sock.groupParticipantsUpdate = async (...args) => removals.push(args);
    sock.groupLeave = async () => { leaves += 1; };
    const replies = [];
    await kickall.execute(sock, {
        chat: chatId,
        sender: 'owner@s.whatsapp.net',
        key: { remoteJid: chatId, participant: 'owner@s.whatsapp.net' },
    }, {
        reply: async text => replies.push(text),
        isGroupAdmin: true,
    });
    assert.equal(removals.length, 0);
    assert.equal(leaves, 0);
    await approval._processUpdates(sock, voteUpdate(chatId, pollId, 'owner@s.whatsapp.net', 'Continue'));
    assert.equal(removals.length, 1);
    assert.deepEqual(removals[0][1], ['owner@s.whatsapp.net', 'member@s.whatsapp.net']);
    assert.equal(leaves, 1);
    assert.ok(replies.some(text => /approval poll started/i.test(text)));
});

test('kickinactive preserves preview and 10-member cap but only removes after poll approval', async () => {
    const chatId = `group-inactive-${Date.now()}@g.us`;
    const participants = [
        { id: 'bot@s.whatsapp.net', admin: 'admin' },
        { id: 'owner@s.whatsapp.net', admin: 'admin' },
        { id: 'idle@s.whatsapp.net', admin: null, lastSeen: Date.now() - 40 * 86_400_000 },
    ];
    const { sock, pollId } = makeSock(chatId, participants);
    const removals = [];
    sock.groupParticipantsUpdate = async (...args) => removals.push(args);
    const replies = [];
    await kickinactive.execute(sock, {
        chat: chatId,
        sender: 'owner@s.whatsapp.net',
        key: { remoteJid: chatId, participant: 'owner@s.whatsapp.net' },
    }, {
        args: ['30d'],
        reply: async text => replies.push(text),
        isAdmin: true,
    });
    assert.equal(removals.length, 0);
    assert.ok(replies.some(text => /Dry run.*1 candidate/i.test(text)));
    await approval._processUpdates(sock, voteUpdate(chatId, pollId, 'owner@s.whatsapp.net', 'Continue'));
    assert.equal(removals.length, 1);
    assert.deepEqual(removals[0][1], ['idle@s.whatsapp.net']);
});
