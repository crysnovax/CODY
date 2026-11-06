const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const test = require('node:test');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'chalk') return { cyan: value => value, magenta: value => value, red: value => value };
    if (request === 'plogme') return { downloadContentFromMessage: async function* () {} };
    if (request === './configManager' && parent?.filename?.endsWith('/src/Plugin/statusHandler.js')) {
        return { getVar: (_key, fallback) => false };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const { setupStatusHandler } = require('../src/Plugin/statusHandler.js');
Module._load = originalLoad;

test('status handler announces readiness and logs received broadcast updates', async () => {
    const ev = new EventEmitter();
    const ws = new EventEmitter();
    const logs = [];
    const oldLog = console.log;
    const oldWarn = console.warn;
    console.log = (...args) => logs.push(args.join(' '));
    console.warn = (...args) => logs.push(args.join(' '));
    try {
        setupStatusHandler({ ev, ws });
        ws.listeners('CB:message')[0]({ attrs: { from: 'status@broadcast' } });
        const listener = ev.listeners('messages.upsert')[0];
        assert.ok(listener);
        await listener({
            type: 'notify',
            messages: [{
                key: { remoteJid: 'status@broadcast', participant: '15550001111@s.whatsapp.net', id: 'status-1' },
                message: { conversation: 'status text' }
            }]
        });
    } finally {
        console.log = oldLog;
        console.warn = oldWarn;
    }
    assert.ok(logs.some(line => line.includes('Handler attached')));
    assert.ok(logs.some(line => line.includes('Raw status stanza received from WhatsApp')));
    assert.ok(logs.some(line => line.includes('Received 1 status update(s) (notify)')));
});
