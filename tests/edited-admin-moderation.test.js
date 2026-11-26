'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function makeMessage(group, sender, id, overrides = {}) {
    const content = overrides.message || { conversation: 'edited violation' };
    return {
        isGroup: true,
        chat: group,
        sender,
        key: { remoteJid: group, participant: sender, id },
        message: content,
        msg: content,
        text: overrides.text || 'edited violation',
        mtype: overrides.mtype || 'conversation',
        __editModeration: true,
        ...overrides,
    };
}

function makeSocket(sent, options = {}) {
    const participants = options.participants || [
        { id: 'admin@s.whatsapp.net', admin: 'admin' },
        { id: 'member@s.whatsapp.net', admin: null },
        { id: 'bot@s.whatsapp.net', admin: 'admin' },
    ];
    return {
        user: { id: 'bot@s.whatsapp.net' },
        groupMetadata: async () => ({ participants }),
        signalRepository: options.signalRepository,
        sendMessage: async (_chat, content) => {
            sent.push(content);
            return {};
        },
        groupParticipantsUpdate: async () => {},
    };
}

async function withTempStore(run) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-edited-admin-'));
    const previousCwd = process.cwd();
    fs.mkdirSync(path.join(dir, 'database'), { recursive: true });
    process.chdir(dir);
    try {
        return await run(dir);
    } finally {
        process.chdir(previousCwd);
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

test('edited admins remain exempt while edited members remain moderated', async () => {
    await withTempStore(async dir => {
        const group = 'edited-admin-regression@g.us';
        const sent = [];
        const sock = makeSocket(sent);

        fs.writeFileSync(path.join(dir, 'database', 'antilink.json'), JSON.stringify({
            [group]: { enabled: true, action: 'delete', whitelist: [], permit: [], domains: [] },
        }));
        fs.writeFileSync(path.join(dir, 'database', 'antitag.json'), JSON.stringify({
            [group]: { enabled: true, action: 'delete', minTags: 2 },
        }));
        fs.writeFileSync(path.join(dir, 'database', 'antispam.json'), JSON.stringify({
            [group]: { enabled: true, action: 'delete', maxMessages: 1, timeWindow: 5000 },
        }));
        fs.writeFileSync(path.join(dir, 'database', 'antibot.json'), JSON.stringify({
            [group]: { enabled: true, action: 'delete' },
        }));
        fs.writeFileSync(path.join(dir, 'database', 'slowmode.json'), JSON.stringify({
            [group]: { enabled: true, intervalMs: 1000 },
        }));

        const antilink = require('../src/Commands/Admin/antilink');
        const antitag = require('../src/Commands/Admin/antitag');
        const antispam = require('../src/Commands/Admin/antispam');
        const slowmode = require('../src/Commands/Admin/slowmode');
        const { createAntiMessageModeration } = require('../src/Plugin/antiMessageModeration');
        const sharedAnti = createAntiMessageModeration({
            command: 'antibot',
            label: 'Anti Bot',
            description: 'edited-admin regression',
            databaseName: 'antibot.json',
            warningDatabaseName: 'antibot_warns.json',
            detector: () => true,
            violationLabel: 'test violation',
        });

        const editedAdminKey = {
            remoteJid: group,
            participant: 'stale@s.whatsapp.net',
            participantAlt: 'admin@s.whatsapp.net',
            id: 'edited-admin',
        };
        const adminLink = makeMessage(group, 'stale@s.whatsapp.net', 'admin-link', {
            key: editedAdminKey,
            message: { conversation: 'https://example.invalid/edited-link' },
            text: 'https://example.invalid/edited-link',
        });
        await antilink.handleAntiLink(sock, adminLink, { key: adminLink.key, message: adminLink.message });
        assert.equal(sent.length, 0, 'edited admin links remain exempt');

        const lidAdminSock = makeSocket(sent, {
            participants: [
                { id: '12345@lid', phoneNumber: 'admin@s.whatsapp.net', admin: 'admin' },
                { id: 'bot@s.whatsapp.net', admin: 'admin' },
            ],
            signalRepository: {
                lidMapping: {
                    getPNForLID: async jid => jid === '12345@lid' ? 'admin@s.whatsapp.net' : null,
                    getLIDForPN: async jid => jid === 'admin@s.whatsapp.net' ? '12345@lid' : null,
                },
            },
        });
        const lidAdminLink = makeMessage(group, '12345@lid', 'lid-admin-link', {
            key: { remoteJid: group, participant: '12345@lid', participantAlt: '12345@lid', id: 'lid-admin-link' },
            message: { conversation: 'https://example.invalid/lid-edited-link' },
            text: 'https://example.invalid/lid-edited-link',
        });
        await antilink.handleAntiLink(lidAdminSock, lidAdminLink, { key: lidAdminLink.key, message: lidAdminLink.message });
        assert.equal(sent.length, 0, 'edited LID admin links remain exempt');

        const memberLink = makeMessage(group, 'member@s.whatsapp.net', 'member-link', {
            message: { conversation: 'https://example.invalid/edited-link' },
            text: 'https://example.invalid/edited-link',
        });
        await antilink.handleAntiLink(sock, memberLink, { key: memberLink.key, message: memberLink.message });
        assert.ok(sent.some(content => content?.delete), 'edited member links remain moderated');

        sent.length = 0;
        const adminTag = makeMessage(group, 'stale@s.whatsapp.net', 'admin-tag', {
            key: { ...editedAdminKey, id: 'admin-tag' },
            mentionedJid: ['one@s.whatsapp.net', 'two@s.whatsapp.net'],
            message: { conversation: '@one @two' },
            text: '@one @two',
        });
        await antitag.handleAntiTag(sock, adminTag);
        assert.equal(sent.length, 0, 'edited admin mass-tags remain exempt');

        const memberTag = makeMessage(group, 'member@s.whatsapp.net', 'member-tag', {
            mentionedJid: ['one@s.whatsapp.net', 'two@s.whatsapp.net'],
            message: { conversation: '@one @two' },
            text: '@one @two',
        });
        await antitag.handleAntiTag(sock, memberTag);
        assert.ok(sent.some(content => content?.delete), 'edited member mass-tags remain moderated');

        sent.length = 0;
        const adminSpam = makeMessage(group, 'stale@s.whatsapp.net', 'admin-spam', {
            key: { ...editedAdminKey, id: 'admin-spam' },
        });
        await antispam.handleAntiSpam(sock, adminSpam);
        assert.equal(sent.length, 0, 'edited admin spam remains exempt');
        const slowmodeResult = await slowmode.handleSlowmode(sock, adminSpam, { key: adminSpam.key, message: adminSpam.message });
        assert.equal(slowmodeResult, false, 'edited admin slowmode remains exempt through participantAlt');

        const memberSpam = makeMessage(group, 'member@s.whatsapp.net', 'member-spam');
        await antispam.handleAntiSpam(sock, memberSpam);
        assert.ok(sent.some(content => content?.delete), 'edited member spam remains moderated');

        sent.length = 0;
        const adminShared = makeMessage(group, 'admin@s.whatsapp.net', 'admin-shared');
        assert.equal(await sharedAnti.handleModeration(sock, adminShared, { key: adminShared.key, message: adminShared.message }), false);
        assert.equal(sent.length, 0, 'edited admin messages remain exempt in shared moderation');

        const memberShared = makeMessage(group, 'member@s.whatsapp.net', 'member-shared');
        assert.equal(await sharedAnti.handleModeration(sock, memberShared, { key: memberShared.key, message: memberShared.message }), true);
        assert.ok(sent.some(content => content?.delete), 'edited member messages remain moderated in shared moderation');
    });
});
