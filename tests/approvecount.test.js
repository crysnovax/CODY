'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const command = require('../src/Commands/Group/approvecount');

const chat = '123@g.us';
const requests = [
    { jid: '2348011111111@s.whatsapp.net' },
    { jid: '1555222222222@s.whatsapp.net' },
    { jid: '2348033333333@s.whatsapp.net' },
    { jid: '2348044444444@lid' },
];

function socket(pending = requests) {
    const approved = [];
    return {
        approved,
        groupRequestParticipantsList: async requestedChat => {
            assert.equal(requestedChat, chat);
            return pending;
        },
        groupRequestParticipantsUpdate: async (requestedChat, jids, action) => {
            approved.push({ requestedChat, jids, action });
        },
    };
}

function message() { return { chat, key: { id: 'approve-count' } }; }

test('approvecount is a group-admin command with clear bounded usage', () => {
    assert.equal(command.name, 'approvecount');
    assert.equal(command.groupOnly, true);
    assert.equal(command.adminOnly, true);
    assert.match(command.usage, /country-code/);
});

test('approvecount approves no more than the requested amount from the filtered country', async () => {
    const sock = socket();
    const replies = [];
    await command.execute(sock, message(), {
        args: ['1', '+234'], prefix: '.', reply: async text => replies.push(text),
    });
    assert.deepEqual(sock.approved, [{
        requestedChat: chat,
        jids: ['2348011111111@s.whatsapp.net'],
        action: 'approve',
    }]);
    assert.match(replies[0], /Approved 1/);
    assert.match(replies[0], /\+234/);
});

test('country filtering does not interpret LID digits as phone country codes', async () => {
    const sock = socket([{ jid: '2348044444444@lid' }]);
    const replies = [];
    await command.execute(sock, message(), {
        args: ['5', '234'], prefix: '.', reply: async text => replies.push(text),
    });
    assert.deepEqual(sock.approved, []);
    assert.match(replies[0], /No pending requests matched country code \+234/);
});

test('invalid limits and country codes are rejected without approving requests', async () => {
    for (const args of [['0'], ['101'], ['2', '+1234'], ['2', 'country']]) {
        const sock = socket();
        const replies = [];
        await command.execute(sock, message(), { args, prefix: '.', reply: async text => replies.push(text) });
        assert.deepEqual(sock.approved, []);
        assert.match(replies[0], /Usage:/);
    }
});

test('unfiltered approvecount approves only the first requested number', async () => {
    const sock = socket();
    await command.execute(sock, message(), { args: ['2'], reply: async () => {} });
    assert.deepEqual(sock.approved[0].jids, [requests[0].jid, requests[1].jid]);
});
