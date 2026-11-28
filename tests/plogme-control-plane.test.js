'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const plogme = require('../src/Commands/Core/plogme.js');
const { buildProjectIndex } = require('../src/Commands/Core/plogme-project-index.js');

const chat = '12025550123-1@g.us';
const toggleFile = path.join(process.cwd(), 'database', 'plogme_toggle.json');
const modeFile = path.join(process.cwd(), 'database', 'plogme_mode.json');

test.after(() => {
    for (const file of [toggleFile, modeFile, path.join(process.cwd(), 'database', 'plogme_index.json')]) {
        try { fs.unlinkSync(file); } catch {}
    }
});

test('group tag mode ignores unmentioned ordinary messages', async () => {
    plogme.setMode(chat, 'tag');
    plogme.setEnabled(chat, true);
    const handled = await plogme.execute(
        { user: { id: '999@s.whatsapp.net' } },
        { chat, isGroup: true, text: 'hello everyone', body: 'hello everyone', mentionedJid: [], key: {} },
        { reply: async () => { throw new Error('must not reply'); } }
    );
    assert.equal(handled, false);
});

test('PLOGME on/off is one global switch, not a per-chat toggle', () => {
    const otherGroup = '12025550123-2@g.us';
    const privateChat = '12025550123@s.whatsapp.net';

    plogme.setEnabled(chat, true);
    assert.equal(plogme.isEnabled(chat), true);
    assert.equal(plogme.isEnabled(otherGroup), true);
    assert.equal(plogme.isEnabled(privateChat), true);

    plogme.setEnabled(otherGroup, false);
    assert.equal(plogme.isEnabled(chat), false);
    assert.equal(plogme.isEnabled(privateChat), false);
});

test('contribute is a separate mode from all and tag', () => {
    plogme.setMode(chat, 'contribute');
    assert.equal(plogme.getMode(chat), 'contribute');
    plogme.setMode(chat, 'all');
    assert.equal(plogme.getMode(chat), 'all');
    plogme.setMode(chat, 'tag');
    assert.equal(plogme.getMode(chat), 'tag');
});

test('project index persists broken status and lastError fields', () => {
    const index = buildProjectIndex();
    assert.ok(index.commandCount > 0);
    assert.ok(index.commands.every(command => 'broken' in command && 'lastError' in command));
    assert.equal(JSON.parse(fs.readFileSync(path.join(process.cwd(), 'database', 'plogme_index.json'), 'utf8')).commandCount, index.commandCount);
});
