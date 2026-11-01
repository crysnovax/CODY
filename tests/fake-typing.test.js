'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isCommandMessage, shouldFakeTyping, sendFakeTyping } = require('../library/fake-typing');

test('fake typing defaults to known commands only and does not type for arbitrary prefixed text', () => {
    const getCommand = name => ['help', 'quoted'].includes(name) ? { name } : undefined;
    assert.equal(shouldFakeTyping('cmd', '.help', '.', getCommand), true);
    assert.equal(shouldFakeTyping('cmd', '.quoted test', '.', getCommand), true);
    assert.equal(shouldFakeTyping('cmd', '.not-a-command', '.', getCommand), false);
    assert.equal(shouldFakeTyping('cmd', 'ordinary text', '.', getCommand), false);
    assert.equal(shouldFakeTyping('off', '.help', '.', getCommand), false);
});

test('command-only fake typing honors no-prefix mode without typing on every message', () => {
    const getCommand = name => name === 'help' ? { name } : undefined;
    assert.equal(isCommandMessage('help me', '', getCommand), true);
    assert.equal(shouldFakeTyping('cmd', 'help me', '', getCommand), true);
    assert.equal(shouldFakeTyping('cmd', 'ordinary conversation', '', getCommand), false);
});

test('all-message mode and presence update fire on composing', async () => {
    const calls = [];
    const sock = { sendPresenceUpdate: async (...args) => calls.push(args) };
    assert.equal(shouldFakeTyping('all', 'ordinary conversation', '.', () => null), true);
    assert.equal(await sendFakeTyping(sock, 'chat@g.us'), true);
    assert.deepEqual(calls, [['composing', 'chat@g.us']]);
});

test('the bootstrap invokes the tested helper and defaults to the mode shown by .faketyping', () => {
    const root = path.resolve(__dirname, '..');
    const bootstrap = fs.readFileSync(path.join(root, '?.js'), 'utf8');
    const command = fs.readFileSync(path.join(root, 'src/Commands/Bot/Faketyping.js'), 'utf8');
    assert.match(bootstrap, /getVar\('FAKE_TYPING', 'cmd'\)/);
    assert.match(bootstrap, /shouldFakeTyping\(typingMode, bodyCheck, resolvePrefix\(\), getCommand\)/);
    assert.match(command, /getVar\('FAKE_TYPING', 'cmd'\)/);
});
