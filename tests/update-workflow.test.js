'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const updatePath = path.resolve(__dirname, '../src/Commands/System/📅.js');
const checkupPath = path.resolve(__dirname, '../src/Commands/Bot/checkupdate.js');
const originalLoad = Module._load;
let activeRun = null;

const axiosMock = {
    async get(url) {
        if (!activeRun) throw new Error('Unexpected network request outside update test');
        activeRun.urls.push(url);
        if (url === 'https://api.github.com/repos/crysnovax/CODY/commits/main') {
            return { data: { sha: activeRun.sha, commit: { message: activeRun.message } } };
        }
        if (url === `https://github.com/crysnovax/CODY/archive/${activeRun.sha}.zip`) {
            return { data: Buffer.from('mock-zip') };
        }
        throw new Error(`Unexpected update URL: ${url}`);
    }
};

class FakeAdmZip {
    constructor(zipPath) {
        assert.equal(fs.readFileSync(zipPath, 'utf8'), 'mock-zip');
    }

    extractAllTo(destination) {
        const root = path.join(destination, `CODY-${activeRun.sha}`);
        fs.mkdirSync(path.join(root, 'src', 'Commands', 'Search'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src', 'Commands', 'Search', 'shazam.js'), 'version from pinned commit');
        fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'CODY-AI' }));
    }
}

const restartCalls = [];
Module._load = function (request, parent, isMain) {
    if ([updatePath, checkupPath].includes(parent?.filename)) {
        if (request === 'axios') return axiosMock;
        if (request === 'adm-zip') return FakeAdmZip;
    }
    if (parent?.filename === updatePath && request === '../../Plugin/uptime') {
        return { markRestart() {} };
    }
    if (parent?.filename === updatePath && request === '../../Plugin/processControl') {
        return { requestRestart: (reason, delayMs) => restartCalls.push({ reason, delayMs }) };
    }
    return originalLoad.call(this, request, parent, isMain);
};

global.prefix = '.';
const updateCommand = require(updatePath);
const checkupCommand = require(checkupPath);

// Keep all updater filesystem operations inside a disposable directory.
test('update pins and reports the exact CODY main commit; checkup compares CODY main', async () => {
    const originalCwd = process.cwd();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-update-test-'));
    const sha = 'a'.repeat(40);
    const message = 'Fix Shazam signature\n\nReport the exact deployed commit.';
    const messages = [];
    restartCalls.length = 0;
    activeRun = { sha, message, urls: [] };
    fs.writeFileSync(path.join(root, '.env'), 'keep=true\n');
    fs.mkdirSync(path.join(root, 'database'), { recursive: true });
    fs.writeFileSync(path.join(root, 'database', 'state.json'), '{"keep":true}');
    process.chdir(root);

    try {
        assert.equal(updateCommand.config.repo, 'crysnovax/CODY');
        assert.equal(updateCommand.config.branch, 'main');
        assert.equal(checkupCommand.config.repo, 'crysnovax/CODY');
        assert.equal(checkupCommand.config.branch, 'main');

        await updateCommand.execute({
            sendMessage: async (_chat, payload) => {
                messages.push(payload);
                return { key: { id: 'progress-message' } };
            }
        }, { chat: 'test-chat' }, { reply: async () => {} });

        assert.deepEqual(activeRun.urls, [
            'https://api.github.com/repos/crysnovax/CODY/commits/main',
            `https://github.com/crysnovax/CODY/archive/${sha}.zip`
        ]);
        assert.equal(fs.readFileSync(path.join(root, 'src', 'Commands', 'Search', 'shazam.js'), 'utf8'), 'version from pinned commit');
        assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), 'keep=true\n');
        assert.equal(fs.readFileSync(path.join(root, 'database', 'state.json'), 'utf8'), '{"keep":true}');

        const finalEdit = messages.filter(payload => payload.edit).at(-1);
        assert.match(finalEdit.text, /Update applied/);
        assert.ok(finalEdit.text.includes(sha.slice(0, 12)));
        assert.ok(finalEdit.text.includes('Fix Shazam signature'));
        assert.ok(finalEdit.text.includes('Report the exact deployed commit.'));
        assert.deepEqual(restartCalls, [{ reason: 'update', delayMs: 1000 }]);
    } finally {
        process.chdir(originalCwd);
        fs.rmSync(root, { recursive: true, force: true });
        activeRun = null;
    }
});
