const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { _test } = require('../src/Commands/System/redeploy');
const { safeDatabaseName } = require('../src/Plugin/redeployRecovery');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'cody-redeploy-'));
}

test('redeploy only accepts a pairing-site/deployment bootstrap', () => {
    const parent = tempDir();
    const bot = path.join(parent, 'bot');
    fs.mkdirSync(bot);
    fs.writeFileSync(path.join(parent, 'index.js'), "const BOT_DIR = path.join(__dirname, 'bot'); // CODY_PAIR bootstrap\n");
    assert.equal(_test.findBootstrap(bot), path.join(parent, 'index.js'));
    fs.rmSync(parent, { recursive: true, force: true });
});

test('redeploy cleanup removes the bot checkout but never the outer bootstrap', () => {
    const parent = tempDir();
    const bot = path.join(parent, 'bot');
    const bootstrap = path.join(parent, 'index.js');
    fs.mkdirSync(bot);
    fs.writeFileSync(bootstrap, 'bootstrap');
    fs.writeFileSync(path.join(bot, 'old-file.txt'), 'remove me');
    _test.removeBotCheckout(bot, bootstrap);
    assert.equal(fs.existsSync(path.join(bot, 'old-file.txt')), false);
    assert.equal(fs.readFileSync(bootstrap, 'utf8'), 'bootstrap');
    fs.rmSync(parent, { recursive: true, force: true });
});

test('recovery accepts only flat JSON database filenames', () => {
    assert.equal(safeDatabaseName('settings.json'), true);
    assert.equal(safeDatabaseName('../.env'), false);
    assert.equal(safeDatabaseName('nested/file.json'), false);
    assert.equal(safeDatabaseName('settings.txt'), false);
});
