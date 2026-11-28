'use strict';

const fs = require('node:fs');
const path = require('node:path');

const asBoolean = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const enabled = () => asBoolean(process.env.CODY_VOIP_ENABLED, false);
const resourcesPath = () => path.resolve(process.env.PLOGME_VOIP_RESOURCES || 'call-resources');

let lifecycleSocket = null;
let stopCurrent = null;

async function startForSocket(sock) {
    if (!enabled() || !sock || lifecycleSocket === sock) return null;
    lifecycleSocket = sock;

    const resources = resourcesPath();
    const required = [
        path.join(resources, 'assets', 'wasm', 'whatsapp.wasm'),
        path.join(resources, 'assets', 'wasm', 'worker-modules.js')
    ];
    const missing = required.filter(file => !fs.existsSync(file));
    if (missing.length > 0) {
        console.warn('[CODY VoIP] Disabled for this socket: missing runtime files:', missing.join(', '));
        lifecycleSocket = null;
        return null;
    }

    try {
        const [{ VoipClient }, { PlogmeTransport }] = await Promise.all([
            import('plogme'),
            import('voip-plogme')
        ]);
        const client = new VoipClient({ sock, resourcesPath: resources });
        const transport = new PlogmeTransport({ client });

        transport.on('incomingCall', info => {
            globalThis.__codyPendingVoipCall = info;
            console.log('[CODY VoIP] Incoming call captured:', info.callId, info.peerJid, 'video=' + info.isVideo);
        });
        transport.on('videoError', details => {
            console.error('[CODY VoIP] Video error:', details?.error?.message || details);
        });
        transport.on('recordingError', details => {
            console.error('[CODY VoIP] Recording error:', details?.error?.message || details);
        });

        await transport.connect();
        globalThis.__codyVoipClient = client;
        globalThis.__codyVoipTransport = transport;
        globalThis.__codyVoipSocket = sock;

        // Auto-answer is intentionally not enabled by this first integration.
        // The conversational response/TTS bridge must be tested before callers
        // can be answered automatically.
        console.log('[CODY VoIP] Listener attached; automatic answering remains disabled.');

        let stopped = false;
        stopCurrent = async () => {
            if (stopped) return;
            stopped = true;
            try { await transport.disconnect(); } catch (error) {
                console.warn('[CODY VoIP] Listener cleanup failed:', error.message);
            }
            if (globalThis.__codyVoipClient === client) globalThis.__codyVoipClient = null;
            if (globalThis.__codyVoipTransport === transport) globalThis.__codyVoipTransport = null;
            if (globalThis.__codyVoipSocket === sock) globalThis.__codyVoipSocket = null;
            if (globalThis.__codyPendingVoipCall?.callId) globalThis.__codyPendingVoipCall = null;
            if (lifecycleSocket === sock) lifecycleSocket = null;
            if (stopCurrent) stopCurrent = null;
        };
        return { client, transport, stop: stopCurrent };
    } catch (error) {
        lifecycleSocket = null;
        console.error('[CODY VoIP] Listener startup failed:', error.message);
        return null;
    }
}

function installCodyVoipLifecycle(sock) {
    if (!enabled() || !sock?.ev?.on) return () => {};

    const onUpdate = update => {
        if (update?.connection === 'open') {
            void startForSocket(sock);
        } else if (update?.connection === 'close' && lifecycleSocket === sock) {
            void stopCurrent?.();
        }
    };
    sock.ev.on('connection.update', onUpdate);

    // A socket may already be open when this hook is installed in tests or
    // custom startup paths.
    if (sock.user) void startForSocket(sock);

    return () => {
        sock.ev.off?.('connection.update', onUpdate);
        void stopCurrent?.();
    };
}

module.exports = {
    asBoolean,
    enabled,
    resourcesPath,
    startForSocket,
    installCodyVoipLifecycle
};
