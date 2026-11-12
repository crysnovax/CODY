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
        return { cyan: value => value, green: value => value, magenta: value => value, red: value => value };
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

function writeJson(name, value) {
    fs.writeFileSync(path.join(tempRoot, 'database', name), JSON.stringify(value), 'utf8');
}

function makeSocket() {
    const calls = {
        subscription: null,
        views: [],
        groupViews: [],
        groupLikes: [],
        statusReactions: [],
        comments: [],
        downloads: [],
        messages: []
    };
    const sock = {
        ws: new EventEmitter(),
        onStatusMessage: (listener, options) => {
            calls.subscription = { listener, options };
            return () => { calls.subscription = null; };
        },
        viewStatus: async message => { calls.views.push(message); },
        viewGroupStatus: async message => { calls.groupViews.push(message); },
        likeGroupStatus: async (message, emoji) => { calls.groupLikes.push([message, emoji]); },
        commentStatus: async (message, comment) => { calls.comments.push([message, comment]); },
        downloadStatus: async (...args) => {
            calls.downloads.push(args);
            return Buffer.from('status-media-bytes');
        },
        sendMessage: async (...args) => {
            calls.messages.push(args);
            if (args[0] === 'status@broadcast' && args[1]?.react) calls.statusReactions.push(args);
        }
    };
    const unsubscribe = setupStatusHandler(sock);
    return { sock, calls, unsubscribe };
}

async function dispatchWithoutReactionDelay(listener, event) {
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (callback, milliseconds, ...args) => {
        if (milliseconds === 1000) {
            queueMicrotask(() => callback(...args));
            return { unref() {} };
        }
        return originalSetTimeout(callback, milliseconds, ...args);
    };
    try {
        await listener(event);
    } finally {
        global.setTimeout = originalSetTimeout;
    }
}

function statusMessage(id, message = { conversation: 'status text' }, key = {}) {
    return {
        key: { remoteJid: 'status@broadcast', id, ...key },
        message
    };
}

test('status handler subscribes through Baileys and delegates personal view/like actions', async () => {
    writeJson('autosavestatus.json', { enabled: false, mode: 'dm', target: null });
    writeJson('autocommentstatus.json', { enabled: false, mode: 'text', text: '' });
    statusFlags = { AUTO_STATUS_VIEW: true, AUTO_STATUS_LIKE: true, STATUS_EMOJI: '💜' };
    const { calls } = makeSocket();
    assert.equal(calls.subscription.options.from, 'all');
    assert.equal(calls.subscription.options.includeGroupStatus, true);

    const message = statusMessage('personal-1', { imageMessage: { caption: 'photo' } }, {
        participant: '15550001111@lid',
        remoteJidAlt: '15550001111@s.whatsapp.net'
    });
    await dispatchWithoutReactionDelay(calls.subscription.listener, {
        message,
        authorJid: '15550001111@lid',
        kind: 'status',
        type: 'notify'
    });

    assert.deepEqual(calls.views, [message]);
    assert.equal(calls.statusReactions.length, 1);
    assert.equal(calls.statusReactions[0][0], 'status@broadcast');
    assert.deepEqual(calls.statusReactions[0][1].react, { text: '💜', key: message.key });
    assert.deepEqual(calls.statusReactions[0][2].statusJidList, ['15550001111@s.whatsapp.net']);
});

test('status view, like, and green-heart comment default ON for a clean configuration', async () => {
    writeJson('autosavestatus.json', { enabled: false, mode: 'dm', target: null });
    fs.rmSync(path.join(tempRoot, 'database', 'autocommentstatus.json'), { force: true });
    statusFlags = {};
    const { calls } = makeSocket();
    const message = statusMessage('default-status-1');

    await dispatchWithoutReactionDelay(calls.subscription.listener, {
        message,
        authorJid: '15550001112@lid',
        kind: 'status',
        type: 'notify'
    });

    assert.deepEqual(calls.views, [message]);
    assert.equal(calls.statusReactions.length, 1);
    assert.deepEqual(calls.statusReactions[0][1].react, { text: '💚', key: message.key });
    assert.deepEqual(calls.statusReactions[0][2].statusJidList, ['15550001112@lid']);
    assert.deepEqual(calls.comments, [[message, '💚']]);
});

