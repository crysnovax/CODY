'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');

const commandPath = path.resolve(__dirname, '../src/Commands/Bot/Faketyping.js');
const originalLoad = Module._load;
const values = { FAKE_TYPING: 'off' };
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../../Plugin/configManager' && parent?.filename === commandPath) {
        return {
            getVar: (key, fallback) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback,
            setVar: (key, value) => (values[key] = value),
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const command = require(commandPath);

test('typing command accepts bare cmd and command aliases', async () => {
    assert.ok(command.alias.includes('typing'));
    const replies = [];
    await command.execute({}, {}, { args: ['cmd'], reply: text => replies.push(text) });
    assert.equal(values.FAKE_TYPING, 'cmd');
    assert.match(replies.at(-1), /commands only/i);

    await command.execute({}, {}, { args: ['on', 'commands'], reply: text => replies.push(text) });
    assert.equal(values.FAKE_TYPING, 'cmd');
});

test('typing status treats the manual boolean true setting as all-message mode', async () => {
    values.FAKE_TYPING = true;
    const replies = [];
    await command.execute({}, {}, { args: [], reply: text => replies.push(text) });
    assert.match(replies.at(-1), /ON \(all messages\)/);
});

test('typing command keeps on, off, and false aliases working', async () => {
    const replies = [];
    await command.execute({}, {}, { args: ['on'], reply: text => replies.push(text) });
    assert.equal(values.FAKE_TYPING, 'all');
    await command.execute({}, {}, { args: ['false'], reply: text => replies.push(text) });
    assert.equal(values.FAKE_TYPING, false);
});

test.after(() => { Module._load = originalLoad; });
