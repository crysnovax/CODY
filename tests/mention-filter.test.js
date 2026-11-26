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

function tagged(jid, sender = 'ordinary@s.whatsapp.net') {
    return {
        chat: 'filter-test@g.us',
        sender,
        key: { fromMe: false, participant: sender },
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

test('.mention filter stays on while Plogme is enabled despite a manual off override', async () => {
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
        assert.equal(mention.isMentionFilterEnabled(chat, true), true);
        await run(['filter', 'on']);
        assert.equal(mention.getMentionFilterSetting(), true);
        assert.equal(mention.isMentionFilterEnabled(chat, true), true);
        assert.equal(mention.isMentionFilterEnabled('another-chat@g.us', true), true);
    } finally {
        restoreFilter();
        restoreToggle();
    }
});

test('a stale persisted filter override cannot override Plogme state', () => {
    const restoreFilter = preserve(filterFile);
    try {
        fs.writeFileSync(filterFile, JSON.stringify({ enabled: false }));
        assert.equal(mention.isMentionFilterEnabled('stale-off@g.us', true), true);
        assert.equal(mention.isMentionFilterEnabled('stale-off@g.us', false), false);
        fs.writeFileSync(filterFile, JSON.stringify({ enabled: true }));
        assert.equal(mention.isMentionFilterEnabled('stale-on@g.us', true), true);
        assert.equal(mention.isMentionFilterEnabled('stale-on@g.us', false), false);
    } finally {
        restoreFilter();
    }
});

test('ordinary senders remain eligible while owner/sudo/dual senders are suppressible', async () => {
    const sock = {
        user: { id: '111111@s.whatsapp.net', lid: '111111@lid' },
        signalRepository: { lidMapping: {
            getLIDForPN: async jid => jid === '111111@s.whatsapp.net' ? '111111@lid' : null,
            getPNForLID: async jid => jid === '111111@lid' ? '111111@s.whatsapp.net' : null
        } }
    };
    const previousSudo = process.env.SUDO_NUMBERS;
    process.env.SUDO_NUMBERS = '222222';
    try {
        assert.equal(mention.isExplicitlyMentioned(tagged('111111@s.whatsapp.net')), true);
        assert.equal(await mention.isPrivilegedSender(sock, tagged('111111@s.whatsapp.net')), false);
        assert.equal(await mention.isPrivilegedSender(sock, tagged('111111@s.whatsapp.net', '222222@s.whatsapp.net')), true);
        assert.equal(await mention.isPrivilegedMentioned(sock, tagged('111111@lid')), false);
    } finally {
        if (previousSudo === undefined) delete process.env.SUDO_NUMBERS;
        else process.env.SUDO_NUMBERS = previousSudo;
    }
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
