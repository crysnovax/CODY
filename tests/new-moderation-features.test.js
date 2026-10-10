'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-new-moderation-'));
process.chdir(tempDir);

const antivoice = require(path.join(originalCwd, 'src/Commands/Admin/antivoice.js'));
const antidoc = require(path.join(originalCwd, 'src/Commands/Admin/antidoc.js'));
const antipoll = require(path.join(originalCwd, 'src/Commands/Admin/antipoll.js'));
const antievent = require(path.join(originalCwd, 'src/Commands/Admin/antievent.js'));
const antinewcomer = require(path.join(originalCwd, 'src/Commands/Admin/antinewcomer.js'));
const GROUP = '120363000000000000@g.us';
const SENDER = '15550001@s.whatsapp.net';
const BOT = '15559999@s.whatsapp.net';

function writeConfig(name, value) {
    const dir = path.join(tempDir, 'database');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), JSON.stringify({ [GROUP]: value }, null, 2));
}
function makeMessage(content, extra = {}) {
    const key = { id: 'MSG1', remoteJid: GROUP, participant: SENDER, fromMe: false };
    return {
        m: { isGroup: true, chat: GROUP, sender: SENDER, key, message: content, msg: Object.values(content)[0], ...extra },
        mek: { key, message: content },
    };
}
function makeSocket() {
    const sent = [];
    return {
        sent,
        user: { id: BOT },
        groupMetadata: async () => ({ participants: [
            { id: SENDER, admin: null },
            { id: BOT, admin: 'admin' },
        ] }),
        sendMessage: async (...args) => { sent.push(args); return {}; },
    };
}

