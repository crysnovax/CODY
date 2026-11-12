'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const previousCwd = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-ass-command-'));
process.chdir(tempRoot);
const ass = require('../src/Commands/Owner/ass.js');
process.chdir(previousCwd);

test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

test('ass starts enabled in DM mode on a fresh installation', async () => {
    assert.deepEqual(ass.getConfig(), { enabled: true, mode: 'dm', target: null });
    const replies = [];
    await ass.execute({}, {}, { args: ['status'], reply: async text => replies.push(text) });
    assert.match(replies[0], /Enabled: \*ON\*/);
    assert.match(replies[0], /Mode: \*DM\*/);
});

test('ass still allows an explicit OFF setting and saves it', async () => {
    const replies = [];
    await ass.execute({}, {}, { args: ['off'], reply: async text => replies.push(text) });
    assert.equal(ass.getConfig().enabled, false);
    const persisted = JSON.parse(fs.readFileSync(path.join(tempRoot, 'database', 'autosavestatus.json'), 'utf8'));
    assert.equal(persisted.enabled, false);
    assert.match(replies[0], /DISABLED/);
});
