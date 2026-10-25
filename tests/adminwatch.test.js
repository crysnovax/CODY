'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const adminwatch = require('../src/Plugin/adminwatch');

async function withTempStore(run) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-adminwatch-'));
    const previous = process.env.CODY_ADMINWATCH_DB;
    process.env.CODY_ADMINWATCH_DB = path.join(dir, 'database', 'adminwatch.json');
    try {
        return await run(dir, process.env.CODY_ADMINWATCH_DB);
    } finally {
        if (previous === undefined) delete process.env.CODY_ADMINWATCH_DB;
        else process.env.CODY_ADMINWATCH_DB = previous;
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

async function withEnvironment(values, run) {
    const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    for (const [key, value] of Object.entries(values)) process.env[key] = value;
    try {
        return await run();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

function makeIdentityGroup() {
    const participants = [
        { id: 'target@lid', phoneNumber: '444444@s.whatsapp.net', admin: 'admin' },
        { id: 'anotheradmin@s.whatsapp.net', admin: 'admin' },
        { id: '111111@s.whatsapp.net', admin: 'admin' },
        { id: '222222@s.whatsapp.net', admin: 'admin' },
        { id: 'dual@lid', phoneNumber: '333333@s.whatsapp.net', admin: 'admin' },
        { id: 'groupcreator@s.whatsapp.net', admin: 'superadmin' },
        { id: '2348077134210@s.whatsapp.net', admin: 'admin' },
        { id: 'member@s.whatsapp.net', admin: null },
        { id: 'bot@s.whatsapp.net', admin: 'admin' },
    ];
    const phoneByLid = new Map([
        ['target@lid', '444444@s.whatsapp.net'],
        ['dual@lid', '333333@s.whatsapp.net'],
    ]);
    const metadata = { owner: 'groupcreator@s.whatsapp.net', participants };
    const sock = {
        user: { id: 'bot@s.whatsapp.net' },
        signalRepository: {
            lidMapping: {
                getPNForLID: async lid => phoneByLid.get(lid) || null,
                getLIDForPN: async pn => [...phoneByLid].find(([, value]) => value === pn)?.[0] || null,
            },
        },
        groupMetadata: async () => metadata,
        sendMessage: async () => {},
        groupParticipantsUpdate: async () => {},
    };
    return { metadata, participants, sock };
}

function messageFor(group, jid) {
    return {
        isGroup: true,
        chat: group,
        sender: jid,
        key: { remoteJid: group, participant: jid, id: `msg-${jid}` },
        message: { conversation: 'forbidden content' },
        msg: { conversation: 'forbidden content' },
        text: 'forbidden content',
    };
}

test('adminwatch all-toggle and per-anti overrides persist independently for each group', async () => {
    await withTempStore(async (_dir, storePath) => {
        const groupA = 'adminwatch-a@g.us';
        const groupB = 'adminwatch-b@g.us';
        const antiSettingsPath = path.join(_dir, 'database', 'antilink.json');
        const existingAntiSettings = { [groupA]: { enabled: true, action: 'warn', whitelist: ['https://example.invalid'] } };
        fs.mkdirSync(path.dirname(antiSettingsPath), { recursive: true });
        fs.writeFileSync(antiSettingsPath, JSON.stringify(existingAntiSettings));
        const replies = [];
        const reply = async value => replies.push(String(value));

        await adminwatch.command.execute({}, { chat: groupA }, { args: ['on'], reply });
        assert.equal(adminwatch.isAdminwatchEnabled(groupA, 'antilink'), true);
        assert.equal(adminwatch.isAdminwatchEnabled(groupA, 'antispam'), true);
        await adminwatch.command.execute({}, { chat: groupA }, { args: ['antilink', 'off'], reply });
        assert.equal(adminwatch.isAdminwatchEnabled(groupA, 'antilink'), false);
        assert.equal(adminwatch.isAdminwatchEnabled(groupA, 'antispam'), true);
        await adminwatch.command.execute({}, { chat: groupB }, { args: ['antimention', 'on'], reply });
        assert.equal(adminwatch.isAdminwatchEnabled(groupB, 'antitag'), true);
        assert.equal(adminwatch.isAdminwatchEnabled(groupB, 'antilink'), false);
        assert.equal(adminwatch.isAdminwatchEnabled(groupA, 'antitag'), true);

        delete require.cache[require.resolve('../src/Plugin/adminwatch')];
        const reloaded = require('../src/Plugin/adminwatch');
        assert.equal(reloaded.isAdminwatchEnabled(groupA, 'antilink'), false);
        assert.equal(reloaded.isAdminwatchEnabled(groupA, 'antispam'), true);
        assert.equal(reloaded.isAdminwatchEnabled(groupB, 'antitag'), true);
        assert.equal(reloaded.isAdminwatchEnabled(groupB, 'antispam'), false);
        assert.ok(fs.existsSync(storePath), 'settings survive module/process restart');

        await reloaded.command.execute({}, { chat: groupA }, { args: ['off'], reply });
        assert.equal(reloaded.isAdminwatchEnabled(groupA, 'antispam'), false);
        assert.equal(reloaded.isAdminwatchEnabled(groupA, 'antilink'), false);
        assert.deepEqual(reloaded.getGroupConfig(groupA).overrides, {}, 'all-toggle clears per-anti overrides');
        assert.equal(reloaded.isAdminwatchEnabled(groupB, 'antitag'), true, 'another group remains independent');
        assert.deepEqual(JSON.parse(fs.readFileSync(antiSettingsPath, 'utf8')), existingAntiSettings,
            'adminwatch does not rewrite or migrate existing anti settings');
        assert.match(replies.join('\n'), /antilink/i);
    });
});

test('adminwatch targets non-exempt WhatsApp admins and spares members, owner, sudo, dual, and group creator', async () => {
    await withTempStore(async () => withEnvironment({
        OWNER_NUMBER: '111111',
        SUDO_NUMBERS: '222222',
        DUAL_NUMBERS: '333333',
    }, async () => {
        const group = 'roles@g.us';
        adminwatch.setAdminwatchAll(group, true);
        const { sock } = makeIdentityGroup();

        assert.equal(await adminwatch.shouldApplyAdminwatch(sock, messageFor(group, 'target@lid'), 'antilink'), true,
            'LID-backed eligible admin is targeted');
        assert.equal(await adminwatch.shouldApplyAdminwatch(sock, messageFor(group, 'anotheradmin@s.whatsapp.net'), 'antilink'), true,
            'another ordinary group admin is targeted');
        assert.equal(await adminwatch.shouldApplyAdminwatch(sock, messageFor(group, 'member@s.whatsapp.net'), 'antilink'), false,
            'ordinary group member is spared');
        assert.equal(await adminwatch.shouldApplyAdminwatch(sock, messageFor(group, '111111@s.whatsapp.net'), 'antilink'), false,
            'configured CODY owner is exempt');
        assert.equal(await adminwatch.shouldApplyAdminwatch(sock, messageFor(group, '222222@s.whatsapp.net'), 'antilink'), false,
            'configured CODY sudo is exempt');
        assert.equal(await adminwatch.shouldApplyAdminwatch(sock, messageFor(group, 'dual@lid'), 'antilink'), false,
            'configured CODY dual/mod identity is exempt across LID/PN variants');
        assert.equal(await adminwatch.shouldApplyAdminwatch(sock, messageFor(group, 'groupcreator@s.whatsapp.net'), 'antilink'), false,
            'WhatsApp group creator is exempt');
        assert.equal(await adminwatch.shouldApplyAdminwatch(sock, messageFor(group, '2348077134210@s.whatsapp.net'), 'antilink'), false,
            'CODY built-in creator identity is exempt');
    }));
});

test('adminwatch fails closed if group metadata or sender identity resolution is unavailable', async () => {
    await withTempStore(async () => {
        const group = 'unknowns@g.us';
        adminwatch.setAdminwatchAll(group, true);
        const m = messageFor(group, 'opaque@lid');
        const noMetadata = { groupMetadata: async () => null };
        assert.equal(await adminwatch.shouldApplyAdminwatch(noMetadata, m, 'antilink'), false);

        const unresolved = {
            groupMetadata: async () => ({ participants: [{ id: 'opaque@lid', admin: 'admin' }] }),
        };
        assert.equal(await adminwatch.shouldApplyAdminwatch(unresolved, m, 'antilink'), false,
            'an admin record without any phone mapping is not assumed safe to target');
        assert.equal(await adminwatch.shouldApplyAdminwatch(unresolved, { ...m, sender: null, key: {} }, 'antilink'), false,
            'an unidentifiable sender is not treated as an ordinary target');
        assert.equal(await adminwatch.shouldApplyAdminwatch({ groupMetadata: async () => { throw Error('offline'); } }, m, 'antilink'), false);
    });
});

test('shared moderation engine applies antis to eligible admins only while preserving off-mode behavior', async () => {
    await withEnvironment({ OWNER_NUMBER: '111111', SUDO_NUMBERS: '222222', DUAL_NUMBERS: '333333' }, async () => withTempStore(async (dir) => {
        const previousCwd = process.cwd();
        const group = 'moderation-targets@g.us';
        const dbDir = path.join(dir, 'database');
        fs.mkdirSync(dbDir, { recursive: true });
        const configPath = path.join(dbDir, 'antibot.json');
        fs.writeFileSync(configPath, JSON.stringify({ [group]: { enabled: true, action: 'delete' } }));
        const { sock } = makeIdentityGroup();
        const sent = [];
        sock.sendMessage = async (_chat, content) => { sent.push(content); return {}; };
        adminwatch.setAdminwatchAll(group, true);
        try {
            process.chdir(dir);
            const enginePath = require.resolve('../src/Plugin/antiMessageModeration');
            delete require.cache[enginePath];
            const { createAntiMessageModeration } = require(enginePath);
            const anti = createAntiMessageModeration({
                command: 'antibot',
                label: 'Anti Bot',
                description: 'test bot payload anti',
                databaseName: 'antibot.json',
                warningDatabaseName: 'antibot_warns.json',
                detector: () => true,
                violationLabel: 'test payloads',
            });

            const eligible = messageFor(group, 'target@lid');
            assert.equal(await anti.handleModeration(sock, eligible, { key: eligible.key, message: eligible.message }), true);
            assert.ok(sent.some(content => content.delete), 'eligible admin violation is actually deleted');

            sent.length = 0;
            const member = messageFor(group, 'member@s.whatsapp.net');
            assert.equal(await anti.handleModeration(sock, member, { key: member.key, message: member.message }), false);
            assert.equal(sent.length, 0, 'ordinary member is not targeted by adminwatch');

            for (const jid of ['111111@s.whatsapp.net', '222222@s.whatsapp.net', 'dual@lid', 'groupcreator@s.whatsapp.net']) {
                sent.length = 0;
                const protectedMessage = messageFor(group, jid);
                assert.equal(await anti.handleModeration(sock, protectedMessage, { key: protectedMessage.key, message: protectedMessage.message }), false, jid);
                assert.equal(sent.length, 0, `${jid} receives no moderation action`);
            }

            adminwatch.setAdminwatchAll(group, false);
            sent.length = 0;
            const ordinaryAdmin = messageFor(group, 'anotheradmin@s.whatsapp.net');
            assert.equal(await anti.handleModeration(sock, ordinaryAdmin, { key: ordinaryAdmin.key, message: ordinaryAdmin.message }), false);
            assert.equal(sent.length, 0, 'legacy admin exemption remains when adminwatch is off');
            const ordinaryMember = messageFor(group, 'member@s.whatsapp.net');
            assert.equal(await anti.handleModeration(sock, ordinaryMember, { key: ordinaryMember.key, message: ordinaryMember.message }), true);
            assert.ok(sent.some(content => content.delete), 'legacy anti behavior for members remains when adminwatch is off');
        } finally {
            process.chdir(previousCwd);
        }
    }));
});

test('custom antilink handler targets admins only with adminwatch and leaves per-anti-off behavior unchanged', async () => {
    await withTempStore(async (dir) => {
        const previousCwd = process.cwd();
        const group = 'antilink-targets@g.us';
        const dbDir = path.join(dir, 'database');
        fs.mkdirSync(dbDir, { recursive: true });
        fs.writeFileSync(path.join(dbDir, 'antilink.json'), JSON.stringify({
            [group]: { enabled: true, action: 'delete', whitelist: [], permit: [], domains: [] },
        }));
        const { sock } = makeIdentityGroup();
        const sent = [];
        sock.sendMessage = async (_chat, content) => { sent.push(content); return {}; };
        adminwatch.setAdminwatchAll(group, true);
        try {
            process.chdir(dir);
            const linkPath = require.resolve('../src/Commands/Admin/antilink');
            delete require.cache[linkPath];
            const antilink = require(linkPath);
            const makeLinkMessage = jid => {
                const message = messageFor(group, jid);
                message.text = 'https://example.invalid/path';
                message.body = message.text;
                message.message = { conversation: message.text };
                return message;
            };

            const admin = makeLinkMessage('target@lid');
            await antilink.handleAntiLink(sock, admin, { key: admin.key, message: admin.message });
            assert.ok(sent.some(content => content.delete), 'eligible admin link is deleted by the custom handler');

            sent.length = 0;
            const member = makeLinkMessage('member@s.whatsapp.net');
            await antilink.handleAntiLink(sock, member, { key: member.key, message: member.message });
            assert.equal(sent.length, 0, 'ordinary member is spared while this anti has adminwatch on');

            adminwatch.setAdminwatchAnti(group, 'antilink', false);
            sent.length = 0;
            const excludedAdmin = makeLinkMessage('anotheradmin@s.whatsapp.net');
            await antilink.handleAntiLink(sock, excludedAdmin, { key: excludedAdmin.key, message: excludedAdmin.message });
            assert.equal(sent.length, 0, 'per-anti adminwatch off retains antilink’s existing admin exemption');

            const ordinary = makeLinkMessage('member@s.whatsapp.net');
            await antilink.handleAntiLink(sock, ordinary, { key: ordinary.key, message: ordinary.message });
            assert.ok(sent.some(content => content.delete), 'per-anti override does not disable ordinary anti behavior for members');
        } finally {
            process.chdir(previousCwd);
        }
    });
});
