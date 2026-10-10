'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const originalCwd = process.cwd();
const getphone = require(path.join(originalCwd, 'src/Commands/Tools/getphone.js'));
const GROUP = '120363000000000000@g.us';
const REQUESTER = '15550000001@s.whatsapp.net';
const TARGET_LID = '987654321012@lid';
const TARGET_PHONE = '15551234567@s.whatsapp.net';

function makeSock({ participants = [], mapping = {}, findUserId } = {}) {
    const sent = [];
    return {
        sent,
        user: { id: '15559999999@s.whatsapp.net' },
        signalRepository: { lidMapping: {
            getPNForLID: async lid => mapping[lid] || null,
            getLIDForPN: async phone => Object.entries(mapping).find(([, pn]) => pn === phone)?.[0] || null,
        } },
        groupMetadata: async () => ({ participants }),
        findUserId,
        sendMessage: async (...args) => { sent.push(args); return {}; },
    };
}

 test('DM getphone returns only the sender phone digits', async () => {
    const sock = makeSock();
    await getphone.execute(sock, {
        isGroup: false,
        chat: REQUESTER,
        sender: REQUESTER,
        key: { remoteJid: REQUESTER },
    }, { args: [], reply: async text => { throw new Error(`Unexpected reply: ${text}`); } });
    assert.equal(sock.sent[0][0], REQUESTER);
    assert.equal(sock.sent[0][1].text, '15550000001');
    assert.deepEqual(Object.keys(sock.sent[0][1]), ['text']);
});

test('DM getphone maps the caller LID to a real phone number', async () => {
    const lid = '112233445566@lid';
    const phone = '447700900123@s.whatsapp.net';
    const sock = makeSock({ mapping: { [lid]: phone } });
    await getphone.execute(sock, {
        isGroup: false,
        chat: lid,
        sender: lid,
        key: { remoteJid: lid },
    }, { args: [], reply: async text => { throw new Error(`Unexpected reply: ${text}`); } });
    assert.equal(sock.sent[0][1].text, '447700900123');
});

test('self-sent getphone in a private chat returns the chat peer, not the bot sender', async () => {
    const bot = '15559999999@s.whatsapp.net';
    const peer = '447700900123@s.whatsapp.net';
    const sock = makeSock();
    await getphone.execute(sock, {
        isGroup: false,
        chat: peer,
        sender: bot,
        fromMe: true,
        key: { fromMe: true, remoteJid: peer },
    }, { args: [], reply: async text => { throw new Error(`Unexpected reply: ${text}`); } });
    assert.equal(sock.sent[0][1].text, '447700900123');
});

test('self-sent getphone uses the peer phone alternate when the DM JID is a LID', async () => {
    const bot = '15559999999@s.whatsapp.net';
    const peerLid = '112233445566@lid';
    const peerPhone = '447700900123@s.whatsapp.net';
    const sock = makeSock();
    await getphone.execute(sock, {
        isGroup: false,
        chat: peerLid,
        sender: bot,
        key: { fromMe: true, remoteJid: peerLid, remoteJidAlt: peerPhone },
    }, { args: [], reply: async text => { throw new Error(`Unexpected reply: ${text}`); } });
    assert.equal(sock.sent[0][1].text, '447700900123');
});

test('group admin can resolve a member LID, delivered privately as digits only', async () => {
    const sock = makeSock({ participants: [
        { id: REQUESTER, admin: 'admin' },
        { id: TARGET_LID, lid: TARGET_LID, phoneNumber: TARGET_PHONE, admin: null },
    ] });
    const replies = [];
    await getphone.execute(sock, {
        isGroup: true,
        chat: GROUP,
        sender: REQUESTER,
        key: { participant: REQUESTER },
    }, {
        args: [TARGET_LID],
        isAdmin: true,
        reply: async text => { replies.push(text); },
    });
    assert.equal(replies.length, 0);
    assert.equal(sock.sent.length, 1);
    assert.equal(sock.sent[0][0], REQUESTER);
    assert.equal(sock.sent[0][1].text, '15551234567');
    assert.notEqual(sock.sent[0][0], GROUP);
});

test('group non-admin cannot resolve a member LID', async () => {
    const sock = makeSock({ participants: [
        { id: REQUESTER, admin: null },
        { id: TARGET_LID, lid: TARGET_LID, phoneNumber: TARGET_PHONE, admin: null },
    ] });
    const replies = [];
    await getphone.execute(sock, { isGroup: true, chat: GROUP, sender: REQUESTER }, {
        args: [TARGET_LID], reply: async text => { replies.push(text); },
    });
    assert.match(replies[0], /Only group admins/);
    assert.equal(sock.sent.length, 0);
});

test('group admin cannot look up a LID that is not a group member', async () => {
    const sock = makeSock({ participants: [{ id: REQUESTER, admin: 'admin' }] });
    const replies = [];
    await getphone.execute(sock, { isGroup: true, chat: GROUP, sender: REQUESTER }, {
        args: [TARGET_LID], isAdmin: true, reply: async text => { replies.push(text); },
    });
    assert.match(replies[0], /not a member/);
    assert.equal(sock.sent.length, 0);
});

test('DM cannot resolve another user and an unresolved LID is never treated as a phone number', async () => {
    const ownLid = '123456789012@lid';
    const otherLid = '987654321012@lid';
    const sock = makeSock();
    const replies = [];
    await getphone.execute(sock, { isGroup: false, chat: ownLid, sender: ownLid }, {
        args: [otherLid], reply: async text => { replies.push(text); },
    });
    assert.match(replies.at(-1), /person in that DM/);
    assert.equal(sock.sent.length, 0);

    await getphone.execute(sock, { isGroup: false, chat: ownLid, sender: ownLid }, {
        args: [], reply: async text => { replies.push(text); },
    });
    assert.match(replies.at(-1), /will not use the LID digits/);
    assert.equal(sock.sent.length, 0);
});

test('LID-only contact and findUserId responses are rejected as non-phone identifiers', async () => {
    const lid = '123456789012@lid';
    const sock = makeSock({ findUserId: async () => ({ jid: lid, lid }) });
    sock.store = { contacts: new Map([[lid, { lid, phoneNumber: lid }]]) };
    assert.equal(await getphone.resolveRealPhone(sock, lid), null);
});

test('getphone accepts a phone JID with a country prefix and canonicalizes it', () => {
    assert.equal(getphone.parseUserJid('+15551234567@c.us'), '15551234567@s.whatsapp.net');
    assert.equal(getphone.parseUserJid('123456789012@lid'), '123456789012@lid');
    assert.equal(getphone.parseUserJid('not-a-jid'), null);
    assert.equal(getphone.parseUserJid('120363000000000000@g.us'), null);
});
