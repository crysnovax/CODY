'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const originalCwd = process.cwd();
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-group-activity-'));
process.chdir(temporaryDirectory);
const activity = require(path.join(repoRoot, 'src/Plugin/groupActivity.js'));
const listInactive = require(path.join(repoRoot, 'src/Commands/Group/listinactive.js'));
const listActive = require(path.join(repoRoot, 'src/Commands/Group/listactive.js'));

test.after(() => {
    process.chdir(originalCwd);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

function groupMessage(group, sender, id, { fromMe = false, message = { conversation: 'hello' }, participantAlt } = {}) {
    const key = { remoteJid: group, participant: sender, id, fromMe, ...(participantAlt ? { participantAlt } : {}) };
    const messageObject = { chat: group, sender, isGroup: true, key, message };
    return { m: messageObject, raw: { key, message } };
}

test('group activity persists counts, ignores self/system messages, and deduplicates message IDs', async () => {
    const group = '100@g.us';
    const sender = '1111111111@s.whatsapp.net';
    let item = groupMessage(group, sender, 'm-1');
    assert.equal(activity.trackGroupMessage(item.m, item.raw), true);
    assert.equal(activity.trackGroupMessage(item.m, item.raw), false);
    item = groupMessage(group, sender, 'm-2');
    activity.trackGroupMessage(item.m, item.raw);
    item = groupMessage(group, sender, 'm-self', { fromMe: true });
    assert.equal(activity.trackGroupMessage(item.m, item.raw), false);
    item = groupMessage(group, sender, 'm-reaction', { message: { reactionMessage: {} } });
    assert.equal(activity.trackGroupMessage(item.m, item.raw), false);

    const participants = [{ id: sender }];
    const counts = await activity.getParticipantCounts({}, group, participants);
    assert.equal(counts[0].count, 2);
    assert.ok(activity.getTrackingStartedAt(group));

    const pluginPath = require.resolve(path.join(repoRoot, 'src/Plugin/groupActivity.js'));
    delete require.cache[pluginPath];
    const reloaded = require(pluginPath);
    const afterReload = await reloaded.getParticipantCounts({}, group, participants);
    assert.equal(afterReload[0].count, 2);
});

test('activity matches a participant phone JID to a stored LID alias', async () => {
    const group = '200@g.us';
    const lid = '412345678@lid';
    const phone = '2348012345678@s.whatsapp.net';
    const item = groupMessage(group, lid, 'lid-msg');
    activity.trackGroupMessage(item.m, item.raw);
    const sock = { signalRepository: { lidMapping: {
        getLIDForPN: async jid => jid === phone ? lid : null,
        getPNForLID: async jid => jid === lid ? phone : null,
    } } };
    const counts = await activity.getParticipantCounts(sock, group, [{ id: phone, phoneNumber: phone }]);
    assert.equal(counts[0].count, 1);
});

test('listinactive and listactive tag the correct users; listactive includes counts', async () => {
    const group = '300@g.us';
    const active = '3333333333@s.whatsapp.net';
    const higher = '5555555555@s.whatsapp.net';
    const inactive = '4444444444@s.whatsapp.net';
    for (const id of ['active-1', 'active-2']) {
        const item = groupMessage(group, active, id);
        activity.trackGroupMessage(item.m, item.raw);
    }
    for (let index = 0; index < 6; index++) {
        const item = groupMessage(group, higher, `higher-${index}`);
        activity.trackGroupMessage(item.m, item.raw);
    }
    const participants = [
        { id: '9999999999@s.whatsapp.net', admin: 'admin' },
        { id: active },
        { id: higher },
        { id: inactive },
    ];
    const sent = [];
    const sock = {
        user: { id: '9999999999@s.whatsapp.net' },
        groupMetadata: async () => ({ subject: 'Test group', participants }),
        sendMessage: async (...args) => sent.push(args),
    };
    const m = { chat: group, isGroup: true, key: { id: 'cmd', remoteJid: group } };
    const reply = async text => { throw new Error(`Unexpected reply: ${text}`); };

    assert.equal(listInactive.groupOnly, true);
    assert.equal(listInactive.adminOnly, true);
    assert.equal(listActive.groupOnly, true);
    assert.equal(listActive.adminOnly, true);
    await listInactive.execute(sock, m, { reply });
    await listActive.execute(sock, m, { reply });

    assert.equal(sent.length, 2);
    assert.deepEqual(sent[0][1].mentions, [inactive]);
    assert.match(sent[0][1].text, /Inactive members/);
    assert.deepEqual(sent[1][1].mentions, [higher, active]);
    assert.match(sent[1][1].text, /@5555555555 — 6 messages\n• @3333333333 — 2 messages/);
});

test('listinactive returns at most 300 members in manageable 25-member chunks', async () => {
    const group = '400@g.us';
    const participants = Array.from({ length: 305 }, (_, index) => ({
        id: `${7000000000 + index}@s.whatsapp.net`,
    }));
    const sent = [];
    const sock = {
        user: { id: '9999999999@s.whatsapp.net' },
        groupMetadata: async () => ({ participants }),
        sendMessage: async (...args) => sent.push(args),
    };
    const m = { chat: group, isGroup: true, key: { id: 'cmd-300', remoteJid: group } };
    const reply = async text => { throw new Error(`Unexpected reply: ${text}`); };

    await listInactive.execute(sock, m, { reply });

    assert.equal(sent.length, 12);
    assert.equal(sent.reduce((sum, [, content]) => sum + content.mentions.length, 0), 300);
    assert.ok(sent.every(([, content]) => content.mentions.length <= 25));
    assert.match(sent[0][1].text, /Inactive members \(300 of 305\/305\)/);
});
