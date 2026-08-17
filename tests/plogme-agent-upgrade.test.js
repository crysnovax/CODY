const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const missions = require('../src/Commands/Core/plogme-missions.js');
const dependencies = require('../src/Commands/Core/plogme-dependencies.js');
const { runHealthChecks } = require('../src/Commands/Core/plogme-health.js');
const { buildProjectIndex } = require('../src/Commands/Core/plogme-project-index.js');
const plogme = require('../src/Commands/Core/plogme.js');

const transient = [missions.STORE_FILE, path.join(process.cwd(), 'database', 'plogme_project_index.json')];

test.after(() => {
    for (const file of transient) { try { fs.unlinkSync(file); } catch {} }
});

test('mission store persists steps, events, snapshots, and rollback', () => {
    const target = path.join('database', 'plogme-agent-test.txt');
    const absolute = path.join(process.cwd(), target);
    fs.writeFileSync(absolute, 'before');
    const mission = missions.createMission({ objective: 'test rollback', plan: ['edit', 'verify'] });
    missions.setStep(mission.id, 1, 'running', 'Editing test file');
    const snapshot = missions.snapshotFiles(mission.id, [target]);
    fs.writeFileSync(absolute, 'after');
    const result = missions.rollbackMission(mission.id, snapshot.id);
    assert.equal(result.ok, true);
    assert.equal(fs.readFileSync(absolute, 'utf8'), 'before');
    assert.equal(missions.getMission(mission.id).status, 'running');
    try { fs.unlinkSync(absolute); } catch {}
});

test('dependency manager rejects shell-injection package specs', () => {
    assert.equal(dependencies.packageSpec('sharp'), 'sharp');
    assert.equal(dependencies.packageSpec('@scope/pkg@1.2.3'), '@scope/pkg@1.2.3');
    assert.equal(dependencies.packageSpec('x && rm -rf /'), null);
    assert.equal(dependencies.packageSpec('../evil'), null);
    assert.equal(dependencies.localStatus('definitely-not-installed-plogme-package').ok, true);
});

test('project index and health checks expose actionable state', () => {
    const index = buildProjectIndex();
    assert.ok(index.commandCount > 0);
    assert.ok(Array.isArray(index.commands));
    const health = runHealthChecks();
    assert.ok(Array.isArray(health.checks));
    assert.ok(health.checks.some(item => item.name === 'runtime'));
});

test('PLOGME executes mission and health actions with structured replies', async () => {
    const replies = [];
    const sock = { sendMessage: async () => ({ key: { id: 'reply-1' } }) };
    const opts = { reply: async value => replies.push(String(value)) };
    const missionResult = await plogme.executeIntent(sock, { chat: '12345@s.whatsapp.net' }, opts, {
        action: 'mission_create', objective: 'verify agent tools', plan: ['inspect', 'test']
    });
    assert.equal(missionResult.handled, true);
    assert.match(replies.join('\n'), /Mission created/);
    const healthResult = await plogme.executeIntent(sock, { chat: '12345@s.whatsapp.net' }, opts, { action: 'health' });
    assert.equal(healthResult.handled, true);
    assert.match(replies.join('\n'), /CODY health/);
});

test('PLOGME compacts oversized context and removes upstream error envelopes', () => {
    const huge = 'x'.repeat(50000);
    const compacted = plogme.buildPrompt('plogme-414-test', huge);
    assert.ok(compacted.length <= plogme.MAX_PROMPT_CHARS);
    assert.match(compacted, /older context compacted|User:/);
    assert.equal(plogme.sanitizeMemoryContent('<html><h1>414 Request-URI Too Large</h1></html>'), '[upstream HTTP error omitted from memory]');
    assert.equal(plogme.sanitizeMemoryContent(JSON.stringify({ query: huge, response: 'safe answer' })), 'safe answer');
});

test('PLOGME rejects HTML and 414 upstream payloads', () => {
    assert.equal(plogme.extractAIText('<html><h1>414 Request-URI Too Large</h1></html>', 200), '');
    assert.equal(plogme.extractAIText({ response: 'normal answer' }, 200), 'normal answer');
    assert.equal(plogme.extractAIText({ response: 'bad' }, 502), '');
});

test('PLOGME routes natural-language file requests to send_file and verifies delivery', async () => {
    const replies = [];
    const sent = [];
    const sock = {
        sendMessage: async (jid, content) => {
            sent.push({ jid, content });
            return { key: { id: 'file-message-1' } };
        }
    };
    const handled = await plogme.handleControlIntent(sock, { chat: '12345@s.whatsapp.net', key: {} }, {
        reply: async value => replies.push(String(value)),
        sendMessage: sock.sendMessage
    }, 'please send me src/Commands/Owner/mention.js file');
    assert.equal(handled, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].content.fileName, 'mention.js');
    assert.match(replies.at(-1), /File sent/);
    assert.match(replies.at(-1), /file-message-1/);
});

test('PLOGME does not claim a file was sent without a WhatsApp message key', async () => {
    const replies = [];
    const sock = { sendMessage: async () => ({}) };
    const result = await plogme.executeIntent(sock, { chat: '12345@s.whatsapp.net', key: {} }, {
        reply: async value => replies.push(String(value)),
        sendMessage: sock.sendMessage
    }, { action: 'send_file', path: 'src/Commands/Owner/mention.js' });
    assert.equal(result.handled, true);
    assert.match(replies.at(-1), /no delivery key/i);
    assert.doesNotMatch(replies.at(-1), /File sent/);
});

