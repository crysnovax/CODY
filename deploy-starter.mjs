/**
 * ╔══════════════════════════════════════════════╗
 * ║   C⚉DY AI  ◦  Starter v3 (configure once)    ║
 * ╚══════════════════════════════════════════════╝
 *
 * Fixes the v2 starter, which rewrote `.env` AND injected the same variables
 * into the child process on EVERY launch:
 *   • any value you edited by hand (prefix, mode, owner name …) was clobbered
 *   • any variable added later by a newer starter was ignored
 *
 * v3 rules:
 *   1. `.env` is written ONCE, on the first deploy.
 *   2. On later launches only MISSING keys are appended — existing values are
 *      never overwritten, so `.setvar` / manual edits survive restarts.
 *   3. The bot is launched WITHOUT injected env vars: `.env` + the bot's own
 *      runtime config are the single source of truth.
 *   4. Setup (clone / npm install / session) only runs while the bot is not yet
 *      configured: it must not touch the repository after that.
 *
 * Usage:
 *   node deploy-starter.mjs                 # normal start (configure once)
 *   node deploy-starter.mjs --reconfigure   # force-apply the values below
 */
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Colors ──────────────────────────────────────────────────────────────
const c = {
    reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', cyan: '\x1b[36m'
};
const log = {
    ok:   m => console.log(`  ${c.green}${c.bright}✓${c.reset}  ${c.green}${m}${c.reset}`),
    warn: m => console.log(`  ${c.yellow}${c.bright}!${c.reset}  ${c.yellow}${m}${c.reset}`),
    err:  m => console.log(`  ${c.red}${c.bright}✗${c.reset}  ${c.red}${m}${c.reset}`),
    info: m => console.log(`  ${c.cyan}o${c.reset}  ${c.dim}${m}${c.reset}`),
    step: m => console.log(`\n${c.blue}${c.bright}── ${m}${c.reset}`)
};

// ─── Values applied on the FIRST deploy only ─────────────────────────────
// Edit these, then deploy. After the first run they are only used to fill in
// keys that are still missing from `.env`.
const DEPLOY_CONFIG = {
    SESSION_ID:       'CODY_AI!KV:hx809881',
    OWNER_NUMBER:     '2349122083563',
    OWNER_NAME:       'PLOGME',
    BOT_NAME:         '```CODY AI```',
    PREFIX:           '!',
    MODE:             'public',
    AUTO_READ:        'true',
    AUTO_STATUS_VIEW: 'false'
};

// Keys without which the bot cannot connect / identify its owner.
const REQUIRED_KEYS = ['SESSION_ID', 'OWNER_NUMBER'];

const REPO_URL = 'https://github.com/crysnovax/CODY.git';
const BOT_DIR  = path.join(__dirname, 'bot');
const ENV_PATH = path.join(BOT_DIR, '.env');
const CREDS_PATH = path.join(BOT_DIR, 'sessions', 'creds.json');

const reconfigure = process.argv.includes('--reconfigure') || process.env.RECONFIGURE === '1';

function readEnvFile(file) {
    const map = new Map();
    if (!fs.existsSync(file)) return map;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        map.set(trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1));
    }
    return map;
}

/**
 * Write `.env` exactly once.
 *  - missing file            → create it with every deploy value
 *  - existing file           → append ONLY the keys that are absent
 *  - --reconfigure           → force the deploy values back in
 * Existing values are never overwritten otherwise, so anything you changed in
 * `.env` (or that the bot wrote later) stays untouched.
 */
