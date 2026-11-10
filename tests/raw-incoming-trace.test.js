const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { attachRawIncomingTrace, safeMessageSummary, safeNodeSummary } = require('../src/Plugin/rawIncomingTrace');

function makeSocket() {
    return { ws: new EventEmitter(), ev: new EventEmitter() };
}

test('raw stanza summary classifies status routes without exposing addresses or IDs', () => {
    const summary = safeNodeSummary({
        tag: 'message',
        attrs: { from: 'status@broadcast', to: '15550001111@s.whatsapp.net', id: 'private-id', type: 'text' },
        content: [{ tag: 'enc', attrs: { type: 'pkmsg' }, content: Buffer.from('secret') }]
    });
    assert.equal(summary.from, 'status');
    assert.equal(summary.to, 'pn');
    assert.equal(summary.type, 'text');
    assert.equal(summary.idPresent, true);
    assert.deepEqual(summary.childTags, ['enc']);
    assert.equal(summary.payloadBytes, 6);
    assert.equal(JSON.stringify(summary).includes('15550001111'), false);
    assert.equal(JSON.stringify(summary).includes('private-id'), false);
    assert.equal(JSON.stringify(summary).includes('secret'), false);
});

test('decoded message summary reports status shape without text, IDs, or full JIDs', () => {
    const summary = safeMessageSummary({
        key: {
            remoteJid: 'status@broadcast',
            participant: '15550002222@s.whatsapp.net',
            id: 'private-status-id',
            fromMe: false
        },
        message: { imageMessage: { caption: 'private caption' } }
    });
    assert.equal(summary.remote, 'status');
    assert.equal(summary.participant, 'pn');
    assert.deepEqual(summary.payloadFields, ['imageMessage']);
    const json = JSON.stringify(summary);
    assert.equal(json.includes('15550002222'), false);
    assert.equal(json.includes('private-status-id'), false);
    assert.equal(json.includes('private caption'), false);
});

test('opt-in trace observes raw stanzas and decoded message upserts and can detach cleanly', () => {
    const sock = makeSocket();
    const lines = [];
    const detach = attachRawIncomingTrace(sock, { enabled: true, log: line => lines.push(line) });
    assert.ok(lines.some(line => line.includes('attached to existing socket')));

    sock.ws.emit('CB:message', {
        tag: 'message',
        attrs: { from: 'status@broadcast', id: 'not-logged', type: 'text' },
        content: [{ tag: 'enc', content: Buffer.from('payload') }]
    });
    sock.ev.emit('messages.upsert', {
        type: 'notify',
        messages: [{
            key: { remoteJid: 'status@broadcast', participant: '15550003333@lid', id: 'also-not-logged', fromMe: false },
            message: { conversation: 'do not log this body' }
        }]
    });

    assert.equal(lines.some(line => line.includes('CB:message') && line.includes('"from":"status"')), true);
    assert.equal(lines.some(line => line.includes('messages.upsert') && line.includes('"remote":"status"')), true);
    const all = lines.join('\n');
    assert.equal(all.includes('15550003333'), false);
    assert.equal(all.includes('not-logged'), false);
    assert.equal(all.includes('also-not-logged'), false);
    assert.equal(all.includes('do not log this body'), false);

    const beforeDetach = lines.length;
    detach();
    sock.ws.emit('CB:message', { tag: 'message', attrs: { from: 'status@broadcast' }, content: [] });
    sock.ev.emit('messages.upsert', { messages: [] });
    assert.equal(lines.length, beforeDetach);
});

test('trace is disabled by default and does not attach listeners', () => {
    const sock = makeSocket();
    const detach = attachRawIncomingTrace(sock, { enabled: false, log: () => assert.fail('must not log') });
    assert.equal(sock.ws.listenerCount('CB:message'), 0);
    assert.equal(sock.ev.listenerCount('messages.upsert'), 0);
    detach();
});
