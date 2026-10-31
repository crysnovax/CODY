'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sreact = require('../src/Commands/Owner/sreact');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const originalModuleLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'plogme') {
        return { downloadContentFromMessage: async () => ({ async *[Symbol.asyncIterator]() {} }) };
    }
    return originalModuleLoad.call(this, request, parent, isMain);
};
const mention = require('../src/Commands/Owner/mention');
Module._load = originalModuleLoad;

test('.sreact relays the supplied default sticker as a reaction to the replied-to message', async () => {
    const calls = [];
    const replies = [];
    const targetKey = {
        remoteJid: '123@g.us',
        fromMe: false,
        id: 'target-message',
        participant: '456@s.whatsapp.net'
    };
    await sreact.execute({ relayMessage: async (...args) => calls.push(args) }, {
        chat: '123@g.us',
        quoted: { key: targetKey }
    }, { args: [], reply: async text => replies.push(text) });

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '123@g.us');
    assert.deepEqual(calls[0][1].messageContextInfo.messageAssociation, {
        associationType: 11,
        parentMessageKey: targetKey
    });
    assert.deepEqual(calls[0][1].stickerMessage, sreact.DEFAULT_STICKER_MESSAGE);
    assert.equal(calls[0][2] && Object.keys(calls[0][2]).length, 0);
    assert.equal(replies.length, 0);
    assert.equal(sreact.DEFAULT_STICKER_MESSAGE.url,
        'https://mmg.whatsapp.net/o1/v/t24/f2/m232/AQPEoFVa7kEaTxJ5N4kBacoDZ1k0IzHqkfsmUhLxV8C4xB11yCktX6UEHvkJnmgTsnEhoRW27_Pma0f92oVnKzwBB4YUsMbtz2HlS_Oxeg?ccb=9-4&oh=01_Q5Aa5wEK3E2DIH-ZBY_naItwmTshYSHL2bClVxX2UUGd6_gOyw&oe=6B0DB1D3&_nc_sid=e6ed6c&mms3=true');
});

test('.sreact asks for a reply instead of reacting to its own command', async () => {
    const replies = [];
    let relayed = false;
    await sreact.execute({ relayMessage: async () => { relayed = true; } }, {
        chat: '123@g.us',
        key: { id: 'command-message' }
    }, { args: [], reply: async text => replies.push(text) });

    assert.equal(relayed, false);
    assert.match(replies[0], /Reply to the message/);
});

test('.mention sreact selects the built-in sticker response without requiring setup', async () => {
    const configPath = path.resolve(__dirname, '../database/mention_config.json');
    const previousConfig = { ...mention.mentionConfig };
    const originalWriteFileSync = fs.writeFileSync;
    let savedConfig;
    const replies = [];
    fs.writeFileSync = function (file, data, ...rest) {
        if (path.resolve(String(file)) === configPath) {
            savedConfig = String(data);
            return;
        }
        return originalWriteFileSync.call(this, file, data, ...rest);
    };
    try {
        await mention.execute({}, {}, {
            args: ['sreact'],
            prefix: '.',
            reply: async text => replies.push(text)
        });
        assert.equal(mention.mentionConfig.active, true);
        assert.equal(mention.mentionConfig.action, 'sreact');
        assert.equal(JSON.parse(savedConfig).action, 'sreact');
        assert.match(replies[0], /STICKER REACTION/);
    } finally {
        fs.writeFileSync = originalWriteFileSync;
        Object.assign(mention.mentionConfig, previousConfig);
    }
});
