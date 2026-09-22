/**
 * CODY AI — Connection Manager
 * Supports: Base64 sessions, Cloudflare KV short IDs, Gzip-compressed
 */

const {
    default: makeWASocket,
    Browsers,
    DisconnectReason
} = require('plogme');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const zlib = require('zlib');

const SESSION_PATH = './sessions';

async function getAuthState() {
    if (!fs.existsSync(SESSION_PATH)) {
        fs.mkdirSync(SESSION_PATH, { recursive: true });
    }
    // Baileys 2.7.5 keeps the auth helper in its Utils entrypoint. Import it
    // directly so startup works even when a CommonJS require namespace omits
    // star-re-exported ESM utilities.
    const { useMultiFileAuthState } = await import('plogme/lib/Utils/use-multi-file-auth-state.js');
    return await useMultiFileAuthState(SESSION_PATH);
}

/**
 * Download session from Cloudflare KV
 * @param {string} shortId - The short ID (e.g., "la9fljbp")
 * @returns {Promise<string | null>}
 */
async function downloadFromKV(shortId) {
    try {
        const CF_WORKER_URL = 'https://id.crysnova.qzz.io';
        const response = await fetch(`${CF_WORKER_URL}/session/load/${shortId}`);
        const result = await response.json();
        
        if (result.sessionData || result.data) {
            console.log(`✅ Session loaded from Cloudflare KV`);
            return result.sessionData || result.data;
        } else {
            console.log(`❌ KV session not found: ${result.error || 'No data'}`);
            return null;
        }
    } catch (err) {
        console.error('❌ KV download failed:', err.message);
        return null;
    }
}

/**
 * Decode SESSION_ID — supports:
 * - Cloudflare KV short ID: CODY_AI!KV:xxxx
 * - Plain base64: CODY_AI!eyJjcmVkcyI6...
 * - Gzip-compressed base64
 */
async function decodeSession(sessionId) {
    if (!sessionId || typeof sessionId !== 'string') return false;

    // ── CLOUDFLARE KV SHORT ID ──
    if (sessionId.startsWith('CODY_AI!KV:')) {
        const shortId = sessionId.replace('CODY_AI!KV:', '');
        console.log('📦 Fetching session from Cloudflare KV. Short ID:', shortId);
        
        const sessionJson = await downloadFromKV(shortId);
        if (!sessionJson) {
            console.log('❌ Failed to fetch session from KV');
            return false;
        }
        
        try {
            const creds = JSON.parse(sessionJson);
            if (!fs.existsSync(SESSION_PATH)) {
                fs.mkdirSync(SESSION_PATH, { recursive: true });
            }
            
            fs.writeFileSync(
                path.join(SESSION_PATH, 'creds.json'),
                JSON.stringify(creds, null, 2)
            );
            
            console.log('✅ Session restored from Cloudflare KV');
            return true;
        } catch (err) {
            console.log('❌ Failed to parse KV session:', err.message);
            return false;
        }
    }

    // ── BASE64 / COMPRESSED SESSION ──
    let base64 = sessionId.trim();
    if (base64.includes('!')) {
        base64 = base64.split('!').pop();
    }

    try {
        let decoded;
        const buffer = Buffer.from(base64, 'base64');

        if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
            decoded = zlib.gunzipSync(buffer).toString('utf8');
            console.log('📦 Detected gzip-compressed session');
        } else {
            decoded = buffer.toString('utf8');
        }

        const creds = JSON.parse(decoded);
        if (!creds.noiseKey && !creds.me) {
            throw new Error('Invalid creds format');
        }

        if (!fs.existsSync(SESSION_PATH)) {
            fs.mkdirSync(SESSION_PATH, { recursive: true });
        }

        fs.writeFileSync(
            path.join(SESSION_PATH, 'creds.json'),
            JSON.stringify(creds, null, 2)
        );

        console.log('🔐 Session restored from base64');
        return true;
    } catch (err) {
        console.log('❌ Failed to decode session:', err.message);
        return false;
    }
}

function encodeSession() {
    try {
        const credsPath = path.join(SESSION_PATH, 'creds.json');
        if (!fs.existsSync(credsPath)) return null;
        const creds = fs.readFileSync(credsPath, 'utf8');
        return `CODY_AI!${Buffer.from(creds).toString('base64')}`;
    } catch (err) {
        console.log('❌ Failed to encode session:', err.message);
        return null;
    }
}

function hasLocalSession() {
    return fs.existsSync(path.join(SESSION_PATH, 'creds.json'));
}

async function createSocket(sessionId) {
    if (sessionId && !hasLocalSession()) {
        console.log('🔑 No local session. Attempting SESSION_ID restore...');
        const restored = await decodeSession(sessionId);
        if (!restored) {
            console.log('⚠️ SESSION_ID invalid. Requesting fresh pair code / QR.');
        }
    }

    const { state, saveCreds } = await getAuthState();

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !hasLocalSession(),
        auth: state,
        browser: Browsers.macOS('Chrome'),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
        markOnlineOnConnect: true,
        keepAliveIntervalMs: 30000,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        shouldSyncHistoryMessage: () => false,
        getMessage: null
    });

    return { sock, saveCreds, state };
}

async function clearSession() {
    try {
        await fs.remove(SESSION_PATH);
        console.log('🗑️ Session cleared.');
    } catch (err) {
        console.log('❌ Failed to clear session:', err.message);
    }
}

// A 440 (connectionReplaced) used to leave the socket dead forever: the entry
// point deliberately skips its own reconnect for that code, and konek returned
// early too, so no socket was ever created again — every command silently
// stopped working until the server was restarted manually. We now reconnect
// with a growing backoff (another device simply holds the same credentials),
// resetting the counter on a successful open. (@crysnovax—FIX22-09-26)
let replacedRetry = 0;
let replacedTimer = null;
let reconnectPending = false;
const REPLACED_BACKOFF_MS = [15000, 30000, 60000];