test('PLOGME lists the actual runtime workspace instead of a simulated Bot folder', async () => {
    const replies = [];
    const result = await plogme.executeIntent({}, { chat: '12345@s.whatsapp.net' }, {
        reply: async value => replies.push(String(value))
    }, { action: 'list_files', path: 'src/Commands/Owner' });
    assert.equal(result.handled, true);
    assert.match(replies.at(-1), /LIVE WORKSPACE FILES/);
    assert.match(replies.at(-1), /Runtime root:/);
    assert.match(replies.at(-1), /mention\.js/);
    assert.doesNotMatch(replies.at(-1), /Files found: 5\s*\n\s*• ping\.js/);
});

test('PLOGME rename_file changes a real path and reports loader reconciliation', async () => {
    const source = path.join(process.cwd(), 'database', 'plogme-rename-source.txt');
    const destination = path.join(process.cwd(), 'database', 'plogme-rename-destination.gsm');
    fs.writeFileSync(source, 'runtime rename test');
    const replies = [];
    try {
        const result = await plogme.executeIntent({}, { chat: '12345@s.whatsapp.net' }, {
            reply: async value => replies.push(String(value))
        }, { action: 'rename_file', from: 'database/plogme-rename-source.txt', to: 'database/plogme-rename-destination.gsm' });
        assert.equal(result.handled, true);
        assert.equal(fs.existsSync(source), false);
        assert.equal(fs.existsSync(destination), true);
        assert.match(replies.at(-1), /Rename verified/);
        assert.match(replies.at(-1), /Command registry:\* (?:reloaded|refresh unavailable)/);
    } finally {
        try { fs.unlinkSync(source); } catch {}
        try { fs.unlinkSync(destination); } catch {}
    }
});

test('PLOGME runCommandAction executes a real registered menubit command', async () => {
    const { registerCommand } = require('../src/Plugin/crysCmd');
    const replies = [];
    registerCommand({
        name: 'menu',
        alias: ['menubit'],
        execute: async (sock, m, { reply }) => reply('REAL MENUBIT COMMAND EXECUTED')
    });
    const result = await plogme.runCommandAction({}, { chat: '12345@s.whatsapp.net' }, {
        reply: async value => replies.push(String(value))
    }, 'menubit');
    assert.equal(result, true);
    assert.deepEqual(replies, ['REAL MENUBIT COMMAND EXECUTED']);
});

test('PLOGME normalizes malformed emphasis without altering ordinary bold markers', () => {
    assert.equal(plogme.normalizePlogmeFormatting('**Running** and ****wrong****'), '**Running** and **wrong**');
    assert.equal(plogme.normalizePlogmeFormatting('____ok____'), '__ok__');
});

test('live .plogme wrapper propagates the WhatsApp file receipt', async () => {
    const aiCommand = require('../src/Commands/AI/plogme');
    const replies = [];
    const sent = [];
    const binaryPath = path.join(process.cwd(), 'database', 'plogme-wrapper-test.bin');
    fs.writeFileSync(binaryPath, Buffer.from([0, 1, 2, 3]));
    const sock = {
        sendMessage: async (jid, content, options) => {
            sent.push({ jid, content, options });
            return { key: { id: 'wrapper-file-message-1' } };
        }
    };
    try {
        await aiCommand.execute(sock, { chat: '12345@s.whatsapp.net', key: {} }, {
            args: ['send', 'file', 'database/plogme-wrapper-test.bin'],
            prefix: '.',
            reply: async value => replies.push(String(value))
        });
        assert.equal(sent.length, 1);
        assert.equal(sent[0].content.fileName, 'plogme-wrapper-test.bin');
        assert.match(replies.at(-1), /Message ID:.*wrapper-file-message-1/);
    } finally { try { fs.unlinkSync(binaryPath); } catch {} }
});

test('PLOGME converts raw upload URLs safely and classifies code files for CDN fallback', () => {
    assert.equal(plogme.isTextFilePath('ping.js'), true);
    assert.equal(plogme.isTextFilePath('photo.jpg'), false);
    assert.equal(plogme.toRawCdnUrl('https://cdn.crysnovax.link/file/abc.html'), 'https://cdn.crysnovax.link/raw/abc.txt');
    assert.throws(() => plogme.toRawCdnUrl('file:///tmp/x.txt'), /non-HTTP URL/);
});

test('PLOGME uses the verified CDN path without attempting direct code attachment', async () => {
    const replies = [];
    const sent = [];
    const source = Buffer.from('module.exports = { name: \'cdn-fallback-test\' };');
    const result = await plogme.executeIntent({}, { chat: '12345@s.whatsapp.net' }, {
        reply: async value => replies.push(String(value)),
        sendMessage: async (jid, content) => {
            sent.push({ jid, content });
            return { key: { id: 'cdn-message-1' } };
        },
        cdnUpload: async (buffer, filename) => {
            assert.equal(filename, 'mention.js');
            assert.ok(buffer.length > 0);
            return { url: 'https://cdn.crysnovax.link/raw/verified-mention.txt', buffer: Buffer.from(buffer) };
        }
    }, { action: 'send_file', path: 'src/Commands/Owner/mention.js' });
    assert.equal(result.handled, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].content.fileName, 'mention.js');
    assert.match(replies.at(-1), /Delivery:\* cdn/);
    assert.match(replies.at(-1), /cdn-message-1/);
});
