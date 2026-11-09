const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const previousCwd = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-status-shortcuts-'));
fs.mkdirSync(path.join(tempRoot, 'database'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'database', 'sscmd.json'), JSON.stringify({ 'owner@s.whatsapp.net': '⭐' }));
process.chdir(tempRoot);
const asCommand = require('../src/Commands/Owner/as.js');
const sscmd = require('../src/Commands/Owner/⎔.js');
process.chdir(previousCwd);

test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

test('.as is registered as a shortcut and delegates to savestatus', async () => {
    const saveStatus = require('../src/Commands/Owner/savestatus.js');
    const originalExecute = saveStatus.execute;
    const args = [{ sendMessage: async () => {} }, { chat: 'chat@s.whatsapp.net' }, { args: [], reply: async () => {} }];
    let delegated;
    try {
        saveStatus.execute = async (...received) => { delegated = received; };
        await asCommand.execute(...args);
    } finally {
        saveStatus.execute = originalExecute;
    }
    assert.equal(asCommand.name, 'as');
    assert.deepEqual(delegated, args);
});

test('sscmd downloads quoted status media through Baileys downloadStatus', async () => {
    const calls = { downloads: [], sent: [] };
    const quoted = {
        mtype: 'imageMessage',
        caption: 'status caption',
        download: async () => { throw new Error('legacy downloader should not run'); }
    };
    const sock = {
        downloadStatus: async (...args) => {
            calls.downloads.push(args);
            return Buffer.from('status-image');
        },
        sendMessage: async (...args) => { calls.sent.push(args); }
    };
    const message = {
        sender: 'owner@s.whatsapp.net',
        chat: 'owner@s.whatsapp.net',
        key: { id: 'trigger-1' },
        message: { conversation: '⭐' },
        quoted
    };

    await sscmd.handleSSReply(sock, message);

    assert.deepEqual(calls.downloads, [[quoted, 'buffer']]);
    const saved = calls.sent.find(([jid, content]) => jid === 'owner@s.whatsapp.net' && content.image);
    assert.ok(saved);
    assert.equal(saved[1].caption, 'status caption');
    assert.equal(saved[1].image.toString(), 'status-image');
    assert.deepEqual(calls.sent.at(-1)[1], { delete: message.key });
});