test('status handler ignores reaction-message updates and does not attempt status actions on them', async () => {
    writeJson('autosavestatus.json', { enabled: false });
    writeJson('autocommentstatus.json', { enabled: false });
    statusFlags = { AUTO_STATUS_VIEW: true, AUTO_STATUS_LIKE: true };
    const { calls } = makeSocket();
    const reaction = statusMessage('reaction-update-1', {
        reactionMessage: { text: '💜', key: { remoteJid: 'status@broadcast', id: 'story-1' } }
    }, { fromMe: true });

    await dispatchWithoutReactionDelay(calls.subscription.listener, {
        message: reaction,
        kind: 'status',
        type: 'append'
    });

    assert.equal(calls.views.length, 0);
    assert.equal(calls.statusReactions.length, 0);
    assert.equal(calls.comments.length, 0);
});

test('status handler skips author-dependent actions when a story author is unresolved', async () => {
    writeJson('autosavestatus.json', { enabled: false });
    writeJson('autocommentstatus.json', { enabled: false });
    statusFlags = { AUTO_STATUS_VIEW: true, AUTO_STATUS_LIKE: true };
    const { calls } = makeSocket();
    const message = statusMessage('author-missing-1', { imageMessage: { caption: 'story' } });

    await dispatchWithoutReactionDelay(calls.subscription.listener, {
        message,
        kind: 'status',
        type: 'notify'
    });

    assert.equal(calls.views.length, 0);
    assert.equal(calls.statusReactions.length, 0);
    assert.equal(calls.comments.length, 0);
});

test('incomplete status keys are skipped until an enriched update resolves the author', async () => {
    writeJson('autosavestatus.json', { enabled: false });
    writeJson('autocommentstatus.json', { enabled: false });
    statusFlags = { AUTO_STATUS_VIEW: true, AUTO_STATUS_LIKE: true };
    const { calls } = makeSocket();
    const sparse = statusMessage('enriched-1');
    const enriched = statusMessage('enriched-1', { conversation: 'status text' }, {
        participantAlt: '15550004444@lid'
    });

    await dispatchWithoutReactionDelay(calls.subscription.listener, {
        message: sparse, kind: 'status'
    });
    await dispatchWithoutReactionDelay(calls.subscription.listener, {
        message: enriched, authorJid: '15550004444@lid', kind: 'status'
    });

    assert.equal(calls.views.length, 1);
    assert.equal(calls.views[0], enriched);
    assert.equal(calls.statusReactions.length, 1);
    assert.deepEqual(calls.statusReactions[0][1].react, { text: '💚', key: enriched.key });
    assert.deepEqual(calls.statusReactions[0][2].statusJidList, ['15550004444@lid']);
});

test('ASS auto-save uses downloadStatus and forwards media to its configured archive target', async () => {
    writeJson('autosavestatus.json', { enabled: true, mode: 'chat', target: 'archive@g.us' });
    writeJson('autocommentstatus.json', { enabled: false });
    statusFlags = { AUTO_STATUS_VIEW: false, AUTO_STATUS_LIKE: false };
    const { calls } = makeSocket();
    const message = statusMessage('autosave-1', { imageMessage: { caption: 'Saved status image' } });

    await calls.subscription.listener({ message, authorJid: '15550003333@lid', kind: 'status' });

    assert.deepEqual(calls.downloads, [[message, 'buffer']]);
    const saved = calls.messages.find(([jid]) => jid === 'archive@g.us');
    assert.ok(saved);
    assert.equal(saved[1].caption, 'Saved status image');
    assert.equal(saved[1].image.toString(), 'status-media-bytes');
});

