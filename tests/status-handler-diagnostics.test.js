const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const test = require('node:test');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'chalk') return { cyan: value => value, magenta: value => value, red: value => value };
    if (request === './configManager' && parent?.filename?.endsWith('/src/Plugin/statusHandler.js')) {
        return { getVar: (_key, fallback) => fallback === true ? false : fallback };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const { setupStatusHandler } = require('../src/Plugin/statusHandler.js');
Module._load = originalLoad;

test('status handler announces readiness and subscribes through Baileys while retaining raw diagnostics', async () => {
    const ws = new EventEmitter();
    const logs = [];
    const oldLog = console.log;
    const oldError = console.error;
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push(args.join(' '));
    let subscription;
    try {
        const sock = {
            ws,
            onStatusMessage: (listener, options) => {
                subscription = { listener, options };
                return () => { subscription = null; };
            }
        };
        setupStatusHandler(sock);
        ws.listeners('CB:message')[0]({ attrs: { from: 'status@broadcast' } });
        assert.ok(subscription);
        assert.equal(subscription.options.from, 'all');
        assert.equal(subscription.options.includeGroupStatus, true);
        await subscription.listener({
            message: {
                key: { remoteJid: 'status@broadcast', participant: '15550001111@s.whatsapp.net', id: 'status-1' },
                message: { conversation: 'status text' }
            },
            authorJid: '15550001111@s.whatsapp.net',
            kind: 'status',
            type: 'notify'
        });
    } finally {
        console.log = oldLog;
        console.error = oldError;
    }
    assert.ok(logs.some(line => line.includes('Baileys status handler attached')));
    assert.ok(logs.some(line => line.includes('Raw status stanza received from WhatsApp')));
    assert.ok(logs.some(line => line.includes('Subscribed through Baileys onStatusMessage()')));
});

test('status handler gives an actionable message when the installed Baileys lacks onStatusMessage', () => {
    const logs = [];
    const oldLog = console.log;
    const oldError = console.error;
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push(args.join(' '));
    try {
        setupStatusHandler({ ws: new EventEmitter() });
    } finally {
        console.log = oldLog;
        console.error = oldError;
    }
    assert.ok(logs.some(line => line.includes('install plogme@2.2.6 or newer')));
});