function ensureEnvFile() {
    const existing = readEnvFile(ENV_PATH);

    if (!fs.existsSync(ENV_PATH)) {
        fs.mkdirSync(path.dirname(ENV_PATH), { recursive: true });
        fs.writeFileSync(
            ENV_PATH,
            Object.entries(DEPLOY_CONFIG).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
        );
        log.ok('.env created with the deploy configuration');
        return;
    }

    const missing = Object.keys(DEPLOY_CONFIG).filter(key => !existing.has(key));
    const differing = reconfigure
        ? Object.keys(DEPLOY_CONFIG).filter(key => existing.get(key) !== DEPLOY_CONFIG[key])
        : [];

    if (!missing.length && !differing.length) {
        log.info('.env already configured — leaving it untouched');
    }

    if (missing.length) {
        const lines = fs.readFileSync(ENV_PATH, 'utf8').replace(/\n*$/, '\n');
        fs.writeFileSync(
            ENV_PATH,
            lines + missing.map(key => `${key}=${DEPLOY_CONFIG[key]}`).join('\n') + '\n'
        );
        log.ok(`.env: added missing keys → ${missing.join(', ')}`);
    }

    if (reconfigure) {
        const map = readEnvFile(ENV_PATH);
        for (const [key, value] of Object.entries(DEPLOY_CONFIG)) map.set(key, value);
        fs.writeFileSync(ENV_PATH, [...map].map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
        log.warn(`.env: --reconfigure applied to ${differing.length || 'all'} key(s)`);
    } else {
        const kept = Object.keys(DEPLOY_CONFIG).filter(
            key => existing.has(key) && existing.get(key) !== DEPLOY_CONFIG[key]
        );
        if (kept.length) {
            log.info(`.env: keeping your existing values for ${kept.join(', ')}`);
        }
    }
}

/** Resolve a SESSION_ID into creds JSON (Cloudflare KV / Mega / base64). */
async function resolveSession(sid) {
    if (!sid) return null;

    if (sid.includes('!KV:')) {
        const shortId = sid.split('!KV:').pop();
        const res = await fetch(`https://id.crysnova.qzz.io/session/load/${shortId}`);
        const data = await res.json();
        if (data.sessionData) return data.sessionData;
        if (data.data) return typeof data.data === 'string' ? data.data : JSON.stringify(data.data);
        return null;
    }

    if (sid.startsWith('CODY_AI!M:')) {
        const mega = await import('megajs');
        const file = mega.File.fromURL(sid.slice('CODY_AI!M:'.length));
        return await new Promise((resolve, reject) => {
            file.loadAttributes(err => {
                if (err) return reject(new Error('Mega load failed: ' + err));
                file.downloadBuffer((err, buf) => {
                    if (err) return reject(new Error('Mega download: ' + err));
                    resolve(buf.toString('utf8'));
                });
            });
        });
    }

    const b64 = sid.includes('!') ? sid.split('!').pop() : sid;
    try {
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        return decoded && decoded.trim() ? decoded : null;
    } catch {
        return null;
    }
}

const isConfigured = () =>
    fs.existsSync(ENV_PATH) &&
    fs.existsSync(CREDS_PATH) &&
    fs.existsSync(path.join(BOT_DIR, 'node_modules')) &&
    REQUIRED_KEYS.every(key => readEnvFile(ENV_PATH).has(key));

function run(command, cwd, label) {
    try {
        execSync(command, { cwd, stdio: 'inherit' });
        if (label) log.ok(label);
        return true;
    } catch (err) {
        log.err(`${label || command} failed: ${err.message}`);
        return false;
    }
}

async function firstTimeSetup() {
    log.step('First-time setup');

    // Reuse, update, or clone — never clone into a non-empty directory.
    if (fs.existsSync(path.join(BOT_DIR, '.git'))) {
        log.info('Bot repository found — pulling latest changes');
        run('git pull --rebase --autostash', BOT_DIR, 'Repository updated');
    } else if (fs.existsSync(BOT_DIR) && fs.readdirSync(BOT_DIR).length) {
        log.warn('Bot directory exists — reusing it without cloning');
    } else {
        log.info('Cloning CODY…');
        if (!run(`git clone "${REPO_URL}" "${BOT_DIR}"`, undefined, 'Repository cloned')) {
            process.exit(1);
        }
    }

    fs.mkdirSync(BOT_DIR, { recursive: true });
    ensureEnvFile();

    if (!fs.existsSync(CREDS_PATH)) {
        log.info('Writing session credentials…');
        const creds = await resolveSession(DEPLOY_CONFIG.SESSION_ID).catch(err => {
            log.err('Session download failed: ' + err.message);
            return null;
        });
        if (creds) {
            fs.mkdirSync(path.dirname(CREDS_PATH), { recursive: true });
            fs.writeFileSync(CREDS_PATH, creds, 'utf8');
            log.ok('Session credentials saved');
        } else {
            log.warn('No session data — the bot will ask for a pairing code');
        }
    }

    if (!fs.existsSync(path.join(BOT_DIR, 'node_modules'))) {
        log.info('Installing dependencies…');
        if (!run('npm install --progress=false', BOT_DIR, 'Dependencies installed')) {
            process.exit(1);
        }
    }
}

function launch() {
    log.step('Launching CODY AI');
    // No env injection: `.env` (loaded by the bot) and the bot's own runtime
    // configuration stay authoritative across restarts.
    const bot = spawn('node', ['index.js'], { cwd: BOT_DIR, stdio: 'inherit' });
    bot.on('error', err => { log.err('Launch failed: ' + err.message); process.exit(1); });
    bot.on('close', code => {
        if (code === 0) log.ok('Bot exited cleanly');
        else log.warn(`Bot exited with code ${code}`);
        process.exit(code ?? 0);
    });
}

async function main() {
    console.log(`${c.cyan}${c.bright}\n   C O D Y   A I   —   S t a r t e r   v 3${c.reset}`);
    console.log(`   ${c.dim}configure once · never override${c.reset}`);

    if (isConfigured() && !reconfigure) {
        log.ok('Already configured — skipping setup');
        ensureEnvFile();   // only ever appends missing keys
        return launch();
    }

    await firstTimeSetup();
    launch();
}

main().catch(err => {
    log.err('Fatal error: ' + (err?.message || err));
    process.exit(1);
});
