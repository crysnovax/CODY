const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');

const originalLoad = Module._load;
let viewValue = false;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '../../Plugin/configManager' && parent?.filename?.endsWith('/src/Commands/Owner/statusview.js')) {
        return {
            getVar: (_key, fallback) => viewValue ?? fallback,
            setVar: (_key, value) => { viewValue = value; }
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const statusview = require('../src/Commands/Owner/statusview.js');
Module._load = originalLoad;

test('statusview command uses the dispatched command name when message.body is absent', async () => {
    const replies = [];
    const reactions = [];
    viewValue = false;
    await statusview.execute(
        { sendMessage: async (_chat, payload) => reactions.push(payload) },
        { chat: 'owner@s.whatsapp.net', key: { id: 'm1' } },
        { command: 'statuslike', args: ['on'], reply: async text => replies.push(text) }
    );
    assert.equal(viewValue, true);
    assert.match(replies[0], /Status Like.*ON/i);
    assert.equal(reactions[0].react.text, '✓');
});

test('statusview aliases report their setting when called without an on/off argument', async () => {
    const replies = [];
    viewValue = false;
    await statusview.execute({}, { text: '.statusview' }, {
        command: 'statusview', args: [], reply: async text => replies.push(text)
    });
    assert.match(replies[0], /Status View.*OFF/i);
});

test('readstatus and viewstatus alias the auto-view toggle; likestatus aliases auto-like', async () => {
    const replies = [];
    assert.ok(statusview.alias.includes('readstatus'));
    assert.ok(statusview.alias.includes('viewstatus'));
    assert.ok(statusview.alias.includes('likestatus'));

    viewValue = false;
    const sock = { sendMessage: async () => {} };
    await statusview.execute(sock, { chat: 'owner@s.whatsapp.net' }, {
        command: 'readstatus', args: ['on'], reply: async text => replies.push(text)
    });
    assert.equal(viewValue, true);
    assert.match(replies[0], /Status View.*ON/i);

    await statusview.execute(sock, { chat: 'owner@s.whatsapp.net' }, {
        command: 'viewstatus', args: ['off'], reply: async text => replies.push(text)
    });
    assert.equal(viewValue, false);
    assert.match(replies[1], /Status View.*OFF/i);

    viewValue = true;
    await statusview.execute(sock, { chat: 'owner@s.whatsapp.net' }, {
        command: 'likestatus', args: ['off'], reply: async text => replies.push(text)
    });
    assert.equal(viewValue, false);
    assert.match(replies[2], /Status Like.*OFF/i);
});

test('ass mode accepts dm/chat/number and replies with the selected mode', async t => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-ass-test-'));
    const previousCwd = process.cwd();
    process.chdir(tempDir);
    let autosave;
    try {
        const commandPath = require.resolve('../src/Commands/Owner/ass.js');
        delete require.cache[commandPath];
        autosave = require(commandPath);
        t.after(() => {
            delete require.cache[commandPath];
            process.chdir(previousCwd);
            fs.rmSync(tempDir, { recursive: true, force: true });
        });
    } catch (error) {
        process.chdir(previousCwd);
        fs.rmSync(tempDir, { recursive: true, force: true });
        throw error;
    }

    const replies = [];
    await autosave.execute({}, {}, { args: ['mode', 'number'], reply: async text => replies.push(text) });
    assert.equal(autosave.getConfig().mode, 'number');
    assert.match(replies[0], /Mode set to: \*NUMBER\*/);
    assert.equal(autosave.ownerOnly, true);
});
