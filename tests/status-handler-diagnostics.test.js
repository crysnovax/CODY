const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const test = require('node:test');

const originalLoad = Module._load;
let statusFlags = null;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'chalk') return { cyan: value => value, green: value => value, magenta: value => value, red: value => value };
    if (request === './configManager' && parent?.filename?.endsWith('/src/Plugin/statusHandler.js')) {
        return {
            getVar: (key, fallback) => statusFlags && Object.prototype.hasOwnProperty.call(statusFlags, key)
                ? statusFlags[key]
                : (fallback === true ? false : fallback)
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const { setupStatusHandler } = require('../src/Plugin/statusHandler.js');
Module._load = originalLoad;

test('status handler logs raw receipt, decoded candidates, and Baileys callback without exposing identifiers or content', async () => {
    const ws = new EventEmitter();
    const ev = new EventEmitter();
    const logs = [];
    const oldLog = console.log;
    const oldError = console.error;
    const oldWarn = console.warn;
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push(args.join(' '));
    console.warn = (...args) => logs.push(args.join(' '));
    let subscription;
    let cleanup;
    try {
        const sock = {
            ws,
            ev,
            onStatusMessage: (listener, options) => {
                subscription = { listener, options };
                return () => { subscription = null; };
            }
        };
        cleanup = setupStatusHandler(sock);
        ws.listeners('CB:message')[0]({ attrs: { from: 'status@broadcast' } });
        ev.emit('messages.upsert', {
            type: 'notify',
            messages: [{
                key: {
                    remoteJid: 'status@broadcast',
                    remoteJidAlt: '15550001111@lid',
                    participant: '15550001111@s.whatsapp.net',
                    id: 'private-status-id',
                    fromMe: true
                },
                message: { conversation: 'private status content' }
            }]
        });
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
        console.warn = oldWarn;
    }
    assert.ok(logs.some(line => line.includes('Baileys status handler attached')));
    assert.ok(logs.some(line => line.includes('WhatsApp delivered a raw status stanza')));
    assert.ok(logs.some(line => line.includes('Decoded message observer attached')));
    assert.ok(logs.some(line => line.includes('decoded candidate kind=personal type=notify')));
    assert.ok(logs.some(line => line.includes('Baileys callback kind=status type=notify')));
    assert.ok(logs.some(line => line.includes('Subscribed through Baileys onStatusMessage()')));
    const statusLogs = logs.filter(line => line.includes('[STATUS]'));
    assert.ok(statusLogs.length >= 5);
    assert.ok(statusLogs.every(line => !line.includes('15550001111')));
    assert.ok(statusLogs.every(line => !line.includes('private-status-id')));
    assert.ok(statusLogs.every(line => !line.includes('private status content')));
    cleanup();
    assert.equal(ev.listenerCount('messages.upsert'), 0);
});

test('status handler gives an actionable message when Plogme lacks onStatusMessage', () => {
    const logs = [];
    const oldLog = console.log;
    const oldError = console.error;
    const oldWarn = console.warn;
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push(args.join(' '));
    console.warn = (...args) => logs.push(args.join(' '));
    try {
        setupStatusHandler({ ws: new EventEmitter() });
    } finally {
        console.log = oldLog;
        console.error = oldError;
        console.warn = oldWarn;
    }
    assert.ok(logs.some(line => line.includes('install plogme@2.2.7 or newer')));
});

test('status handler keeps failed view and successful like outcomes visible in logs', async () => {
    statusFlags = { AUTO_STATUS_VIEW: true, AUTO_STATUS_LIKE: true };
    const logs = [];
    const oldLog = console.log;
    const oldError = console.error;
    const oldWarn = console.warn;
    const oldSetTimeout = global.setTimeout;
    console.log = (...args) => logs.push(args.join(' '));
    console.error = (...args) => logs.push(args.join(' '));
    console.warn = (...args) => logs.push(args.join(' '));
    global.setTimeout = (callback, milliseconds, ...args) => {
        if (milliseconds === 1000) {
            queueMicrotask(() => callback(...args));
            return { unref() {} };
        }
        return oldSetTimeout(callback, milliseconds, ...args);
    };
    let listener;
    try {
        const sock = {
            onStatusMessage: callback => { listener = callback; return () => {}; },
            viewStatus: async () => { throw new Error('fixture receipt rejection'); },
            sendMessage: async () => ({ key: { id: 'sent' } })
        };
        setupStatusHandler(sock);
        await listener({
            message: { key: { remoteJid: 'status@broadcast', participant: '15550001111@s.whatsapp.net', id: 'private-id' }, message: { conversation: 'private text' } },
            authorJid: '15550001111@s.whatsapp.net',
            kind: 'status',
            type: 'notify'
        });
    } finally {
        statusFlags = null;
        console.log = oldLog;
        console.error = oldError;
        console.warn = oldWarn;
        global.setTimeout = oldSetTimeout;
    }
    assert.ok(logs.some(line => line.includes('[STATUS] VIEW failed') && line.includes('fixture receipt rejection')));
    assert.ok(logs.some(line => line.includes('[STATUS] LIKE ok')));
    assert.ok(logs.every(line => !line.includes('15550001111')));
    assert.ok(logs.every(line => !line.includes('private-id')));
    assert.ok(logs.every(line => !line.includes('private text')));
});
