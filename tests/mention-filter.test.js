'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mention = require('../src/Commands/Owner/mention');
const plogme = require('../src/Commands/Core/plogme');

const filterFile = path.join(__dirname, '..', 'database', 'mention_filter.json');
const toggleFile = path.join(__dirname, '..', 'database', 'plogme_toggle.json');

function preserve(file) {
    const exists = fs.existsSync(file);
    const content = exists ? fs.readFileSync(file) : null;
    return () => {
        if (content) fs.writeFileSync(file, content);
        else fs.rmSync(file, { force: true });
    };
}

function tagged(jid) {
    return {
        chat: 'filter-test@g.us',
        key: { fromMe: false },
        message: { extendedTextMessage: { contextInfo: { mentionedJid: [jid] } } }
    };
}

test('global mention filter follows each chat\'s Plogme gate by default', () => {
    const restoreFilter = preserve(filterFile);
    const restoreToggle = preserve(toggleFile);
    const chat = 'filter-default-test@g.us';
    try {
        fs.writeFileSync(filterFile, '{}');
        plogme.setEnabled(chat, true);
        assert.equal(mention.getMentionFilterSetting(), null);
        assert.equal(mention.isMentionFilterEnabled(chat, plogme.isEnabled(chat)), true);
        plogme.setEnabled(chat, false);
        assert.equal(mention.isMentionFilterEnabled(chat, plogme.isEnabled(chat)), false);
    } finally {
        restoreFilter();
        restoreToggle();
    }
});

test('.mention filter on/off persists one global override for every chat', async () => {
    const restoreFilter = preserve(filterFile);
    const restoreToggle = preserve(toggleFile);
    const chat = 'filter-command-test@g.us';
    try {
        fs.writeFileSync(filterFile, '{}');
        plogme.setEnabled(chat, true);
        let response = '';
        const run = args => mention.execute(null, { chat }, {
            args, prefix: '.', reply: async text => { response = text; }
        });
        await run(['filter', 'off']);
        assert.equal(mention.getMentionFilterSetting(), false);
        assert.match(response, /Setting\s+: ✗ OFF/);
        assert.equal(mention.isMentionFilterEnabled(chat, true), false);
        await run(['filter', 'on']);
        assert.equal(mention.getMentionFilterSetting(), true);
        assert.equal(mention.isMentionFilterEnabled(chat, true), true);
        assert.equal(mention.isMentionFilterEnabled('another-chat@g.us', true), true);
    } finally {
        restoreFilter();
        restoreToggle();
    }
});

test('ordinary explicit mentions remain eligible while configured privileged targets are suppressible', async () => {
    const sock = {
        user: { id: '111111@s.whatsapp.net', lid: '111111@lid' },
        signalRepository: { lidMapping: {
            getLIDForPN: async jid => jid === '111111@s.whatsapp.net' ? '111111@lid' : null,
            getPNForLID: async jid => jid === '111111@lid' ? '111111@s.whatsapp.net' : null
        } }
    };
    assert.equal(mention.isExplicitlyMentioned(tagged('222222@s.whatsapp.net')), true);
    assert.equal(await mention.isPrivilegedMentioned(sock, tagged('222222@s.whatsapp.net')), false);
    assert.equal(await mention.isPrivilegedMentioned(sock, tagged('111111@lid')), false);
});

test('filter status reports Plogme-off as effectively off even after a manual on', async () => {
    const restoreFilter = preserve(filterFile);
    const restoreToggle = preserve(toggleFile);
    const chat = 'filter-status-test@g.us';
    try {
        fs.writeFileSync(filterFile, '{}');
        plogme.setEnabled(chat, false);
        let response = '';
        await mention.execute(null, { chat }, {
            args: ['filter', 'on'], prefix: '.', reply: async text => { response = text; }
        });
        assert.match(response, /Effective: ✗ OFF/);
        assert.equal(mention.isMentionFilterEnabled(chat, false), false);
    } finally {
        restoreFilter();
        restoreToggle();
    }
});
