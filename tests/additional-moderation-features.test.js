'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-additional-moderation-'));
process.chdir(tempDir);

const antiraid = require(path.join(originalCwd, 'src/Commands/Admin/antiraid.js'));
const antilocation = require(path.join(originalCwd, 'src/Commands/Admin/antilocation.js'));
const anticontact = require(path.join(originalCwd, 'src/Commands/Admin/anticontact.js'));
const slowmode = require(path.join(originalCwd, 'src/Commands/Admin/slowmode.js'));
const modlog = require(path.join(originalCwd, 'src/Commands/Admin/modlog.js'));
const modLogApi = require(path.join(originalCwd, 'src/Plugin/modLog.js'));
const { hasMessageType } = require(path.join(originalCwd, 'src/Plugin/mediaAnti.js'));
const GROUP = '120363000000000000@g.us';
const USER = '15550001@s.whatsapp.net';
const BOT = '15559999@s.whatsapp.net';
function writeConfig(file, config) {
    fs.mkdirSync(path.join(tempDir, 'database'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'database', file), JSON.stringify({ [GROUP]: config }, null, 2));
}
function makeSocket({ metadata = {}, joinApprovalMode = async () => {} } = {}) {
    const sent = [];
    const approvals = [];
    return {
        sent,
        approvals,
        user: { id: BOT },
        groupMetadata: async () => ({ participants: [
            { id: USER, admin: null },
            { id: BOT, admin: 'admin' },
        ], joinApprovalMode, ...metadata }),
        groupJoinApprovalMode: async (group, mode) => approvals.push({ group, mode }),
        sendMessage: async (...args) => { sent.push(args); return {}; },
    };
}

