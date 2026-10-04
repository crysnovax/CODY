const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');

const setname = require('../src/Commands/Owner/sn.js');
const clear = require('../src/Commands/Tools/clear.js');
const { withAppStateRecovery } = require('../src/Utils/app-state');

test('setname resyncs app state and retries when the key is missing', async () => {
    const calls = [];
    let updates = 0;
    const replies = [];
    const sock = {
        resyncAppState: async (...args) => calls.push({ type: 'resync', args }),
        updateProfileName: async name => {
            updates++;
            calls.push({ type: 'update', name });
            if (updates === 1) throw new Error('App state key not present!');
        },
        sendMessage: async (...args) => calls.push({ type: 'send', args })
    };

    await setname.execute(sock, { chat: '123@g.us', key: { id: 'm1' } }, {
        args: ['Cody', 'AI'],
        reply: async text => replies.push(text)
    });

    assert.equal(updates, 2);
    assert.deepEqual(calls.find(call => call.type === 'resync').args, [['regular_high', 'regular_low', 'regular'], true]);
    assert.match(replies[0], /Name updated:.*Cody AI/);
});

test('clear uses the supported clear-chat patch for commands from the owner', async () => {
    const modifications = [];
    const sent = [];
    const sock = {
        chatModify: async (mod, jid) => modifications.push({ mod, jid }),
        sendMessage: async (jid, content) => sent.push({ jid, content })
    };
    const message = {
        chat: '123@g.us',
        key: { id: 'm2', fromMe: false },
        messageTimestamp: 42
    };

    await clear.execute(sock, message);

    assert.equal(modifications.length, 1);
    assert.deepEqual(modifications[0], {
        jid: message.chat,
        mod: { clear: true, lastMessages: [{ key: message.key, messageTimestamp: 42 }] }
    });
    assert.deepEqual(sent, [{ jid: message.chat, content: { text: '✦ _*clean*_' } }]);
});

test('app-state recovery waits for a key-share update before retrying', async () => {
    const ev = new EventEmitter();
    const calls = [];
    let attempts = 0;
    const sock = {
        ev,
        resyncAppState: async collections => {
            calls.push(collections);
            ev.emit('creds.update', { myAppStateKeyId: 'fresh-key' });
        }
    };

    const result = await withAppStateRecovery(sock, async () => {
        attempts++;
        if (attempts === 1) throw new Error('App state key not present!');
        return 'recovered';
    });

    assert.equal(result, 'recovered');
    assert.equal(attempts, 2);
    assert.deepEqual(calls, [['regular_high', 'regular_low', 'regular']]);
});
