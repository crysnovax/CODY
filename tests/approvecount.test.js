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
    for (const args of [['0'], ['1001'], ['2', '+1234'], ['2', 'country']]) {
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

test('approvecount accepts the requested 300 unfiltered and 500 country-filtered batches', async () => {
    const countryRequests = Array.from({ length: 505 }, (_, index) => ({
        jid: `234${String(index).padStart(10, '0')}@s.whatsapp.net`,
    }));
    const otherCountryRequests = Array.from({ length: 20 }, (_, index) => ({
        jid: `1555${String(index).padStart(9, '0')}@s.whatsapp.net`,
    }));
    const pending = [...otherCountryRequests, ...countryRequests];

    const unfiltered = socket(pending);
    await command.execute(unfiltered, message(), { args: ['300'], reply: async () => {} });
    assert.equal(unfiltered.approved[0].jids.length, 300);

    const filtered = socket(pending);
    await command.execute(filtered, message(), { args: ['500', '+234'], reply: async () => {} });
    assert.equal(filtered.approved[0].jids.length, 500);
    assert.ok(filtered.approved[0].jids.every(jid => jid.startsWith('234')));
});

test('approvecount accepts the configured maximum of 1,000 requests', async () => {
    const pending = Array.from({ length: 1001 }, (_, index) => ({
        jid: `234${String(index).padStart(10, '0')}@s.whatsapp.net`,
    }));
    const sock = socket(pending);
    await command.execute(sock, message(), { args: ['1000'], reply: async () => {} });
    assert.equal(sock.approved[0].jids.length, 1000);
});