test.after(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('antivoice distinguishes voice notes from regular audio', () => {
    assert.equal(antivoice.hasVoiceNote({ audioMessage: { ptt: true } }), true);
    assert.equal(antivoice.hasVoiceNote({ audioMessage: { ptt: false, mimetype: 'audio/mpeg' } }), false);
    assert.equal(antivoice.hasVoiceNote({ extendedTextMessage: { contextInfo: { quotedMessage: { audioMessage: { ptt: true } } } } }), true);
});

test('antidoc uses strict allow-listing with explicit deny rules', () => {
    const rules = { allowedExtensions: ['pdf'], deniedExtensions: ['apk'] };
    assert.equal(antidoc.shouldBlockDocument({ documentMessage: { fileName: 'guide.PDF', mimetype: 'application/pdf' } }, rules), false);
    assert.equal(antidoc.shouldBlockDocument({ documentMessage: { fileName: 'payload.apk' } }, rules), true);
    assert.equal(antidoc.shouldBlockDocument({ documentMessage: { fileName: 'archive.zip' } }, rules), true);
    assert.equal(antidoc.shouldBlockDocument({ conversation: 'not a document' }, rules), false);
    assert.equal(antidoc.documentExtension({ mimetype: 'application/pdf' }), 'pdf');
});

test('antivoice accepts the requested action subcommand form', async () => {
    let response = '';
    await antivoice.execute({}, { chat: GROUP }, {
        args: ['action', 'warn'],
        reply: async text => { response = text; }
    });
    assert.match(response, /WARN/i);
    const saved = JSON.parse(fs.readFileSync(path.join(tempDir, 'database', 'antivoice.json'), 'utf8'));
    assert.equal(saved[GROUP].action, 'warn');
});

test('antidoc command configures extension exceptions and explicit denials', async () => {
    for (const args of [['allow', 'pdf'], ['deny', 'apk'], ['on']]) {
        await antidoc.execute({}, { chat: GROUP }, { args, reply: async () => {} });
    }
    const saved = JSON.parse(fs.readFileSync(path.join(tempDir, 'database', 'antidoc.json'), 'utf8'));
    assert.equal(saved[GROUP].enabled, true);
    assert.deepEqual(saved[GROUP].allowedExtensions, ['pdf']);
    assert.deepEqual(saved[GROUP].deniedExtensions, ['apk']);
});

test('poll and event detectors target creation messages only', () => {
    assert.equal(antipoll.POLL_TYPES.some(type => require(path.join(originalCwd, 'src/Plugin/mediaAnti')).hasMessageType({ pollCreationMessageV3: {} }, type)), true);
    assert.equal(antievent.EVENT_TYPES.some(type => require(path.join(originalCwd, 'src/Plugin/mediaAnti')).hasMessageType({ eventMessage: {} }, type)), true);
    assert.equal(antipoll.POLL_TYPES.some(type => require(path.join(originalCwd, 'src/Plugin/mediaAnti')).hasMessageType({ pollUpdateMessage: {} }, type)), false);
});

test('antinewcomer duration parsing accepts supported units and bounds invalid values', () => {
    assert.equal(antinewcomer.parseDuration('10m'), 600_000);
    assert.equal(antinewcomer.parseDuration('2h'), 7_200_000);
    assert.equal(antinewcomer.parseDuration('0m'), null);
    assert.equal(antinewcomer.parseDuration('10w'), null);
});

test('antinewcomer links command enables and persists its configured duration', async () => {
    let response = '';
    await antinewcomer.execute({}, { chat: GROUP }, {
        args: ['links', '10m'],
        reply: async text => { response = text; }
    });
    const saved = JSON.parse(fs.readFileSync(path.join(tempDir, 'database', 'antinewcomer.json'), 'utf8'));
    assert.equal(saved[GROUP].enabled, true);
    assert.equal(saved[GROUP].windowMs, 600_000);
    assert.match(response, /10m/);
});

test('antinewcomer stores added members and blocks their links during the window', async () => {
    writeConfig('antinewcomer.json', { enabled: true, windowMs: 600_000, joined: {} });
    antinewcomer.handleParticipantUpdate({ id: GROUP, action: 'add', participants: [SENDER] });
    const saved = JSON.parse(fs.readFileSync(path.join(tempDir, 'database', 'antinewcomer.json'), 'utf8'));
    assert.ok(saved[GROUP].joined[SENDER]);

    const socket = makeSocket();
    const { m, mek } = makeMessage({ extendedTextMessage: { text: 'https://example.com' } }, { text: 'https://example.com' });
    const handled = await antinewcomer.handleAntiNewcomer(socket, m, mek);
    assert.equal(handled, true);
    assert.ok(socket.sent.some(([, content]) => content.delete));
    assert.ok(socket.sent.some(([, content]) => /links are restricted/i.test(content.text || '')));
});

test('antinewcomer ignores ordinary messages and removes join records on leave', async () => {
    writeConfig('antinewcomer.json', { enabled: true, windowMs: 600_000, joined: { [SENDER]: Date.now() } });
    const socket = makeSocket();
    const { m, mek } = makeMessage({ conversation: 'hello' }, { text: 'hello' });
    assert.equal(await antinewcomer.handleAntiNewcomer(socket, m, mek), false);
    antinewcomer.handleParticipantUpdate({ id: GROUP, action: 'remove', participants: [SENDER] });
    const saved = JSON.parse(fs.readFileSync(path.join(tempDir, 'database', 'antinewcomer.json'), 'utf8'));
    assert.equal(saved[GROUP].joined[SENDER], undefined);
});

test('all four shared-engine protections delete violating messages when enabled', async () => {
    const cases = [
        [antivoice, 'antivoice.json', { audioMessage: { ptt: true } }],
        [antidoc, 'antidoc.json', { documentMessage: { fileName: 'blocked.pdf' } }],
        [antipoll, 'antipoll.json', { pollCreationMessageV3: {} }],
        [antievent, 'antievent.json', { eventMessage: {} }],
    ];
    for (const [plugin, file, content] of cases) {
        const config = { enabled: true, action: 'delete' };
        if (file === 'antidoc.json') config.allowedExtensions = [];
        writeConfig(file, config);
        const socket = makeSocket();
        const { m, mek } = makeMessage(content);
        assert.equal(await plugin.handleModeration(socket, m, mek), true, plugin.name);
        assert.ok(socket.sent.some(([, payload]) => payload.delete), plugin.name);
    }
});
