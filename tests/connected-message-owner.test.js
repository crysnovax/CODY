'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
    if (request === 'chalk') return new Proxy({}, { get: () => value => String(value) });
    return originalLoad.call(this, request, parent, isMain);
};
const { resolveOwnerJid, sendConnectedMessage } = require('../library/C2582');
Module._load = originalLoad;

test('OWNER_NUMBER is normalized and takes precedence over the loaded config owner', () => {
    assert.equal(resolveOwnerJid({ envOwner: '+1 (555) 123-4567', runtimeOwner: '447700900123' }), '15551234567@s.whatsapp.net');
});

test('runtime OWNER_NUMBER is used only when the environment variable is absent', () => {
    assert.equal(resolveOwnerJid({ envOwner: '', runtimeOwner: '447700900123' }), '447700900123@s.whatsapp.net');
});

test('an invalid explicit OWNER_NUMBER fails closed rather than routing to a fallback', () => {
    assert.equal(resolveOwnerJid({ envOwner: 'not-a-number', runtimeOwner: '447700900123' }), null);
    assert.equal(resolveOwnerJid({ envOwner: '', runtimeOwner: '' }), null);
});

test('connected message is sent only to OWNER_NUMBER, not config.owner', async () => {
    const sent = [];
    const sock = { sendMessage: async (...args) => { sent.push(args); return {}; } };
    const result = await sendConnectedMessage(sock, {
        owner: '19999999999',
        settings: { prefix: '.', ownerName: 'Owner' },
        status: { public: false },
    }, 3000, {
        envOwner: '15551234567',
        runtimeOwner: '18888888888',
        fetchThumbnail: async () => null,
    });
    assert.equal(result, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0][0], '15551234567@s.whatsapp.net');
});

test('connected message is skipped when no explicit owner number exists', async () => {
    const sent = [];
    const sock = { sendMessage: async (...args) => { sent.push(args); return {}; } };
    const result = await sendConnectedMessage(sock, {
        owner: '19999999999',
        settings: { prefix: '.', ownerName: 'Owner' },
    }, 3000, { envOwner: '', runtimeOwner: '' });
    assert.equal(result, false);
    assert.equal(sent.length, 0);
});