test('ASS defaults ON, saves media and text statuses from different authors to the connected account', async () => {
    fs.rmSync(path.join(tempRoot, 'database', 'autosavestatus.json'), { force: true });
    writeJson('autocommentstatus.json', { enabled: false });
    statusFlags = { AUTO_STATUS_VIEW: false, AUTO_STATUS_LIKE: false };
    const previousOwnerNumber = process.env.OWNER_NUMBER;
    delete process.env.OWNER_NUMBER;
    const { sock, calls } = makeSocket();
    sock.user = { id: '15550009999:17@s.whatsapp.net' };
    const imageStatus = statusMessage('autosave-author-one', {
        imageMessage: { caption: 'Photo from author one' }
    });
    const textStatus = statusMessage('autosave-author-two', {
        extendedTextMessage: { text: 'Text story from author two' }
    });

    try {
        await calls.subscription.listener({
            message: imageStatus, authorJid: '15550001111@s.whatsapp.net', kind: 'status', type: 'notify'
        });
        await calls.subscription.listener({
            message: textStatus, authorJid: '15550002222@lid', kind: 'status', type: 'notify'
        });
    } finally {
        if (previousOwnerNumber === undefined) delete process.env.OWNER_NUMBER;
        else process.env.OWNER_NUMBER = previousOwnerNumber;
    }

    assert.deepEqual(calls.downloads, [[imageStatus, 'buffer']]);
    assert.equal(calls.messages.length, 2);
    const [mediaSave, textSave] = calls.messages;
    assert.equal(mediaSave[0], '15550009999@s.whatsapp.net');
    assert.equal(mediaSave[1].caption, 'Photo from author one');
    assert.equal(mediaSave[1].image.toString(), 'status-media-bytes');
    assert.equal(textSave[0], '15550009999@s.whatsapp.net');
    assert.deepEqual(textSave[1], { text: 'Text story from author two' });
});

test('ACS sends configured text comments through commentStatus', async () => {
    writeJson('autosavestatus.json', { enabled: false });
    writeJson('autocommentstatus.json', { enabled: true, mode: 'text', text: 'Nice status!' });
    statusFlags = { AUTO_STATUS_VIEW: false, AUTO_STATUS_LIKE: false };
    const { calls } = makeSocket();
    const message = statusMessage('acs-text-1');

    await calls.subscription.listener({ message, authorJid: '15550005555@s.whatsapp.net', kind: 'status' });

    assert.deepEqual(calls.comments, [[message, 'Nice status!']]);
});

test('ACS sends a saved sticker template through commentStatus and ignores group statuses', async () => {
    writeJson('autosavestatus.json', { enabled: false });
    writeJson('autocommentstatus.json', { enabled: true, mode: 'sticker', text: '' });
    fs.writeFileSync(path.join(tempRoot, 'database', 'autocommentstatus-sticker.webp'), Buffer.from('sticker-template'));
    statusFlags = { AUTO_STATUS_VIEW: false, AUTO_STATUS_LIKE: false };
    const { calls } = makeSocket();
    const personal = statusMessage('acs-sticker-1');
    await calls.subscription.listener({ message: personal, authorJid: '15550005555@s.whatsapp.net', kind: 'status' });
    const group = {
        key: { remoteJid: '120363000000000001@g.us', participant: '15550005555@lid', id: 'acs-group-1' },
        message: { groupStatusMessageV2: { message: { conversation: 'group status' } } }
    };
    await calls.subscription.listener({ message: group, authorJid: '15550005555@lid', kind: 'group' });

    assert.equal(calls.comments.length, 1);
    assert.deepEqual(calls.comments[0][1], { sticker: Buffer.from('sticker-template'), mimetype: 'image/webp' });
});

test('group status automation delegates to group-specific Baileys methods', async () => {
    writeJson('autosavestatus.json', { enabled: false });
    writeJson('autocommentstatus.json', { enabled: false });
    statusFlags = { AUTO_STATUS_VIEW: true, AUTO_STATUS_LIKE: true };
    const { calls } = makeSocket();
    const message = {
        key: { remoteJid: '120363000000000001@g.us', participant: '15550005555@lid', id: 'group-1' },
        message: { groupStatusMessageV2: { message: { conversation: 'group status' } } }
    };

    await dispatchWithoutReactionDelay(calls.subscription.listener, {
        message, authorJid: '15550005555@lid', kind: 'group'
    });

    assert.deepEqual(calls.groupViews, [message]);
    assert.deepEqual(calls.groupLikes, [[message, '💚']]);
    assert.equal(calls.comments.length, 0);
});

test('returned unsubscribe detaches the CODY status callback', () => {
    statusFlags = {};
    const { calls, unsubscribe } = makeSocket();
    assert.equal(typeof unsubscribe, 'function');
    const options = calls.subscription.options;
    unsubscribe();
    // The captured subscription is owned by the Baileys API and CODY does not
    // install an independent messages.upsert listener.
    assert.equal(options.includeGroupStatus, true);
    assert.equal(calls.subscription, null);
});
