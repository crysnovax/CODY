'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const originalCwd = process.cwd();
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-antigs-'));
process.chdir(temporaryDirectory);
const groupStatus = require(path.join(originalCwd, 'src/Commands/Admin/antigroupstatus.js'));

function writeConfig(action) {
    fs.mkdirSync(path.join(temporaryDirectory, 'database'), { recursive: true });
    fs.writeFileSync(path.join(temporaryDirectory, 'database', 'antigroupstatus.json'), JSON.stringify({
        '123@g.us': { enabled: true, action }
    }));
}

function createSocket() {
    const sent = [];
    const removed = [];
    return {
        sent,
        removed,
        user: { id: '15559999@s.whatsapp.net' },
        groupMetadata: async () => ({
            participants: [
                { id: '15550001@s.whatsapp.net', admin: null },
                { id: '15559999@s.whatsapp.net', admin: 'admin' }
            ]
        }),
        deleteGroupStatus: async () => {
            throw new Error('server rejected group-status revoke');
        },
        sendMessage: async (jid, content, options) => sent.push({ jid, content, options }),
        groupParticipantsUpdate: async (jid, users, action) => removed.push({ jid, users, action })
    };
}

function message() {
    return {
        isGroup: true,
        chat: '123@g.us',
        sender: '15550001@s.whatsapp.net',
        key: { id: 'status-1', remoteJid: '123@g.us', fromMe: false }
    };
}

test.after(() => {
    process.chdir(originalCwd);
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('kick still removes the sender when WhatsApp rejects only the status revoke', async () => {
    writeConfig('kick');
    const socket = createSocket();
    const handled = await groupStatus.handleAntiGroupStatus(socket, message(), {
        key: message().key,
        message: { groupStatusMessageV2: { message: { conversation: 'status' } } }
    });

    assert.equal(handled, true);
    assert.deepEqual(socket.removed, [{
        jid: '123@g.us',
        users: ['15550001@s.whatsapp.net'],
        action: 'remove'
    }]);
    assert.match(socket.sent.at(-1).content.text, /moderation action was still applied/i);
});
