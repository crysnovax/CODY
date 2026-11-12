const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const previousCwd = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-acs-command-'));
process.chdir(tempRoot);
const acs = require('../src/Commands/Owner/acs.js');
process.chdir(previousCwd);

test.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
test.beforeEach(() => fs.rmSync(path.join(tempRoot, 'database'), { recursive: true, force: true }));

function readConfig() {
    return JSON.parse(fs.readFileSync(path.join(tempRoot, 'database', 'autocommentstatus.json'), 'utf8'));
}

test('acs defaults to an enabled green-heart comment on a clean installation', async () => {
    const replies = [];
    await acs.execute({}, {}, { args: ['status'], reply: async text => replies.push(text) });
    assert.match(replies[0], /Enabled: \*ON\*/);
    assert.match(replies[0], /Comment: “💚”/);
    assert.equal(fs.existsSync(path.join(tempRoot, 'database', 'autocommentstatus.json')), false);
});

test('acs enables and persists its default green-heart comment', async () => {
    const replies = [];
    await acs.execute({}, {}, { args: ['on'], reply: async text => replies.push(text) });
    assert.deepEqual(readConfig(), { enabled: true, mode: 'text', text: '💚' });
    assert.match(replies[0], /Auto Comment Status is ON/);
});

test('acs stores text while the default feature is enabled', async () => {
    const replies = [];
    await acs.execute({}, {}, { args: ['text', 'Great update!'], reply: async text => replies.push(text) });
    assert.deepEqual(readConfig(), { enabled: true, mode: 'text', text: 'Great update!' });
    assert.match(replies[0], /Auto-comment is ON/);
});

test('acs preserves an explicitly saved OFF choice when the comment changes', async () => {
    const replies = [];
    fs.mkdirSync(path.join(tempRoot, 'database'), { recursive: true });
    fs.writeFileSync(
        path.join(tempRoot, 'database', 'autocommentstatus.json'),
        JSON.stringify({ enabled: false, mode: 'text', text: 'Earlier comment' })
    );
    await acs.execute({}, {}, { args: ['text', 'Updated comment'], reply: async text => replies.push(text) });
    assert.deepEqual(readConfig(), { enabled: false, mode: 'text', text: 'Updated comment' });
    assert.match(replies[0], /Run `.acs on`/);
});

test('acs saves a replied-to sticker as an active automatic comment template by default', async () => {
    const replies = [];
    const sticker = Buffer.from('webp-sticker-fixture');
    const message = {
        quoted: {
            mtype: 'stickerMessage',
            message: { stickerMessage: { mimetype: 'image/webp' } },
            download: async () => sticker
        }
    };
    await acs.execute({}, message, { args: ['sticker'], reply: async text => replies.push(text) });
    assert.deepEqual(readConfig(), { enabled: true, mode: 'sticker', text: '' });
    assert.deepEqual(fs.readFileSync(path.join(tempRoot, 'database', 'autocommentstatus-sticker.webp')), sticker);
    assert.match(replies[0], /Auto-comment is ON/);
});

test('acs clear removes the sticker and disables the feature', async () => {
    const replies = [];
    fs.mkdirSync(path.join(tempRoot, 'database'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'database', 'autocommentstatus-sticker.webp'), Buffer.from('sticker'));
    await acs.execute({}, {}, { args: ['clear'], reply: async text => replies.push(text) });
    assert.deepEqual(readConfig(), { enabled: false, mode: 'text', text: '' });
    assert.equal(fs.existsSync(path.join(tempRoot, 'database', 'autocommentstatus-sticker.webp')), false);
    assert.match(replies[0], /cleared/);
});
