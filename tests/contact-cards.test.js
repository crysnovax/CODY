'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

global.prefix ??= '.';

const sudoCommand = require('../src/Commands/Owner/sudo');
const dualCommand = require('../src/Commands/Owner/dual');
const privacyCommands = require('../src/Commands/Privacy/privacy');
const { createContactCards } = require('../src/Plugin/contactCards');

const TARGET_PHONE = '2348012345678@s.whatsapp.net';
const TARGET_LID = '998877665544@lid';

function makeSock({ blocklist = [] } = {}) {
    const sent = [];
    const sock = {
        sent,
        store: { contacts: new Map([[TARGET_LID, {
            id: TARGET_LID,
            lid: TARGET_LID,
            phoneNumber: TARGET_PHONE,
            notify: 'John Doe',
        }]]) },
        signalRepository: { lidMapping: {
            getPNForLID: async lid => lid === TARGET_LID ? TARGET_PHONE : null,
        } },
        fetchBlocklist: async () => blocklist,
        sendMessage: async (...args) => { sent.push(args); return {}; },
    };
    return sock;
}

function message() {
    return { chat: '15550000000@s.whatsapp.net', key: { id: 'test' } };
}

for (const [label, command, variable] of [
    ['sudo', sudoCommand, 'SUDO_NUMBERS'],
    ['dual', dualCommand, 'DUAL_NUMBERS'],
]) {
    test(`${label} list sends contact cards with the actual phone number`, async () => {
        const previous = process.env[variable];
        process.env[variable] = '2348012345678';
        try {
            const sock = makeSock();
            const replies = [];
            await command.execute(sock, message(), {
                args: ['list'],
                reply: async text => { replies.push(text); },
            });

            const contactMessage = sock.sent.find(([, content]) => content.contacts);
            assert.ok(contactMessage, 'expected a contacts message');
            assert.equal(contactMessage[1].contacts.displayName, `${label[0].toUpperCase()}${label.slice(1)} Users`);
            assert.equal(contactMessage[1].contacts.contacts.length, 1);
            assert.match(contactMessage[1].contacts.contacts[0].vcard, /FN:John Doe/);
            assert.match(contactMessage[1].contacts.contacts[0].vcard, /TEL;TYPE=CELL;waid=2348012345678:\+2348012345678/);
            assert.deepEqual(replies, []);
        } finally {
            if (previous === undefined) delete process.env[variable];
            else process.env[variable] = previous;
        }
    });
}

test('blocklist resolves LIDs to real numbers and sends named vCards', async () => {
    const sock = makeSock({ blocklist: [TARGET_LID] });
    const replies = [];
    const command = privacyCommands.find(item => item.name === 'blocklist');

    await command.execute(sock, message(), {
        reply: async text => { replies.push(text); },
        prefix: '.',
    });

    const contactMessage = sock.sent.find(([, content]) => content.contacts);
    assert.ok(contactMessage, 'expected a contacts message');
    const card = contactMessage[1].contacts.contacts[0].vcard;
    assert.equal(contactMessage[1].contacts.displayName, 'Blocked Contacts');
    assert.match(card, /FN:John Doe/);
    assert.match(card, /TEL;TYPE=CELL;waid=2348012345678:\+2348012345678/);
    assert.doesNotMatch(card, /998877665544/);
    assert.deepEqual(replies, []);
});

test('blocklist uses the runtime store supplied by the command dispatcher', async () => {
    const sock = makeSock({ blocklist: [TARGET_LID] });
    sock.store = null;
    const store = { contacts: new Map([[TARGET_LID, {
        id: TARGET_LID,
        lid: TARGET_LID,
        phoneNumber: TARGET_PHONE,
        notify: 'Store Contact',
    }]]) };
    sock.signalRepository.lidMapping.getPNForLID = async () => null;
    const command = privacyCommands.find(item => item.name === 'blocklist');

    await command.execute(sock, message(), {
        reply: async text => { throw new Error(`Unexpected reply: ${text}`); },
        prefix: '.',
        store,
    });

    const card = sock.sent.find(([, content]) => content.contacts)?.[1].contacts.contacts[0].vcard;
    assert.ok(card);
    assert.match(card, /FN:Store Contact/);
    assert.match(card, /waid=2348012345678/);
});

test('findUserId fallback can resolve LIDs but never treats a returned LID as a phone', async () => {
    const sock = makeSock();
    sock.signalRepository.lidMapping.getPNForLID = async () => null;
    sock.store.contacts.clear();
    sock.findUserId = async () => ({ phoneNumber: TARGET_PHONE, lid: TARGET_LID });

    const result = await createContactCards(sock, [TARGET_LID]);
    assert.equal(result.unresolved, 0);
    assert.match(result.payload.contacts[0].vcard, /waid=2348012345678/);
    assert.doesNotMatch(result.payload.contacts[0].vcard, /998877665544/);

    sock.findUserId = async () => ({ jid: '123456789012@lid', lid: '123456789012@lid' });
    const unsafe = await createContactCards(sock, ['123456789012@lid']);
    assert.equal(unsafe.payload, null);
    assert.equal(unsafe.unresolved, 1);
});

test('sudo list resolves a legacy stored LID instead of displaying its digits', async () => {
    const previous = process.env.SUDO_NUMBERS;
    process.env.SUDO_NUMBERS = TARGET_LID;
    try {
        const sock = makeSock();
        const command = sudoCommand;
        await command.execute(sock, message(), {
            args: ['list'],
            reply: async text => { throw new Error(`Unexpected reply: ${text}`); },
        });

        const card = sock.sent.find(([, content]) => content.contacts)?.[1].contacts.contacts[0].vcard;
        assert.ok(card);
        assert.match(card, /waid=2348012345678/);
        assert.doesNotMatch(card, /998877665544/);
    } finally {
        if (previous === undefined) delete process.env.SUDO_NUMBERS;
        else process.env.SUDO_NUMBERS = previous;
    }
});

test('unmapped LIDs are omitted rather than misreported as phone numbers', async () => {
    const sock = makeSock({ blocklist: ['123456789012@lid'] });
    sock.signalRepository.lidMapping.getPNForLID = async () => null;
    sock.store.contacts.clear();
    const command = privacyCommands.find(item => item.name === 'blocklist');
    const replies = [];

    await command.execute(sock, message(), {
        reply: async text => { replies.push(text); },
        prefix: '.',
    });

    assert.equal(sock.sent.some(([, content]) => content.contacts), false);
    assert.match(replies.at(-1), /Could not resolve any real phone numbers/);
});

test('contact-card builder does not use LID digits when no phone mapping exists', async () => {
    const sock = makeSock();
    sock.signalRepository.lidMapping.getPNForLID = async () => null;
    sock.store.contacts.clear();

    const result = await createContactCards(sock, ['123456789012@lid']);
    assert.equal(result.payload, null);
    assert.equal(result.unresolved, 1);
});

test('contact-card builder resolves a LID from a stored numeric phoneNumber', async () => {
    const sock = makeSock();
    sock.signalRepository.lidMapping.getPNForLID = async () => null;
    sock.store.contacts.set(TARGET_LID, {
        id: TARGET_LID,
        lid: TARGET_LID,
        phoneNumber: '2348012345678',
        notify: 'Jane Doe',
    });

    const result = await createContactCards(sock, [TARGET_LID]);
    assert.equal(result.unresolved, 0);
    assert.match(result.payload.contacts[0].vcard, /FN:Jane Doe/);
    assert.match(result.payload.contacts[0].vcard, /waid=2348012345678/);
    assert.doesNotMatch(result.payload.contacts[0].vcard, /998877665544/);
});
