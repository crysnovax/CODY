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

test('acs stores text then enables automatic status comments', async () => {
    const replies = [];
    await acs.execute({}, {}, { args: ['text', 'Great update!'], reply: async text => replies.push(text) });
    await acs.execute({}, {}, { args: ['on'], reply: async text => replies.push(text) });
    assert.deepEqual(readConfig(), { enabled: true, mode: 'text', text: 'Great update!' });
    assert.match(replies.at(-1), /Auto Comment Status is ON/);
});

test('acs saves a replied-to sticker as the automatic comment template', async () => {
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
    assert.deepEqual(readConfig(), { enabled: false, mode: 'sticker', text: '' });
    assert.deepEqual(fs.readFileSync(path.join(tempRoot, 'database', 'autocommentstatus-sticker.webp')), sticker);
    assert.match(replies[0], /Sticker comment saved/);
});

test('acs will not enable without a configured comment payload', async () => {
    const replies = [];
    await acs.execute({}, {}, { args: ['on'], reply: async text => replies.push(text) });
    assert.equal(fs.existsSync(path.join(tempRoot, 'database', 'autocommentstatus.json')), false);
    assert.match(replies[0], /Set a comment first/);
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
