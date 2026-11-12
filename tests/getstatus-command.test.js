'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
global.prefix ??= '.';
const commands = require('../src/Commands/Owner/baileys.js');
const getstatus = commands.find(command => command.name === 'getstatus');

test('getstatus uses fetchStatus and formats the returned WhatsApp About text', async () => {
    const replies = [];
    let requestedJid;
    const sock = {
        fetchStatus: async jid => {
            requestedJid = jid;
            return [{ id: jid, status: { status: 'Available for work' } }];
        }
    };

    await getstatus.execute(sock, { chat: 'owner@s.whatsapp.net' }, {
        args: ['2348012345678'],
        reply: async text => replies.push(text),
        prefix: '/'
    });

    assert.equal(requestedJid, '2348012345678@s.whatsapp.net');
    assert.match(replies[0], /Status for.*@2348012345678/);
    assert.match(replies[0], /Available for work/);
});

test('getstatus no longer claims viewstatus and is explicitly owner-only', () => {
    assert.equal(getstatus.alias.includes('viewstatus'), false);
    assert.equal(getstatus.ownerOnly, true);
});

test('getstatus reports a useful error when fetchStatus is not available', async () => {
    const replies = [];
    await getstatus.execute({}, { chat: 'owner@s.whatsapp.net' }, {
        args: ['2348012345678'],
        reply: async text => replies.push(text),
        prefix: '/'
    });

    assert.match(replies[0], /does not provide fetchStatus\(\)/);
});