// Stale app-state keys (offline fallback / Bad MAC) break the next handshake.
// 408 is a transport timeout and must NOT be treated this way: deleting auth
// state for a timeout makes the reconnect look like a fresh pairing and logs
// the session out.
function cleanAppStateFiles() {
    try {
        const staleFiles = ['app-state-sync-key.data', 'app-state-sync-version.data'];
        for (const f of staleFiles) {
            const fp = path.join(SESSION_PATH, f);
            if (fs.existsSync(fp)) {
                fs.removeSync(fp);
                console.log(`🧹 Removed ${f}`);
            }
        }
    } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────
// SINGLE-FLIGHT RECONNECT
//
// Root cause of the fleet-wide 440 ("Stream Errored (conflict)") loop:
// the entry point (⚉.js) reconnects for EVERY close code except
// loggedOut / connectionReplaced / badSession, and `konek` also reconnected
// for those same codes. One disconnect therefore scheduled TWO reconnects
// (the entry's 3s timer plus konek's own), which created TWO sockets against
// the same WhatsApp session a few seconds apart. WhatsApp answers that with
// 440 — the second connection replaces the first — and because 440 was skipped
// by both places, the bot went permanently deaf until a manual restart, with
// or without a second panel.
//
// konek now reconnects ONLY for the codes the entry point skips, so exactly one
// socket is ever created per disconnect:
//   • every other code → entry point owns it (3s); we only clean stale keys
//   • connectionReplaced (440) → here, with backoff
//   • badSession (500)         → here, after clearing stale keys
//   • loggedOut (401)          → no reconnect (re-pair required)
// Repeated `close` events for the same dead socket are ignored, the dead
// transport is released first, and a reconnect storm slows the backoff down.
// (@crysnovax—FIX22-09-26)
const handledCloses = new WeakSet();
const recentReconnects = [];

const konek = async ({ sock, update, clientstart, DisconnectReason, Boom }) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
        replacedRetry = 0;
        recentReconnects.length = 0;
        reconnectPending = false;
        // Drop any queued reconnect: creating that socket now would be the
        // duplicate that causes 440 in the first place.
        if (replacedTimer) { clearTimeout(replacedTimer); replacedTimer = null; }
        console.log('✓ Bot connected successfully');
        return;
    }
    if (connection !== 'close') return;

    // A dead socket can report close more than once — only the first report may
    // trigger anything, otherwise each event spawns another socket.
    if (sock && handledCloses.has(sock)) return;
    if (sock) handledCloses.add(sock);

    const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
    const errorMsg = lastDisconnect?.error?.message || '';

    console.log(`🔴 Disconnected — reason: ${reason} (${errorMsg})`);

    // Release the dead transport so WhatsApp never sees the old session and the
    // replacement at the same time. Best effort.
    try { sock?.ws?.close?.(); } catch (_) {}

    const entryPointReconnects = ![
        DisconnectReason.loggedOut,
        DisconnectReason.connectionReplaced,
        DisconnectReason.badSession
    ].includes(reason);

    if (entryPointReconnects) {
        // The entry point already schedules this reconnect — adding ours here
        // was the duplicate-socket bug. Only clean stale keys when the failure
        // looks like a Bad MAC / stale offline fallback.
        if (reason === DisconnectReason.badMAC || errorMsg.includes('Bad MAC') || errorMsg.includes('405')) {
            console.log('⚠️  Stale offline fallback / Bad MAC detected — cleaning app-state keys…');
            cleanAppStateFiles();
        }
        return;
    }

    if (reason === DisconnectReason.loggedOut) {
        console.log('🚫 WhatsApp reported logged out. Keeping the panel alive; re-pair is required before reconnecting.');
        return;
    }

    // Only one pending reconnect at a time.
    if (reconnectPending) {
        console.log('↺ Reconnect already scheduled — not stacking another one.');
        return;
    }

    // Storm guard: several reconnects within 10 minutes means something is
    // wrong upstream, so back off harder instead of hammering WhatsApp.
    const now = Date.now();
    recentReconnects.push(now);
    while (recentReconnects.length && now - recentReconnects[0] > 10 * 60 * 1000) recentReconnects.shift();
    const storm = recentReconnects.length >= 5;

    const safeStart = () => {
        replacedTimer = null;
        reconnectPending = false;
        try { clientstart(); } catch (err) { console.log('❌ Reconnect failed:', err.message); }
    };

    if (reason === DisconnectReason.connectionReplaced) {
        const base = REPLACED_BACKOFF_MS[Math.min(replacedRetry, REPLACED_BACKOFF_MS.length - 1)];
        const delay = storm ? 60000 : base;
        replacedRetry++;
        console.log(`⚠️ Connection replaced by another linked session — reconnecting in ${delay / 1000}s (attempt ${replacedRetry}).`);
        replacedTimer = setTimeout(safeStart, delay);
        reconnectPending = true;
        return;
    }

    // badSession / anything else the entry point refuses to reconnect for.
    console.log('❌ Bad session. Cleaning stale session keys…');
    cleanAppStateFiles();
    const delay = storm ? 60000 : 5000;
    console.log(`♻️  Reconnecting in ${delay / 1000}s…`);
    replacedTimer = setTimeout(safeStart, delay);
    reconnectPending = true;
};

module.exports = {
    createSocket,
    getAuthState,
    decodeSession,
    encodeSession,
    hasLocalSession,
    clearSession,
    konek,
    SESSION_PATH
};
            
