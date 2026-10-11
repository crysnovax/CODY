'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const originalCwd = process.cwd();
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-anticall-reason-'));
process.chdir(temporaryDirectory);
const manager = require(path.join(repoRoot, 'src/Plugin/anticallManager.js'));
const anticallCommand = require(path.join(repoRoot, 'src/Commands/Owner/anticall.js'));
const phone = '2348012345678@s.whatsapp.net';
const lid = '987654321@lid';

function mappedSocket() {
    const sent = [];
    const rejected = [];
    return {
        sent,
        rejected,
        signalRepository: { lidMapping: {
            getPNForLID: async jid => jid === lid ? phone : null,
            getLIDForPN: async jid => jid === phone ? lid : null,
        } },
        rejectCall: async (id, jid) => rejected.push({ id, jid }),
        sendMessage: async (jid, content) => sent.push({ jid, content }),
    };
}

function config(overrides = {}) {
    return {
        ...manager.defaultConfig,
        ...overrides,
        schedule: { ...manager.defaultConfig.schedule, ...(overrides.schedule || {}) },
        blacklist: [...(overrides.blacklist || [])],
        whitelist: [...(overrides.whitelist || [])],
        pendingPhoneReject: [...(overrides.pendingPhoneReject || [])],
    };
}

test.after(() => {
    process.chdir(originalCwd);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('anticall reason command saves the full custom rejection text', async () => {
    assert.equal(anticallCommand.ownerOnly, true);
    const replies = [];
    await anticallCommand.execute({}, {}, {
        args: ['reason', 'Please', 'do', 'not', 'call'],
        reply: async text => replies.push(text),
    });
    assert.equal(manager.loadConfig().reason, 'Please do not call');
    assert.match(replies[0], /Please do not call/);
});

test('a blacklisted phone/LID match gets the configured reason even when unknown blocking is off', async () => {
    const sock = mappedSocket();
    const cfg = config({ enabled: false, reason: 'Known blocked caller', unknownReason: 'Unknown caller', blacklist: [lid] });
    const result = await manager.handleIncomingCall(sock, { status: 'offer', id: 'known-1', from: phone }, cfg);
    assert.equal(result.blocked, true);
    assert.equal(result.unknown, false);
    assert.deepEqual(sock.rejected, [{ id: 'known-1', jid: phone }]);
    assert.deepEqual(sock.sent, [{ jid: phone, content: { text: 'Known blocked caller' } }]);
});

test('pending phone rejection is upgraded and uses the configured blocked reason, not unknownReason', async () => {
    const sock = mappedSocket();
    const phoneNumber = phone.split('@')[0];
    const cfg = config({
        enabled: false,
        reason: 'Number is blocked',
        unknownReason: 'Unknown caller text',
        pendingPhoneReject: [phoneNumber],
    });
    const result = await manager.handleIncomingCall(sock, { status: 'offer', id: 'pending-1', from: lid }, cfg);
    assert.equal(result.blocked, true);
    assert.equal(result.unknown, false);
    assert.equal(cfg.pendingPhoneReject.length, 0);
    assert.ok(cfg.blacklist.includes(phone));
    assert.equal(sock.sent[0].content.text, 'Number is blocked');
});

test('unknown callers receive unknownReason while whitelist identity variants are allowed', async () => {
    const sock = mappedSocket();
    const unknown = await manager.handleIncomingCall(sock, { status: 'offer', id: 'unknown-1', from: phone }, config({
        enabled: true,
        reason: 'Known reason',
        unknownReason: 'Unknown reason',
    }));
    assert.equal(unknown.unknown, true);
    assert.equal(sock.sent[0].content.text, 'Unknown reason');

    const whitelistSock = mappedSocket();
    const allowed = await manager.handleIncomingCall(whitelistSock, { status: 'offer', id: 'white-1', from: phone }, config({
        enabled: true,
        whitelist: [lid],
    }));
    assert.equal(allowed.blocked, false);
    assert.equal(allowed.whitelisted, true);
    assert.deepEqual(whitelistSock.rejected, []);
    assert.deepEqual(whitelistSock.sent, []);
});
