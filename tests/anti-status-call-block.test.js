'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const repoRoot = path.resolve(__dirname, '..');
const originalCwd = process.cwd();
const originalOwner = process.env.OWNER_NUMBER;
const originalAntideleteDb = process.env.CODY_ANTIDELETE_DB;
const originalLoad = Module._load;
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-status-call-block-'));
process.chdir(temporaryDirectory);
process.env.OWNER_NUMBER = '15550000000';
process.env.CODY_ANTIDELETE_DB = path.join(temporaryDirectory, 'database', 'antidelete.json');
Module._load = function(request, parent, isMain) {
    if (request === 'plogme') return { downloadContentFromMessage: async () => ({ async *[Symbol.asyncIterator]() {} }) };
    return originalLoad.call(this, request, parent, isMain);
};
const statusCommand = require(path.join(repoRoot, 'src/Commands/Tools/antideletestatus.js'));
const antiDelete = require(path.join(repoRoot, 'src/Commands/Tools/antidelete.js'));
const antiCall = require(path.join(repoRoot, 'src/Commands/Owner/anticall.js'));
Module._load = originalLoad;

function replies() {
    const output = [];
    return { output, reply: async text => output.push(String(text)) };
}

test.after(() => {
    process.chdir(originalCwd);
    if (originalOwner === undefined) delete process.env.OWNER_NUMBER;
    else process.env.OWNER_NUMBER = originalOwner;
    if (originalAntideleteDb === undefined) delete process.env.CODY_ANTIDELETE_DB;
    else process.env.CODY_ANTIDELETE_DB = originalAntideleteDb;
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('antideletestatus is owner-only and toggles the standalone status setting', async () => {
    assert.equal(statusCommand.name, 'antideletestatus');
    assert.equal(statusCommand.ownerOnly, true);
    let result = replies();
    await statusCommand.execute({}, {}, { args: ['on'], reply: result.reply });
    assert.equal(JSON.parse(fs.readFileSync(process.env.CODY_ANTIDELETE_DB, 'utf8'))._status, true);

    result = replies();
    await statusCommand.execute({}, {}, { args: ['status'], reply: result.reply });
    assert.match(result.output[0], /ON/);

    await statusCommand.execute({}, {}, { args: ['off'], reply: async () => {} });
    assert.equal(JSON.parse(fs.readFileSync(process.env.CODY_ANTIDELETE_DB, 'utf8'))._status, false);
});

test('enabled antideletestatus forwards a revoked cached Status privately to the owner', async () => {
    await statusCommand.execute({}, {}, { args: ['on'], reply: async () => {} });
    const remoteJid = 'status@broadcast';
    const key = { remoteJid, id: 'status-1', participant: '2348012345678@s.whatsapp.net' };
    antiDelete.cacheMessage({
        key,
        message: { groupStatusMessageV2: { message: { conversation: 'status message before deletion' } } },
        messageTimestamp: Math.floor(Date.now() / 1000),
        pushName: 'Status poster',
    });
    const sent = [];
    const sock = {
        user: { id: '15550000000@s.whatsapp.net' },
        sendMessage: async (jid, content) => sent.push({ jid, content }),
        groupMetadata: async () => ({ subject: 'ignored' }),
    };
    await antiDelete.onDelete(sock, [{ key, update: { message: null, messageStubType: 1 } }], null);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].jid, '15550000000@s.whatsapp.net');
    assert.match(sent[0].content.text, /status message before deletion/);
});

test('anticall block shorthand adds, lists, and removes formatted international phone numbers', async () => {
    assert.equal(antiCall.ownerOnly, true);
    let result = replies();
    await antiCall.execute({}, {}, { args: ['block', '+1 (555) 123-4567'], reply: result.reply });
    let config = JSON.parse(fs.readFileSync(path.join(temporaryDirectory, 'database', 'anticall.json'), 'utf8'));
    assert.ok(config.blacklist.includes('15551234567@s.whatsapp.net'));
    assert.ok(config.pendingPhoneReject.includes('15551234567'));

    result = replies();
    await antiCall.execute({}, {}, { args: ['block', 'list'], reply: result.reply });
    assert.match(result.output[0], /15551234567/);

    await antiCall.execute({}, {}, { args: ['block', 'remove', '+1 (555) 123-4567'], reply: async () => {} });
    config = JSON.parse(fs.readFileSync(path.join(temporaryDirectory, 'database', 'anticall.json'), 'utf8'));
    assert.ok(!config.blacklist.includes('15551234567@s.whatsapp.net'));
    assert.ok(!config.pendingPhoneReject.includes('15551234567'));
});

test('anticall block remove clears mapped PN/LID aliases for the same account', async () => {
    const configPath = path.join(temporaryDirectory, 'database', 'anticall.json');
    fs.writeFileSync(configPath, JSON.stringify({
        blacklist: ['987654321@lid', '15551234567@s.whatsapp.net'],
        whitelist: [],
        pendingPhoneReject: ['15551234567'],
        schedule: { enabled: false },
    }));
    const sock = { signalRepository: { lidMapping: {
        getPNForLID: async jid => jid === '987654321@lid' ? '15551234567@s.whatsapp.net' : null,
        getLIDForPN: async jid => jid === '15551234567@s.whatsapp.net' ? '987654321@lid' : null,
    } } };
    await antiCall.execute(sock, {}, { args: ['block', 'remove', '+1 (555) 123-4567'], reply: async () => {} });
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.deepEqual(config.blacklist, []);
    assert.deepEqual(config.pendingPhoneReject, []);
});
