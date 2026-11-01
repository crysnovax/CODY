'use strict';

const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'plogme') {
        return { downloadContentFromMessage: async function* () { yield Buffer.from('group-status-media'); } };
    }
    return originalLoad.call(this, request, parent, isMain);
};
global.prefix = '.';
const activeCommand = require('../src/Commands/Tools/retrieve');
const secondaryCommand = require('../src/Commands/Utils/deleted');
const deletedStore = require('../library/quoted');

after(() => {
    Module._load = originalLoad;
    delete global.prefix;
});

function makeSock() {
    const sent = [];
    return { sent, async sendMessage(chat, content, options) { sent.push({ chat, content, options }); } };
}
async function cacheRevoked(chat, id, message) {
    const original = { key: { remoteJid: chat, id }, message };
    deletedStore.cacheMessage(original);
    await deletedStore.onDelete(null, [{ key: original.key, update: { message: null } }], null);
}

for (const [label, command] of [['active .deleted command', activeCommand], ['secondary deleted command', secondaryCommand]]) {
    test(`${label} retrieves text from groupStatusMessageV2 instead of rejecting the envelope`, async () => {
        const chat = `status-text-${label.replace(/\W/g, '')}@g.us`;
        await cacheRevoked(chat, 'text-status', {
            groupStatusMessageV2: { message: { conversation: 'recovered group status text' } },
        });
        const sock = makeSock();
        const replies = [];
        await command.execute(sock, { chat, key: { id: 'retrieve-request' } }, {
            args: [], reply: text => replies.push(text),
        });
        assert.deepEqual(replies, []);
        assert.ok(sock.sent.some(({ content }) => content?.text === 'recovered group status text'));
    });
}

test('active .deleted command retrieves media nested in groupStatusMessageV2', async () => {
    const chat = 'status-image-retrieval@g.us';
    await cacheRevoked(chat, 'image-status', {
        groupStatusMessageV2: { message: { imageMessage: { caption: 'image from group status' } } },
    });
    const sock = makeSock();
    const replies = [];
    await activeCommand.execute(sock, { chat, key: { id: 'retrieve-image-request' } }, {
        args: [], reply: text => replies.push(text),
    });
    assert.deepEqual(replies, []);
    assert.ok(sock.sent.some(({ content }) => Buffer.isBuffer(content?.image) && content.caption === 'image from group status'));
});
