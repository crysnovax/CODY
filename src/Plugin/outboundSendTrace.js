'use strict';

const { createHash } = require('node:crypto');
const { jidKind, safeNodeSummary } = require('./rawIncomingTrace');

function fingerprint(value) {
    if (typeof value !== 'string' || !value) return undefined;
    return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function sanitizeErrorMessage(value, content) {
    let message = String(value || '');
    const sensitiveValues = [];
    const collectStrings = (current, depth = 0, visited = new WeakSet()) => {
        if (depth > 5 || current == null) return;
        if (typeof current === 'string') {
            if (current.trim().length >= 3) sensitiveValues.push(current);
            return;
        }
        if (typeof current !== 'object' || Buffer.isBuffer(current) || visited.has(current)) return;
        visited.add(current);
        if (Array.isArray(current)) {
            for (const item of current.slice(0, 40)) collectStrings(item, depth + 1, visited);
        } else {
            for (const item of Object.values(current).slice(0, 40)) collectStrings(item, depth + 1, visited);
        }
    };
    collectStrings(content);
    for (const sensitive of [...new Set(sensitiveValues)].sort((a, b) => b.length - a.length)) {
        message = message.split(sensitive).join('[message-content]');
    }

    return message
        .replace(/\b[\w.+-]+@(?:s\.whatsapp\.net|lid|g\.us|newsletter|broadcast)\b/gi, '[jid]')
        .replace(/\b\+?\d[\d\s().-]{6,}\d\b/g, '[number]')
        .slice(0, 240);
}

function summarizeOutboundSend({ jid, content, result, error } = {}) {
    const target = Array.isArray(jid) ? jid[0] : jid;
    const id = result?.key?.id;
    const summary = {
        target: jidKind(target),
        contentFields: content && typeof content === 'object' && !Array.isArray(content)
            ? Object.keys(content).slice(0, 12)
            : [],
        returnedKey: typeof id === 'string' && id.length > 0,
        messageRef: fingerprint(id)
    };

    if (error) {
        summary.error = {
            name: String(error.name || 'Error').slice(0, 48),
            code: error.code ?? error.output?.statusCode ?? error.statusCode,
            message: sanitizeErrorMessage(error.message || error, content)
        };
    }

    return summary;
}

async function sendAndRequireKey(send, jid, content, options) {
    if (typeof send !== 'function') throw new TypeError('sendMessage function is unavailable');
    const result = await send(jid, content, options);
    if (!result?.key?.id) throw new Error('sendMessage resolved without a WhatsApp message key');
    return result;
}

function attachOutboundAckTrace(sock, {
    enabled = process.env.CODY_TRACE_WA_SENDS === '1',
    log = console.log,
    error = console.error
} = {}) {
    if (!sock?.ws?.on) return () => {};

    const listener = node => {
        const attrs = node?.attrs || {};
        const isError = String(attrs.type || '').toLowerCase() === 'error'
            || attrs.error != null
            || String(attrs.class || '').toLowerCase() === 'error';
        if (!enabled && !isError) return;
        const summary = safeNodeSummary(node);
        const line = `[WA SEND ACK${isError ? ' ERROR' : ''}] ${JSON.stringify(summary)}`;
        (isError ? error : log)(line);
    };

    sock.ws.on('CB:ack', listener);
    return () => {
        sock.ws.off?.('CB:ack', listener);
        sock.ws.removeListener?.('CB:ack', listener);
    };
}

module.exports = {
    fingerprint,
    sanitizeErrorMessage,
    summarizeOutboundSend,
    sendAndRequireKey,
    attachOutboundAckTrace
};
