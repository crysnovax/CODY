'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { fingerprint, summarizeOutboundSend, sendAndRequireKey, attachOutboundAckTrace } = require('../src/Plugin/outboundSendTrace');
const { safeNodeSummary } = require('../src/Plugin/rawIncomingTrace');

function makeSocket() {
    return { ws: new EventEmitter() };
}

test('outbound send summaries fingerprint message IDs and omit message text and full JIDs', () => {
    const summary = summarizeOutboundSend({
        jid: '15550001111@s.whatsapp.net',
        content: { text: 'private message body' },
        result: { key: { id: 'secret-message-id' } }
    });

    assert.equal(summary.target, 'pn');
    assert.deepEqual(summary.contentFields, ['text']);
    assert.equal(summary.returnedKey, true);
    assert.equal(summary.messageRef, fingerprint('secret-message-id'));
    const encoded = JSON.stringify(summary);
    assert.equal(encoded.includes('private message body'), false);
    assert.equal(encoded.includes('15550001111'), false);
    assert.equal(encoded.includes('secret-message-id'), false);
});

test('outbound send failure summary redacts phone numbers and JIDs but keeps error code', () => {
    const summary = summarizeOutboundSend({
        jid: '15550001111@s.whatsapp.net',
        content: { text: 'secret text' },
        error: Object.assign(new Error('send "secret text" to 15550001111@s.whatsapp.net failed'), { code: 'EPIPE' })
    });

    assert.equal(summary.error.code, 'EPIPE');
    assert.match(summary.error.message, /\[jid\]/);
    assert.equal(JSON.stringify(summary).includes('15550001111'), false);
    assert.equal(JSON.stringify(summary).includes('secret text'), false);
});

test('required-send adapter rejects resolved sends without a key and returns valid receipts', async () => {
    await assert.rejects(
        sendAndRequireKey(async () => ({}), '15550001111@s.whatsapp.net', { text: 'hello' }),
        /without a WhatsApp message key/
    );
    const expected = { key: { id: 'message-1' } };
    assert.equal(await sendAndRequireKey(async () => expected, '15550001111@s.whatsapp.net', { text: 'hello' }), expected);
});

test('ACK summary includes a stable hashed message reference but not the raw ID', () => {
    const summary = safeNodeSummary({
        tag: 'ack',
        attrs: { from: 's.whatsapp.net', id: 'secret-message-id', class: 'message', type: 'error', code: '500' },
        content: []
    });

    assert.equal(summary.messageRef, fingerprint('secret-message-id'));
    assert.equal(summary.errorCode, '500');
    assert.equal(JSON.stringify(summary).includes('secret-message-id'), false);
});

test('ACK tracing logs only server errors by default and all ACKs when opted in', () => {
    const sock = makeSocket();
    const lines = [];
    const errors = [];
    const detach = attachOutboundAckTrace(sock, {
        enabled: false,
        log: value => lines.push(value),
        error: value => errors.push(value)
    });

    sock.ws.emit('CB:ack', { tag: 'ack', attrs: { type: 'message', id: 'ok-id' }, content: [] });
    sock.ws.emit('CB:ack', { tag: 'ack', attrs: { type: 'error', id: 'bad-id', code: '500' }, content: [] });
    assert.equal(lines.length, 0);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].includes('bad-id'), false);
    detach();
    assert.equal(sock.ws.listenerCount('CB:ack'), 0);
});
