const assert = require('node:assert/strict');
const test = require('node:test');
const plogme = require('../src/Commands/Core/plogme.js');

test('PLOGME reports a live environment snapshot', () => {
    const env = plogme.environmentSnapshot();
    assert.equal(env.cwd, process.cwd());
    assert.match(env.node, /^v\d+/);
    assert.ok(Number.isInteger(env.files));
    assert.ok(Object.hasOwn(env, 'memoryMb'));
});

test('PLOGME code search finds source lines inside the workspace', () => {
    const results = plogme.searchWorkspace('value.slice', { codeOnly: true });
    assert.ok(results.some(result => result.file.endsWith('src/Commands/Owner/mention.js')));
});

test('PLOGME send_file uses the live socket sender when opts.sendMessage is absent', async () => {
    const replies = [];
    const sent = [];
    const sock = {
        sendMessage: async (jid, content, options) => {
            sent.push({ jid, content, options });
            return { key: { id: 'file-1' } };
        }
    };
    const result = await plogme.executeIntent(sock, { chat: '12345@s.whatsapp.net', key: { id: 'm1' } }, {
        reply: async value => replies.push(value)
    }, { action: 'send_file', path: 'src/Commands/Owner/mention.js' });
    assert.equal(result.handled, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].jid, '12345@s.whatsapp.net');
    assert.equal(sent[0].content.fileName, 'mention.js');
    assert.ok(Buffer.isBuffer(sent[0].content.document));
    assert.ok(replies.some(reply => /File sent/i.test(reply)));
});
