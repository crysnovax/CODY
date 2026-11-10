const JID_KINDS = [
    ['status@broadcast', 'status'],
    ['@s.whatsapp.net', 'pn'],
    ['@lid', 'lid'],
    ['@g.us', 'group'],
    ['@newsletter', 'newsletter'],
    ['@broadcast', 'broadcast']
];

function jidKind(jid) {
    if (typeof jid !== 'string' || !jid) return 'none';
    for (const [suffix, kind] of JID_KINDS) {
        if (jid === suffix || jid.endsWith(suffix)) return kind;
    }
    return 'other';
}

function countPayloadBytes(value, depth = 0) {
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value.length;
    if (depth >= 5 || !value || typeof value !== 'object') return 0;
    const items = Array.isArray(value) ? value : Object.values(value);
    return items.reduce((sum, item) => sum + countPayloadBytes(item, depth + 1), 0);
}

function safeNodeSummary(node) {
    const attrs = node?.attrs && typeof node.attrs === 'object' ? node.attrs : {};
    const children = Array.isArray(node?.content)
        ? node.content.filter(item => item && typeof item === 'object').map(item => String(item.tag || 'node')).slice(0, 12)
        : [];
    const payloadBytes = countPayloadBytes(node?.content);
    return {
        tag: String(node?.tag || 'unknown').slice(0, 32),
        from: jidKind(attrs.from),
        to: jidKind(attrs.to),
        type: typeof attrs.type === 'string' ? attrs.type.slice(0, 32) : undefined,
        category: typeof attrs.category === 'string' ? attrs.category.slice(0, 32) : undefined,
        class: typeof attrs.class === 'string' ? attrs.class.slice(0, 32) : undefined,
        xmlns: typeof attrs.xmlns === 'string' ? attrs.xmlns.slice(0, 48) : undefined,
        idPresent: typeof attrs.id === 'string' && attrs.id.length > 0,
        attrKeys: Object.keys(attrs).slice(0, 20),
        childTags: children,
        payloadBytes
    };
}

function safeMessageSummary(message) {
    const key = message?.key || message?.fakeObj?.key || {};
    const payload = message?.message || message?.fakeObj?.message || {};
    return {
        remote: jidKind(key.remoteJid),
        remoteAlt: jidKind(key.remoteJidAlt),
        participant: jidKind(key.participant),
        participantAlt: jidKind(key.participantAlt),
        fromMe: Boolean(key.fromMe),
        idPresent: typeof key.id === 'string' && key.id.length > 0,
        payloadFields: Object.keys(payload).slice(0, 12),
        stubType: message?.messageStubType == null ? undefined : String(message.messageStubType).slice(0, 48)
    };
}

function attachRawIncomingTrace(sock, { enabled = process.env.CODY_TRACE_WA_INBOUND === '1', log = console.log } = {}) {
    if (!enabled) return () => {};
    if (!sock?.ws?.on) {
        log('[WIRE TRACE] enabled, but socket has no raw stanza emitter');
        return () => {};
    }

    const listeners = [];
    const stanzaEvents = ['CB:message', 'CB:notification', 'CB:receipt', 'CB:iq', 'CB:ib', 'CB:presence', 'CB:chatstate', 'CB:ack'];
    for (const eventName of stanzaEvents) {
        const listener = node => {
            const summary = safeNodeSummary(node);
            log(`[WIRE TRACE] ${eventName} ${JSON.stringify(summary)}`);
        };
        sock.ws.on(eventName, listener);
        listeners.push([sock.ws, eventName, listener]);
    }

    const upsertListener = ({ messages = [], type } = {}) => {
        for (const message of messages) {
            log(`[WIRE TRACE] messages.upsert type=${String(type || 'unknown')} ${JSON.stringify(safeMessageSummary(message))}`);
        }
    };
    if (sock.ev?.on) {
        sock.ev.on('messages.upsert', upsertListener);
        listeners.push([sock.ev, 'messages.upsert', upsertListener]);
    }

    log(`[WIRE TRACE] attached to existing socket; raw stanza event listeners=${stanzaEvents.length}`);
    return () => {
        for (const [emitter, eventName, listener] of listeners) {
            emitter.off?.(eventName, listener);
            emitter.removeListener?.(eventName, listener);
        }
    };
}

module.exports = { attachRawIncomingTrace, jidKind, safeNodeSummary, safeMessageSummary };
