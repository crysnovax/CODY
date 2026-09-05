const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'plogme') {
        return {
            downloadContentFromMessage: async function* () {
                yield Buffer.from('unused');
            }
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const poststory = require('../src/Commands/Owner/poststory.js');
Module._load = originalLoad;

test('poststory uses the verified sendStatus API when available', async () => {
    const calls = [];
    const replies = [];
    const sock = {
        user: { id: '99999:0@s.whatsapp.net' },
        signalRepository: { lidMapping: {} },
        sendStatus: async content => {
            calls.push({ type: 'sendStatus', content });
            return { key: { id: 'status-1' } };
        },
        sendMessage: async () => {
            throw new Error('legacy status relay should not be used when sendStatus exists');
        }
    };
    const message = { chat: '99999@s.whatsapp.net', key: { id: 'incoming-1' } };

    await poststory.execute(sock, message, {
        args: ['hello', 'world'],
        prefix: '.',
        store: { contacts: new Map([['contact', { id: '12345@s.whatsapp.net' }]]) },
        reply: async value => replies.push(value)
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].type, 'sendStatus');
    assert.equal(calls[0].content.text, 'hello world');
    assert.deepEqual(calls[0].content.statusJidList, ['12345@s.whatsapp.net', '99999@s.whatsapp.net']);
    assert.match(replies[0], /Status posted successfully/);
});
