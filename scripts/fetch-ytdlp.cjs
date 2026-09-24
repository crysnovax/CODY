/**
 * ┌──────────────────────────────────────────────────────────────┐
 * │  yt-dlp binary provisioner for CODY AI                       │
 * │  The `ytsave` dependency is a thin CLI wrapper that spawns    │
 * │  the external `yt-dlp` executable — it bundles nothing.       │
 * │  This script downloads the standalone binary once into        │
 * │  vendor/ so ytsave works without a system install.            │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Run directly:  node scripts/fetch-ytdlp.cjs
 * Run from code: require('./scripts/fetch-ytdlp.cjs').ensureYtDlp()
 *
 * Never throws — a missing yt-dlp must not break bot startup or
 * `npm install`. Callers check the returned path instead.
 * Set YTDLP_SKIP_DOWNLOAD=1 to disable the network fetch entirely.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const VENDOR_DIR = path.join(__dirname, '..', 'vendor');
const DOWNLOAD_TIMEOUT_MS = 120000;
const MAX_REDIRECTS = 5;

/** yt-dlp ships one asset per platform; pick the one that matches this host. */
function releaseAsset() {
    if (process.platform === 'win32') return { asset: 'yt-dlp.exe', binary: 'yt-dlp.exe' };
    if (process.platform === 'darwin') return { asset: 'yt-dlp_macos', binary: 'yt-dlp' };
    if (process.arch === 'arm64') return { asset: 'yt-dlp_linux_aarch64', binary: 'yt-dlp' };
    if (process.arch === 'arm') return { asset: 'yt-dlp_linux_armv7l', binary: 'yt-dlp' };
    return { asset: 'yt-dlp_linux', binary: 'yt-dlp' };
}

/**
 * Where the executable should live. YTDLP_BINARY lets an operator point at an
 * existing build (e.g. /usr/local/bin/yt-dlp) instead of the vendor copy —
 * keep the file named `yt-dlp`, since that is the command ytsave spawns.
 */
function binaryPath() {
    return process.env.YTDLP_BINARY || path.join(VENDOR_DIR, releaseAsset().binary);
}

function isUsable(file) {
    try {
        return fs.statSync(file).size > 1024 * 100; // real builds are tens of MB
    } catch {
        return false;
    }
}

function fetch(url, destination, redirectsLeft = MAX_REDIRECTS) {
    return new Promise((resolve, reject) => {
        const request = https.get(
            url,
            { headers: { 'User-Agent': 'CODY-AI-ytdlp-provisioner' } },
            (response) => {
                if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                    response.resume();
                    if (redirectsLeft <= 0) return reject(new Error('too many redirects'));
                    const next = new URL(response.headers.location, url).toString();
                    return resolve(fetch(next, destination, redirectsLeft - 1));
                }
                if (response.statusCode !== 200) {
                    response.resume();
                    return reject(new Error(`HTTP ${response.statusCode} from ${url}`));
                }

                const temporary = `${destination}.tmp`;
                const stream = fs.createWriteStream(temporary);
                response.pipe(stream);
                stream.on('finish', () => {
                    stream.close(() => {
                        fs.renameSync(temporary, destination);
                        fs.chmodSync(destination, 0o755);
                        resolve();
                    });
                });
                stream.on('error', reject);
            }
        );

        request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => request.destroy(new Error('download timed out')));
        request.on('error', reject);
    });
}

/**
 * yt-dlp loads `<binary dir>/yt-dlp.conf` on every run. Because ytsave passes
 * no extra arguments, this file is the only way to configure the engine
 * (cookies, proxy, extractor clients) without patching the dependency.
 */
function configPath() {
    const binary = binaryPath();
    // On Windows the executable is yt-dlp.exe but the config is still yt-dlp.conf.
    return `${process.platform === 'win32' ? binary.replace(/\.exe$/i, '') : binary}.conf`;
}

const STARTER_CONFIG = `# yt-dlp options, applied to every run — including every run made by ytsave.
# One option per line; lines starting with '#' are comments.

# Node is always available in this project and silences the
# "No supported JavaScript runtime could be found" warning.
--js-runtimes node

# YouTube 403s most datacenter IPs (Render, Vercel, CI). Uncomment and point at
# a cookies file or proxy to make downloads work from those hosts.
# --cookies /absolute/path/to/cookies.txt
# --proxy http://user:pass@host:port
`;

function ensureConfig() {
    const target = configPath();
    // Only seed our own vendor copy — never write next to an operator's binary.
    if (process.env.YTDLP_BINARY) return target;

    try {
        fs.mkdirSync(VENDOR_DIR, { recursive: true });
        if (!fs.existsSync(target)) fs.writeFileSync(target, STARTER_CONFIG, 'utf8');
    } catch {}
    return target;
}

/**
 * Ensure vendor/ contains a runnable yt-dlp.
 * @returns {Promise<string|null>} absolute binary path, or null when unavailable.
 */
async function ensureYtDlp() {
    const target = binaryPath();
    ensureConfig();

    if (isUsable(target)) return target;
    if (process.env.YTDLP_SKIP_DOWNLOAD === '1') return null;

    try {
        fs.mkdirSync(VENDOR_DIR, { recursive: true });
        const { asset } = releaseAsset();
        const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
        await fetch(url, target);

        if (!isUsable(target)) throw new Error('downloaded file looks truncated');
        console.log(`[yt-dlp] Provisioned ${path.relative(process.cwd(), target)}`);
        return target;
    } catch (error) {
        try {
            fs.rmSync(`${target}.tmp`, { force: true });
        } catch {}
        console.warn(
            `[yt-dlp] Could not provision the binary (${error.message}). ` +
            'Local YouTube downloads via ytsave stay disabled; install yt-dlp on PATH to enable them.'
        );
        return null;
    }
}

module.exports = { ensureYtDlp, binaryPath, configPath, releaseAsset, VENDOR_DIR };

if (require.main === module) {
    ensureYtDlp().then((resolved) => {
        if (!resolved) {
            console.log('[yt-dlp] Not available — skipped (this is not a fatal error).');
        }
    });
}
