const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const Module = require('node:module');
const test = require('node:test');

const previousCwd = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-status-actions-'));
fs.mkdirSync(path.join(tempRoot, 'database'), { recursive: true });
process.chdir(tempRoot);

let statusFlags = {};
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'chalk') {
        return { cyan: value => value, magenta: value => value, red: value => value };
    }
    if (request === 'plogme') {
        return {
            downloadContentFromMessage: async function* () {
                yield Buffer.from('status-media-bytes');
            }
        };
    }
    if (request === './configManager' && parent?.filename?.endsWith('/src/Plugin/statusHandler.js')) {
        return {
            getVar: (key, fallback) => Object.prototype.hasOwnProperty.call(statusFlags, key)
                ? statusFlags[key]
                : fallback
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const handlerPath = require.resolve('../src/Plugin/statusHandler.js');
delete require.cache[handlerPath];
const { setupStatusHandler } = require(handlerPath);
Module._load = originalLoad;
process.chdir(previousCwd);

test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

function writeAssConfig(config) {
    fs.writeFileSync(
        path.join(tempRoot, 'database', 'autosavestatus.json'),
        JSON.stringify(config),
        'utf8'
    );
}

function makeSocket() {
    const calls = { reads: [], messages: [] };
    const sock = {
        ev: new EventEmitter(),
        ws: new EventEmitter(),
        readMessages: async keys => calls.reads.push(keys),
        sendMessage: async (...args) => calls.messages.push(args)
    };
    setupStatusHandler(sock);
    return { sock, calls };
}

async function dispatchWithoutReactionDelay(sock, update) {
    const listener = sock.ev.listeners('messages.upsert')[0];
    assert.ok(listener, 'status handler should register messages.upsert');
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (callback, milliseconds, ...args) => {
        if (milliseconds === 1000) {
            queueMicrotask(() => callback(...args));
            return { unref() {} };
        }
        return originalSetTimeout(callback, milliseconds, ...args);
    };
    try {
        await listener(update);
    } finally {
        global.setTimeout = originalSetTimeout;
    }
}

test('status view and like process alternate author JIDs even when participant is absent', async () => {
    writeAssConfig({ enabled: false, mode: 'dm', target: null });
    statusFlags = { AUTO_STATUS_VIEW: true, AUTO_STATUS_LIKE: true };
    const { sock, calls } = makeSocket();
    const participantAltMessage = {
        key: { remoteJid: 'status@broadcast', participantAlt: '15550001111@lid', id: 'alt-participant-1' },
        message: { conversation: 'Status from an alternate participant key' }
    };
    const remoteJidMessage = {
        key: { remoteJid: '15550002222@s.whatsapp.net', remoteJidAlt: 'status@broadcast', id: 'alt-remote-1' },
        message: { conversation: 'Status where the alternate remote JID marks the broadcast' }
    };

    await dispatchWithoutReactionDelay(sock, {
        type: 'notify',
        messages: [participantAltMessage, remoteJidMessage]
    });

    assert.deepEqual(calls.reads, [[participantAltMessage.key], [remoteJidMessage.key]]);
    const reactions = calls.messages.filter(([jid, content]) => jid === 'status@broadcast' && content?.react);
    assert.equal(reactions.length, 2);
    assert.deepEqual(reactions[0][2].statusJidList, ['15550001111@lid']);
    assert.deepEqual(reactions[1][2].statusJidList, ['15550002222@s.whatsapp.net']);
});

test('a later enriched status key is not suppressed by an earlier incomplete key with the same message ID', async () => {
    writeAssConfig({ enabled: false, mode: 'dm', target: null });
    statusFlags = { AUTO_STATUS_VIEW: true, AUTO_STATUS_LIKE: true };
    const { sock, calls } = makeSocket();
    const sparse = {
        key: { remoteJid: 'status@broadcast', id: 'enriched-status-1' },
        message: { conversation: 'Status with initially incomplete key data' }
    };
    const enriched = {
        key: { remoteJid: 'status@broadcast', participantAlt: '15550004444@lid', id: 'enriched-status-1' },
        message: { conversation: 'Same status with alternate author key data' }
    };

    await dispatchWithoutReactionDelay(sock, { type: 'notify', messages: [sparse] });
    await dispatchWithoutReactionDelay(sock, { type: 'notify', messages: [enriched] });

    assert.equal(calls.reads.length, 2);
    const reactions = calls.messages.filter(([jid, content]) => jid === 'status@broadcast' && content?.react);
    assert.equal(reactions.length, 1);
    assert.deepEqual(reactions[0][2].statusJidList, ['15550004444@lid']);
});

test('ASS auto-save still processes media when the status author is only in an alternate key field', async () => {
    writeAssConfig({ enabled: true, mode: 'chat', target: 'archive@g.us' });
    statusFlags = { AUTO_STATUS_VIEW: false, AUTO_STATUS_LIKE: false };
    const { sock, calls } = makeSocket();
    const message = {
        key: { remoteJid: 'status@broadcast', participantAlt: '15550003333@lid', id: 'alt-media-1' },
        message: { imageMessage: { caption: 'Saved status image' } }
    };

    await dispatchWithoutReactionDelay(sock, { type: 'notify', messages: [message] });

    const saved = calls.messages.find(([jid]) => jid === 'archive@g.us');
    assert.ok(saved, 'ASS should send the saved media to its configured archive target');
    assert.equal(saved[1].caption, 'Saved status image');
    assert.equal(saved[1].image.toString(), 'status-media-bytes');
});