test.after(() => {
    antiraid.stopTimers();
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('antilocation and anticontact identify supported WhatsApp message types', () => {
    assert.equal(antilocation.LOCATION_TYPES.some(type => hasMessageType({ liveLocationMessage: {} }, type)), true);
    assert.equal(antilocation.LOCATION_TYPES.some(type => hasMessageType({ venueMessage: {} }, type)), true);
    assert.equal(anticontact.CONTACT_TYPES.some(type => hasMessageType({ contactsArrayMessage: {} }, type)), true);
    assert.equal(anticontact.CONTACT_TYPES.some(type => hasMessageType({ conversation: 'hi' }, type)), false);
});

test('location moderation writes only a rule/action audit event when modlog is enabled', async () => {
    writeConfig('antilocation.json', { enabled: true, action: 'delete' });
    writeConfig('modlog.json', { enabled: true, retentionDays: 30, entries: [] });
    const socket = makeSocket();
    const key = { id: 'location-1', remoteJid: GROUP, participant: USER, fromMe: false };
    const content = { locationMessage: { degreesLatitude: 1, degreesLongitude: 2, name: 'private place' } };
    const m = { isGroup: true, chat: GROUP, sender: USER, key, message: content, msg: content.locationMessage };
    assert.equal(await antilocation.handleModeration(socket, m, { key, message: content }), true);
    const event = modLogApi.readDB()[GROUP].entries.at(-1);
    assert.equal(event.command, 'antilocation');
    assert.equal(event.action, 'delete');
    assert.equal(event.target, USER);
    assert.equal(JSON.stringify(event).includes('private place'), false);
});

test('antiraid parses thresholds, detects join bursts, and enables timed join approval', async () => {
    assert.deepEqual(antiraid.parseThreshold('5/10m'), { count: 5, windowMs: 600_000 });
    assert.equal(antiraid.parseThreshold('1/10m'), null);
    writeConfig('antiraid.json', {
        enabled: true, threshold: 3, windowMs: 600_000, cooldownMs: 1_800_000,
        action: 'approval', recentJoins: [], cooldownUntil: 0,
    });
    const socket = makeSocket({ metadata: { joinApprovalMode: false } });
    assert.equal(await antiraid.handleParticipantUpdate(socket, { id: GROUP, action: 'add', participants: [USER, '15550002@s.whatsapp.net'] }), false);
    assert.equal(socket.approvals.length, 0);
    assert.equal(await antiraid.handleParticipantUpdate(socket, { id: GROUP, action: 'add', participants: ['15550003@s.whatsapp.net'] }), true);
    assert.deepEqual(socket.approvals, [{ group: GROUP, mode: 'on' }]);
    assert.ok(socket.sent.some(([, content]) => /join approval is temporarily enabled/i.test(content.text || '')));
});

test('antiraid leaves already-enabled join approval alone', async () => {
    writeConfig('antiraid.json', {
        enabled: true, threshold: 2, windowMs: 600_000, cooldownMs: 1_800_000,
        action: 'approval', recentJoins: [], cooldownUntil: 0,
    });
    const socket = makeSocket({ metadata: { joinApprovalMode: true } });
    assert.equal(await antiraid.handleParticipantUpdate(socket, { id: GROUP, action: 'add', participants: [USER, '15550002@s.whatsapp.net'] }), true);
    assert.deepEqual(socket.approvals, []);
});

test('manual approval changes cancel antiraid auto-restore state', async () => {
    writeConfig('antiraid.json', {
        enabled: true, threshold: 2, windowMs: 600_000, cooldownMs: 1_800_000,
        action: 'approval', recentJoins: [], cooldownUntil: 0,
    });
    const socket = makeSocket({ metadata: { joinApprovalMode: false } });
    await antiraid.handleParticipantUpdate(socket, { id: GROUP, action: 'add', participants: [USER, '15550002@s.whatsapp.net'] });
    assert.equal(antiraid.cancelApprovalRestore(GROUP), true);
    const state = antiraid.readDB()[GROUP];
    assert.equal(state.approvalChangedByRaid, false);
    assert.equal(state.approvalUntil, 0);
});

test('slowmode parses intervals and deletes a member message sent too soon', async () => {
    assert.equal(slowmode.parseDuration('10s'), 10_000);
    assert.equal(slowmode.parseDuration('2h'), 7_200_000);
    assert.equal(slowmode.parseDuration('0s'), null);
    writeConfig('slowmode.json', { enabled: true, intervalMs: 60_000 });
    const socket = makeSocket();
    const key = { id: 'slow-1', remoteJid: GROUP, participant: USER, fromMe: false };
    const message = { isGroup: true, chat: GROUP, sender: USER, key };
    const envelope = { key, message: { conversation: 'hello' } };
    assert.equal(await slowmode.handleSlowmode(socket, message, envelope), false);
    key.id = 'slow-2';
    assert.equal(await slowmode.handleSlowmode(socket, message, envelope), true);
    assert.ok(socket.sent.some(([, payload]) => payload.delete));
});

test('modlog stores metadata only, enforces cap/retention, and is opt-in', async () => {
    writeConfig('modlog.json', { enabled: false, retentionDays: 30, entries: [] });
    assert.equal(modLogApi.recordAction(GROUP, { command: 'antispam', actor: USER, target: USER, action: 'delete', message: 'private' }), false);
    const db = modLogApi.readDB();
    db[GROUP] = { enabled: true, retentionDays: 30, entries: [] };
    modLogApi.writeDB(db);
    assert.equal(modLogApi.recordAction(GROUP, { command: 'antispam', actor: USER, target: USER, action: 'delete', body: 'private text' }), true);
    const saved = modLogApi.readDB()[GROUP].entries.at(-1);
    assert.equal(saved.action, 'delete');
    assert.equal(Object.hasOwn(saved, 'body'), false);
    assert.equal(Object.hasOwn(saved, 'message'), false);
    assert.equal(modLogApi.isAuditedCommand('antilink'), true);
    assert.equal(modLogApi.isAuditedCommand('modlog'), false);
});

test('modlog recent output is bounded and does not ping logged users', async () => {
    writeConfig('modlog.json', { enabled: true, retentionDays: 30, entries: [{
        timestamp: Date.now(), kind: 'moderation_action', command: 'antilink', action: 'delete', actor: USER, target: USER,
    }] });
    let sent;
    await modlog.execute({ sendMessage: async (...args) => { sent = args; } }, { chat: GROUP }, {
        args: ['recent', '1000'], reply: async () => {}
    });
    assert.match(sent[1].text, /antilink/);
    assert.equal(sent[1].mentions, undefined);
});
