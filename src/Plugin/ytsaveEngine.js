/**
 * ┌──────────────────────────────────────────────────────────────┐
 * │  ytsave engine · CODY AI                                     │
 * │  Local YouTube downloads (video + playlist) via `ytsave`.    │
 * └──────────────────────────────────────────────────────────────┘
 *
 * `ytsave` is intentionally tiny: it `spawn()`s `yt-dlp` with
 * `stdio: 'inherit'`, returns no file list and exposes no progress
 * callback. This module fills the three gaps CODY needs:
 *
 *   1. Runtime wiring — resolves the `yt-dlp` executable (vendor
 *      copy, provisioned on demand) and the `ffmpeg` shipped by
 *      `ffmpeg-static`, then prepends both to PATH for the child.
 *   2. Output discovery — ytsave only writes `%(title)s.%(ext)s`
 *      into a directory, so we diff the directory before/after and
 *      hand back the files it created.
 *   3. ESM boundary — ytsave is ESM-only; we load it through
 *      `import()` so this works on Node 20 and up.
 *
 * yt-dlp's own progress lines go straight to this process's stdout
 * (inherited stdio), which is what the console bridge already tails.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { ensureYtDlp, binaryPath, configPath } = require('../../scripts/fetch-ytdlp.cjs');


let ytsaveModule = null;
const linkedPathEntries = new Set();

function defaultOutputDir() {
    return process.env.YTDLP_OUTPUT_DIR || path.join(process.cwd(), 'downloads', 'ytdlp');
}

/** ffmpeg is required whenever yt-dlp merges separate video + audio streams. */
function resolveFfmpeg() {
    try {
        const binary = require('ffmpeg-static');
        if (typeof binary === 'string' && fs.existsSync(binary)) {
            return { binary, dir: path.dirname(binary) };
        }
    } catch {}
    return null;
}

/**
 * ytsave spawns the bare command names `yt-dlp` / `ffmpeg`, so the only way
 * to point it at our copies is PATH. Safe to call repeatedly — only newly
 * resolvable directories are prepended.
 * @param {string|null} ytDlpPath
 */
function prepareRuntimePath(ytDlpPath = binaryPath()) {
    const directories = [];
    if (ytDlpPath && fs.existsSync(ytDlpPath)) directories.push(path.dirname(ytDlpPath));

    const ffmpeg = resolveFfmpeg();
    if (ffmpeg) directories.push(ffmpeg.dir);

    const current = (process.env.PATH || '').split(path.delimiter);
    const missing = directories.filter((dir) => !linkedPathEntries.has(dir) && !current.includes(dir));
    if (!missing.length) return;

    missing.forEach((dir) => linkedPathEntries.add(dir));
    process.env.PATH = [...missing, ...current].join(path.delimiter);
}

/** Provision the binary when needed and make it reachable for spawned children. */
async function ensureReady() {
    const ytDlpPath = await ensureYtDlp();
    prepareRuntimePath(ytDlpPath);
    return ytDlpPath;
}

/** ytsave is ESM-only: use import() first so Node 20 works, require() as a fallback. */
async function loadYtsave() {
    if (ytsaveModule) return ytsaveModule;

    try {
        ytsaveModule = await import('ytsave');
    } catch (importError) {
        try {
            ytsaveModule = require('ytsave');
        } catch {
            throw new Error(`ytsave could not be loaded (${importError.message})`);
        }
    }

    return ytsaveModule;
}

function listFiles(root) {
    const found = new Set();

    const walk = (directory) => {
        let entries;
        try {
            entries = fs.readdirSync(directory, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const full = path.join(directory, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile()) found.add(full);
        }
    };

    walk(root);
    return found;
}

async function run(url, options, usePlaylist) {
    if (!url || typeof url !== 'string') throw new TypeError('A YouTube URL is required');

    const ytDlpPath = await ensureReady();
    if (!ytDlpPath) {
        throw new Error('yt-dlp is unavailable. Set YTDLP_SKIP_DOWNLOAD=0 and retry, or install yt-dlp on PATH.');
    }

    const ytsave = await loadYtsave();
    const format = options.format === 'mp3' ? 'mp3' : 'mp4';
    // Must be absolute: ytsave passes `output` straight to yt-dlp while the
    // child runs with cwd set to ytsave's own directory.
    const output = path.resolve(options.output || defaultOutputDir());

    fs.mkdirSync(output, { recursive: true });
    const before = listFiles(output);

    const downloader = usePlaylist ? ytsave.downloadPlaylist : ytsave.downloadVideo;
    if (typeof downloader !== 'function') throw new Error('ytsave did not expose the expected downloader');

    await downloader(url, { format, output });

    return {
        format,
        output,
        files: [...listFiles(output)].filter((file) => !before.has(file))
    };
}

/** Download a single YouTube video as mp4 (default) or mp3. */
function downloadVideo(url, options = {}) {
    return run(url, options, false);
}

/** Download every entry of a YouTube playlist. */
function downloadPlaylist(url, options = {}) {
    return run(url, options, true);
}

/** `ytsave` treats any URL carrying `list=` as a playlist. */
function isPlaylistUrl(url) {
    return /[?&]list=|[?&]playlist=/.test(String(url || ''));
}

/** Remove files produced by a download (WhatsApp has already been handed a copy). */
function cleanup(files) {
    for (const file of files || []) {
        try {
            fs.rmSync(file, { force: true });
        } catch {}
    }
}

/** Diagnostic snapshot for health/status commands. */
async function probe() {
    const ytDlpPath = await ensureYtDlp();
    prepareRuntimePath(ytDlpPath);
    const ffmpeg = resolveFfmpeg();

    return {
        ytDlp: Boolean(ytDlpPath),
        ytDlpPath: ytDlpPath || null,
        configFile: fs.existsSync(configPath()) ? configPath() : null,
        ffmpeg: Boolean(ffmpeg),
        ffmpegPath: ffmpeg ? ffmpeg.binary : null,
        outputDir: defaultOutputDir()
    };
}

module.exports = {
    downloadVideo,
    downloadPlaylist,
    isPlaylistUrl,
    cleanup,
    probe,
    ensureReady,
    defaultOutputDir
};
