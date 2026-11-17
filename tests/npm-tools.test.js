'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const npmCommand = require('../src/Commands/Bot/_');
const npmInfo = require('../src/Commands/Search/npminfo');

test('npm update runs in place without removing node_modules', () => {
    assert.deepEqual(npmCommand._test.buildNpmArgs('update'), [
        'update', '--prefer-online', '--no-audit', '--no-fund',
    ]);
    assert.deepEqual(npmCommand._test.buildNpmArgs('update', ['axios']), [
        'update', 'axios', '--prefer-online', '--no-audit', '--no-fund',
    ]);
    assert.equal(npmCommand._test.ROOT, process.cwd());
});

test('npm output is bounded for chat replies', () => {
    assert.equal(npmCommand._test.trimOutput(''), 'Success (no output)');
    assert.match(npmCommand._test.trimOutput('x'.repeat(4000)), /output truncated/);
});

test('npminfo uses sendList when the socket supports it', async () => {
    const calls = [];
    const sock = {
        async sendList(...args) { calls.push(args); },
        async sendMessage() { throw new Error('sendMessage fallback should not run'); },
    };
    const message = { chat: 'user@s.whatsapp.net', key: { id: '1' } };
    await npmInfo._test.sendPackageInfo(sock, message, 'axios', [['📦 Package', 'axios'], ['🏷️ Version', 'v1.0.0']]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], message.chat);
    assert.match(calls[0][1], /axios/);
    assert.deepEqual(calls[0][2], ['📦 Package\naxios', '🏷️ Version\nv1.0.0']);
});
