'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const translationService = require('../src/Plugin/translationService');
const originalLoad = Module._load;
const translationCalls = [];

Module._load = function (request, parent, isMain) {
    const filename = parent?.filename || '';
    if (request === '../../Plugin/translationService' && /\/Commands\/Tools\/trd?\.js$/.test(filename)) {
        return {
            ...translationService,
            translate: async (text, target) => {
                translationCalls.push({ text, target });
                return { translated: 'My name is Crysnova', from: 'fr' };
            }
        };
    }
    if (request === '../Core/✐' && /\/Commands\/Tools\/trd\.js$/.test(filename)) {
        return { loadDefaults: () => ({ 'alice@s.whatsapp.net': 'en' }) };
    }
    return originalLoad.call(this, request, parent, isMain);
};

let tr;
let trd;
try {
    tr = require('../src/Commands/Tools/tr');
    trd = require('../src/Commands/Tools/trd');
} finally {
    Module._load = originalLoad;
}

const expectedContent = {
    sections: [
        {
            type: 'plain',
            text: '`ⓘ Original French` *[fr]*\n`♲ New English` *[en]*\n\n\n Je m\'appelle Crysnova\n'
        },
        {
            type: 'list',
            title: 'Translated',
            items: ['🌐 My name is Crysnova']
        }
    ]
};

async function runAndAssertRichResponse(command, args, message) {
    const richCalls = [];
    const normalCalls = [];
    const sock = {
        sendRichAIResponse: async (...call) => richCalls.push(call),
        sendMessage: async (...call) => normalCalls.push(call)
    };
    const m = {
        chat: 'chat@g.us',
        sender: 'alice@s.whatsapp.net',
        key: { id: 'command-message' },
        ...message
    };
    await command.execute(sock, m, { reply: async () => {}, args });
    assert.equal(richCalls.length, 1);
    assert.equal(normalCalls.filter(([jid, content]) => content?.react === undefined).length, 0);
    assert.equal(richCalls[0][0], m.chat);
    assert.deepEqual(richCalls[0][1], expectedContent);
    assert.equal(richCalls[0][2], m);
}

test('.tr sends translation results using rich plain and list sections', async () => {
    translationCalls.length = 0;
    await runAndAssertRichResponse(tr, ['en', "Je m'appelle Crysnova"]);
    assert.deepEqual(translationCalls, [{ text: "Je m'appelle Crysnova", target: 'en' }]);
});

test('.trd sends default-language results using the same rich sections', async () => {
    translationCalls.length = 0;
    await runAndAssertRichResponse(trd, [], { quoted: { text: "Je m'appelle Crysnova" } });
    assert.deepEqual(translationCalls, [{ text: "Je m'appelle Crysnova", target: 'en' }]);
});
