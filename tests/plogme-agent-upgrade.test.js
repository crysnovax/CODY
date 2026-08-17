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
