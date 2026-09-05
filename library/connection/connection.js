/**
 * CODY AI — Connection Manager
 * Supports: Base64 sessions, Cloudflare KV short IDs, Gzip-compressed
 */

const {
    default: makeWASocket,
    fetchLatestBaileysVersion,
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
    const { version, isLatest } = await fetchLatestBaileysVersion();

    const installedPkg = require('plogme/package.json');
    console.log(`📦 Baileys v${installedPkg.version} — server negotiated: ${version.join('.')} (latest: ${isLatest})`);
    if (!isLatest) {
        console.log('⚠️  Baileys server version differs from installed — update may be available');
    }

    const sock = makeWASocket({
        version,
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

const konek = async ({ sock, update, clientstart, DisconnectReason, Boom }) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
        const errorMsg = lastDisconnect?.error?.message || '';

        console.log(`🔴 Disconnected — reason: ${reason} (${errorMsg})`);

        if (reason === DisconnectReason.loggedOut) {
            console.log('🚫 Logged out. Delete sessions folder and restart.');
            process.exit(1);
        }
        if (reason === DisconnectReason.connectionReplaced) {
            console.log('⚠️ Connection replaced. Exiting...');
            process.exit(1);
        }
        if (reason === DisconnectReason.badSession) {
            console.log('❌ Bad session. Cleaning stale session keys…');
            try {
                const appStatePath = path.join(SESSION_PATH, 'app-state-sync-key.data');
                if (fs.existsSync(appStatePath)) {
                    fs.removeSync(appStatePath);
                    console.log('🧹 Removed stale app-state-sync-key.data');
                }
            } catch (_) {}
            console.log('♻️  Reconnecting with fresh keys…');
            setTimeout(() => clientstart(), 5000);
            return;
        }

        // Handle post-pairing stale offline fallback (HTTP 405, Bad MAC, stale keys)
        if (
            reason === DisconnectReason.badMAC ||
            errorMsg.includes('Bad MAC') ||
            errorMsg.includes('405') ||
            reason === 408
        ) {
            console.log('⚠️  Stale offline fallback / Bad MAC detected — cleaning…');
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
            console.log('♻️  Reconnecting in 5s…');
            setTimeout(() => clientstart(), 5000);
            return;
        }

        // Default reconnect for transient errors
        console.log(`🔄 Reconnecting in 3s…`);
        setTimeout(() => clientstart(), 3000);
    } else if (connection === 'open') {
        console.log('✓ Bot connected successfully');
    }
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
            
