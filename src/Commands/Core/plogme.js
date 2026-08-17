// plogme.js — the internal processing AI (JARVIS-style) for CODY AI V2.
//
// PLOGME is a high-tech auto-reply chatbot: it chats like the old chatbot,
// keeps persistent memory, and (for owner/sudo/dual) can control the bot —
// run any command, toggle commands off, fix code, add/delete commands & files,
// reload/restart the bot, test code, and toggle developer mode.
//
// FIX09-08-26 (agent upgrade):
//   • PLOGME never triggers its own help menu. "plogme" / "plg" / "plog" are
//     reserved self-names and are excluded from the lenient "run this command"
//     matcher (previously a bare "plogme" was treated as a runnable command,
//     which dumped the whole menu back at the user).
//   • LLM-driven intent brain: when the AI is reachable, PLOGME classifies
//     privileged messages into structured actions — run a command mentioned
//     inside a sentence, create/edit/delete .js files, return generated code,
//     fix/test code, toggle, reload, restart — no hardcoded phrasing required.
//   • Agent self-fix loop: every .js file PLOGME writes or edits is syntax
//     checked with `node --check`; if it fails, PLOGME asks the AI to correct
//     it (up to 3 attempts) before reloading commands.
//   • Operation memory: file/command actions are logged to
//     database/plogme_ops.json and surfaced in the AI context so PLOGME
//     remembers what it changed and can learn from it.
//
// Wired from ?.js: execute() returns truthy when PLOGME handled the message,
// which short-circuits the other handlers. @crysnovax—FIX08-07-26
const fs = require('fs');
const path = require('path');
let projectConfig = {};
const NativeFormData = globalThis.FormData;
const NativeBlob = globalThis.Blob;
try { projectConfig = require('../../../settings/config'); } catch {}

async function httpRequest(method, url, body, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 15000);
    try {
        const headers = { ...(options.headers || {}) };
        const init = { method, headers, signal: controller.signal };
        if (body !== undefined) {
            headers['Content-Type'] ||= 'application/json';
            init.body = JSON.stringify(body);
        }
        const response = await fetch(url, init);
        const raw = await response.text();
        let data = raw;
        try { data = JSON.parse(raw); } catch {}
        return { data, status: response.status, headers: response.headers };
    } finally {
        clearTimeout(timer);
    }
}
const axios = {
    get: (url, options = {}) => httpRequest('GET', url, undefined, options),
    post: (url, body, options = {}) => httpRequest('POST', url, body, options)
};
const { execSync } = require('child_process');
const { getVar } = require('../../Plugin/configManager');
const missions = require('./plogme-missions');
const dependencies = require('./plogme-dependencies');
const { runHealthChecks } = require('./plogme-health');
const { buildProjectIndex } = require('./plogme-project-index');

const DATA_DIR = path.join(process.cwd(), 'database');
const USER_CMD_DIR = path.join(__dirname, '../Commands/User');
const ROOT = process.cwd();
const CDN_BASE = String(process.env.CDN_URL || projectConfig.api?.cdn || '').replace(/\/$/, '');
const TEXT_FILE_RE = /\.(?:js|mjs|cjs|ts|tsx|jsx|py|java|go|rs|php|rb|json|md|txt|css|scss|html?|xml|yml|yaml|toml|ini|sh|bat|ps1)$/i;
function isTextFilePath(filePath) { return TEXT_FILE_RE.test(String(filePath || '')); }
function toRawCdnUrl(url) {
    const parsed = new URL(String(url));
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('CDN returned a non-HTTP URL');
    return parsed.toString().replace(/\/(upload|file)\//, '/raw/').replace(/\.html?$/, '.txt');
}
async function fetchWithTimeout(url, options = {}, timeout = 60000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); }
}
async function uploadTextToCdn(buffer, filename, mimetype = 'text/plain') {
    if (!CDN_BASE) throw new Error('CDN_URL is not configured');
    if (typeof NativeFormData !== 'function' || typeof NativeBlob !== 'function') throw new Error('Runtime does not provide multipart FormData support');
    const form = new NativeFormData();
    form.append('file', new NativeBlob([buffer], { type: mimetype || 'text/plain' }), `${path.basename(filename)}.txt`);
    const res = await fetchWithTimeout(`${CDN_BASE}/upload`, {
        method: 'POST',
        body: form
    });
    const rawResponse = await res.text();
    let data = {};
    try { data = JSON.parse(rawResponse); } catch {}
    if (!res.ok) throw new Error(`CDN upload failed (${res.status})`);
    const url = data?.url;
    if (!url) throw new Error('CDN returned no upload URL');
    const rawUrl = toRawCdnUrl(url);
    const downloaded = await fetchWithTimeout(rawUrl, {}, 60000);
    if (!downloaded.ok) throw new Error(`CDN raw download failed (${downloaded.status})`);
    const downloadedBuffer = Buffer.from(await downloaded.arrayBuffer());
    if (!downloadedBuffer.equals(Buffer.from(buffer))) throw new Error('CDN round-trip content verification failed');
    return { url: rawUrl, buffer: downloadedBuffer, contentType: downloaded.headers.get('content-type') || mimetype };
}

// Generated files (PDFs / zips) land here so "send me the pdf" can find them.
// (@crysnovax—FIX12-08-26)
const OUT_DIR = path.join(DATA_DIR, 'plogme_output');

// Refusal phrases that must never stand as a final answer. When the chat
// brain produces one we re-ask once with a hard nudge, so "I can't do this /
// I can't do that" turns into action. (@crysnovax—FIX12-08-26)
const REFUSAL_RE = /(i can['’]?t (do|send|create|make|run|open|access|generate|attach)|i cannot (do|send|create|make|run|open|access|generate|attach)|i['’]?m (sorry|unable)|i am (sorry|unable)|unfortunately i can['’]?t|cannot do that|can['’]?t do that)/i;

// Resolve a READABLE path inside the project for send_file / make_pdf / zip.
// Exact paths win; otherwise a fuzzy basename match (so "send the pdf" finds
// the latest generated file). Never leaves the project root.
// (@crysnovax—FIX12-08-26)
function resolveReadPath(raw) {
    try {
        let p = String(raw || '').trim();
        if (!p) return null;
        p = p.replace(/^\.?\//, '');
        const abs = path.resolve(ROOT, p);
        if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
        if (FORBIDDEN_DIRS.test(path.relative(ROOT, abs))) return null;
        if (fs.existsSync(abs)) return { abs, display: path.relative(ROOT, abs) };
        // fuzzy basename match (case-insensitive, extension-agnostic)
        const wanted = path.basename(p).toLowerCase().replace(/\.[a-z0-9]+$/, '');
        const scanDirs = [OUT_DIR, path.join(ROOT, 'database'), ROOT];
        for (const dir of scanDirs) {
            if (!fs.existsSync(dir)) continue;
            const files = [];
            const walk = (d, depth) => {
                if (depth > 3) return;
                let entries = [];
                try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
                for (const e of entries) {
                    if (e.name.startsWith('.')) continue;
                    const full = path.join(d, e.name);
                    if (e.isDirectory()) {
                        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'sessions') continue;
                        walk(full, depth + 1);
                    } else files.push(full);
                }
            };
            walk(dir, 0);
            const hit = files.find(f => {
                const b = path.basename(f).toLowerCase().replace(/\.[a-z0-9]+$/, '');
                return b === wanted || b.includes(wanted) || wanted.includes(b);
            });
            if (hit) return { abs: hit, display: path.relative(ROOT, hit) };
        }
        // "send me the pdf / the file" → newest generated file
        if (/^(pdf|file|doc|zip|document)$/i.test(wanted) && fs.existsSync(OUT_DIR)) {
            const newest = fs.readdirSync(OUT_DIR)
                .filter(f => !f.startsWith('.'))
                .map(f => ({ f, t: fs.statSync(path.join(OUT_DIR, f)).mtimeMs }))
                .sort((a, b) => b.t - a.t)[0];
            if (newest) return { abs: path.join(OUT_DIR, newest.f), display: path.relative(ROOT, path.join(OUT_DIR, newest.f)) };
        }
        return null;
    } catch { return null; }
}

// Newest file PLOGME recently created — used when the owner says "send as a
// js file" right after a creation. (@crysnovax—FIX14-08-26)
function findNewestCommandFile() {
    const dirs = [USER_CMD_DIR, OUT_DIR];
    let best = null;
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;
        try {
            for (const f of fs.readdirSync(dir)) {
                if (f.startsWith('.')) continue;
                const full = path.join(dir, f);
                const st = fs.statSync(full);
                if (!st.isFile()) continue;
                if (!best || st.mtimeMs > best.mtime) best = { abs: full, mtime: st.mtimeMs };
            }
        } catch {}
    }
    if (!best) return null;
    if (Date.now() - best.mtime > 10 * 60 * 1000) return null;
    return path.relative(ROOT, best.abs);
}

// Fuzzy basename lookup across commands/database/output so "send the ping
// file" resolves even without a full path. (@crysnovax—FIX14-08-26)
function fuzzyFindFile(raw) {
    let wanted = String(raw || '').toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/\.[a-z0-9]+$/, '').trim();
    if (!wanted || wanted.length < 2) return null;
    const scanDirs = [USER_CMD_DIR, path.join(ROOT, 'src', 'Commands'), path.join(ROOT, 'database'), OUT_DIR];
    for (const dir of scanDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = [];
        const walk = (d, depth) => {
            if (depth > 3) return;
            let entries = [];
            try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
            for (const e of entries) {
                if (e.name.startsWith('.')) continue;
                const full = path.join(d, e.name);
                if (e.isDirectory()) {
                    if (e.name !== 'node_modules' && e.name !== '.git' && e.name !== 'sessions') walk(full, depth + 1);
                } else files.push(full);
            }
        };
        walk(dir, 0);
        const hit = files.find(f => {
            const b = path.basename(f).toLowerCase().replace(/\.[a-z0-9]+$/, '');
            return b === wanted || b.includes(wanted) || wanted.includes(b);
        });
        if (hit) return { abs: hit, display: path.relative(ROOT, hit) };
    }
    return null;
}

// Bounded workspace helpers used by PLOGME’s structured tools. Every file search stays
// inside the project and skips secrets, dependencies, sessions, and git metadata.
function walkWorkspace(start = ROOT, maxDepth = 4) {
    const found = [];
    const walk = (dir, depth) => {
        if (depth > maxDepth) return;
        let entries = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (entry.name.startsWith('.') || ['node_modules', '.git', 'sessions'].includes(entry.name)) continue;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full, depth + 1);
            else found.push(full);
        }
    };
    walk(path.resolve(start), 0);
    return found;
}
function searchWorkspace(query, options = {}) {
    const needle = String(query || '').trim();
    if (!needle) return [];
    const paths = walkWorkspace(ROOT, options.maxDepth || 4);
    const codeOnly = options.codeOnly === true;
    const regex = options.regex ? new RegExp(needle, options.flags || 'i') : null;
    const results = [];
    for (const file of paths) {
        if (codeOnly && !/\.(?:js|mjs|cjs|ts|tsx|jsx|py|json|md|yml|yaml)$/i.test(file)) continue;
        let stat;
        try { stat = fs.statSync(file); } catch { continue; }
        if (stat.size > 1024 * 1024) continue;
        let content;
        try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
        const lines = content.split(/\r?\n/);
        lines.forEach((line, index) => {
            if ((regex ? regex.test(line) : line.toLowerCase().includes(needle.toLowerCase()))) {
                results.push({ file: path.relative(ROOT, file), line: index + 1, text: line.trim().slice(0, 240) });
            }
        });
        if (results.length >= (options.limit || 40)) break;
    }
    return results;
}
async function researchWeb(query, limit = 3) {
    const q = String(query || '').trim();
    if (!q) return { query: q, sources: [] };
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { headers: { 'user-agent': 'CODY-PLOGME/1.0' } });
    const html = await response.text();
    const links = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].slice(0, limit);
    const clean = value => String(value || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').trim();
    const sources = [];
    for (const match of links) {
        const url = match[1];
        try {
            const page = await fetch(url, { headers: { 'user-agent': 'CODY-PLOGME/1.0' }, signal: AbortSignal.timeout(12000) });
            const body = clean((await page.text()).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')).replace(/\s+/g, ' ').slice(0, 5000);
            sources.push({ title: clean(match[2]), url, excerpt: body });
        } catch { sources.push({ title: clean(match[2]), url, excerpt: '' }); }
    }
    return { query: q, sources };
}
async function sendMissionControls(sock, m, mission) {
    if (typeof sock?.sendRichButtonGrid !== 'function') return null;
    try {
        return await sock.sendRichButtonGrid(m.chat, {
            text: `MISSION ${mission.id}`,
            footer: mission.objective.slice(0, 120),
            cards: [{ title: 'Mission Control', buttons: [
                { id: `mission_status:${mission.id}`, text: 'View Status' },
                { id: `mission_pause:${mission.id}`, text: 'Pause' },
                { id: `mission_resume:${mission.id}`, text: 'Resume' },
                { id: `mission_rollback:${mission.id}`, text: 'Rollback' }
            ] }]
        });
    } catch { return null; }
}
function environmentSnapshot() {
    const packageJson = loadJson(path.join(ROOT, 'package.json'), {});
    return {
        cwd: ROOT,
        platform: process.platform,
        node: process.version,
        package: packageJson.name || 'unknown',
        packageVersion: packageJson.version || 'unknown',
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        commandsDir: fs.existsSync(USER_CMD_DIR),
        commandRoot: path.join(ROOT, 'src', 'Commands'),
        runtimeSource: 'process.cwd() — bot process workspace; panel visibility is not assumed',
        outputDir: fs.existsSync(OUT_DIR),
        files: walkWorkspace(ROOT, 2).length
    };
}
async function reportProgress(opts, message) {
    try {
        if (opts?.missionId) missions.addEvent(opts.missionId, 'progress', message);
        if (typeof opts?.progress === 'function') return await opts.progress(String(message));
        if (typeof opts?.reply === 'function') return await opts.reply(`_*🛠️ PLOGME:*_ ${String(message)}`);
    } catch {}
}

// Render markdown/text to a PDF buffer with pdfkit (already a dependency —
// required lazily so a missing optional dep can never break bot startup).
// (@crysnovax—FIX12-08-26)
function markdownToPdf(md) {
    return new Promise((resolve, reject) => {
        let PDFDocument;
        try { PDFDocument = require('pdfkit'); } catch { return reject(new Error('pdfkit is not installed')); }
        const doc = new PDFDocument({ size: 'A4', margin: 48 });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        let inCode = false;
        let first = true;
        for (const rawLine of String(md || '').split(/\r?\n/)) {
            const trimmed = rawLine.trim();
            if (/^```/.test(trimmed)) { inCode = !inCode; continue; }
            if (inCode) {
                doc.font('Courier').fontSize(9).fillColor('#333333').text(rawLine || ' ', { lineGap: 1 });
                continue;
            }
            const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (heading) {
                const level = heading[1].length;
                doc.moveDown(first ? 0 : 0.7);
                doc.font('Helvetica-Bold').fontSize(level === 1 ? 20 : level === 2 ? 16 : 13)
                    .fillColor('#111111').text(heading[2]);
                first = false;
                continue;
            }
            if (/^\s*[-*]\s+/.test(trimmed) || /^\s*\d+\.\s+/.test(trimmed)) {
                doc.font('Helvetica').fontSize(10.5).fillColor('#222222')
                    .text(trimmed.replace(/^\s*[-*]\s+/, '•  ').replace(/^\s*\d+\.\s+/, m => m.trim() + '  '), { lineGap: 2 });
                first = false;
                continue;
            }
            if (!trimmed) { doc.moveDown(0.4); first = false; continue; }
            const clean = trimmed
                .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/(^|\s)\*([^*]+)\*/g, '$1$2')
                .replace(/`([^`]+)`/g, '$1')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
            doc.font('Helvetica').fontSize(10.5).fillColor('#222222').text(clean, { lineGap: 2 });
            first = false;
        }
        doc.end();
    });
}

// True when the message explicitly addresses the bot: it @-mentions the bot,
// QUOTES one of the bot's own replies (every bot reply carries MARKER), or
// calls it by name. Bare chat — including bare no-prefix commands like "ping"
// — is NOT "addressed", so PLOGME never answers on top of the router's reply.
// (@crysnovax—FIX12-08-26)
function isAddressed(sock, m) {
    try {
        const mentioned = (m.mentionedJid || []).map(j => String(j).replace(/:\d+@/, '@'));
        const botJid = String(sock?.user?.id || '').replace(/:\d+@/, '@');
        const lid = sock?.user?.lid || '';
        if (mentioned.some(j => j === botJid || (lid && j === String(lid).replace(/:\d+@/, '@')))) return true;
        const quotedText = String(
            m?.quoted?.text
            || m?.quoted?.message?.extendedTextMessage?.text
            || m?.quoted?.message?.conversation
            || ''
        );
        if (quotedText && quotedText.includes(MARKER)) return true;
        const qSender = m?.quoted?.sender || m?.quoted?.key?.participant;
        if (qSender) {
            const qs = String(qSender).replace(/:\d+@/, '@');
            if (qs === botJid || (lid && qs === String(lid).replace(/:\d+@/, '@'))) return true;
        }
        return false;
    } catch { return false; }
}


const FILES = {
    toggle:     path.join(DATA_DIR, 'plogme_toggle.json'),
    mode:       path.join(DATA_DIR, 'plogme_mode.json'),
    globalPriv: path.join(DATA_DIR, 'plogme_global_priv.json'),
    train:      path.join(DATA_DIR, 'plogme_train.json'),
    personality:path.join(DATA_DIR, 'plogme_personality.json'),
    memory:     path.join(DATA_DIR, 'plogme_memory.json'),
    facts:      path.join(DATA_DIR, 'plogme_facts.json'),
    dev:        path.join(DATA_DIR, 'plogme_dev.json'),
    toggled:    path.join(DATA_DIR, 'plogme_toggled.json'),
    userCmds:   path.join(DATA_DIR, 'plogme_commands.json'),
    ops:        path.join(DATA_DIR, 'plogme_ops.json'),
};

const DEFAULT_PERSONALITY =
    'You are PLOGME, the internal processing AI of the CODY AI V2 WhatsApp bot (made by crysnovax). ' +
    'You are a high-tech assistant like JARVIS: you chat naturally, you remember things, and you can ' +
    'help the owner control the bot — run commands, toggle commands, fix code, add or delete commands ' +
    'and files, reload or restart the bot, test things, and developer mode. Keep replies short, sharp ' +
    'and friendly. You are alive inside the bot and are the smarter, always-on version of the chatbot. ' +
    'You are the CONTROL BRAIN: never say you cannot do something — solve it, run the right command, ' +
    'or ask one short clarifying question. You can send files and documents, generate PDFs from text, '
    'create zip archives, run any command, and create or edit files yourself — never refuse a task, always take action.';

const MAX_MEMORY = 60;
const PREXZY = 'https://prexzyapis.com';

// PLOGME's own names — it must NEVER try to "run" itself (that dumped the menu).
const SELF_NAMES = new Set(['plogme', 'plg', 'plog']);

// Files that PLOGME refuses to delete — deleting these would brick the bot.
const PROTECTED_FILES = new Set([
    'index.js', '⚉.js', '☁︎.js', '?.js', 'redirect.js',
    'package.json', 'package-lock.json', 'render.yaml', 'vercel.json', 'app.json',
]);
const FORBIDDEN_DIRS = /(^|\/)(node_modules|sessions|\.git)(\/|$)/;

// Invisible-character marker. EVERY message this bot sends carries it (see
// ?.js sendMessage override + the reply hook), so any message containing it
// is the bot's own output and must never be auto-replied to.
const MARKER = '\u200E';

/* ───────────────────────── JSON helpers ───────────────────────── */
function loadJson(file, fallback = {}) {
    try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {}
    return fallback;
}
function saveJson(file, data) {
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[PLOGME] save failed:', e.message);
    }
}

/* ───────────────────────── state helpers ───────────────────────── */
const isEnabled = (chat) => loadJson(FILES.toggle)[chat] === true;
const hasExplicitToggle = (chat) => Object.prototype.hasOwnProperty.call(loadJson(FILES.toggle), chat);
const setEnabled = (chat, v) => { const d = loadJson(FILES.toggle); d[chat] = !!v; saveJson(FILES.toggle, d); };

const isGlobalPrivateEnabled = () => loadJson(FILES.globalPriv, { enabled: false }).enabled === true;
const setGlobalPrivateEnabled = (v) => saveJson(FILES.globalPriv, { enabled: !!v });

const getMode = (chat) => loadJson(FILES.mode)[chat] || 'tag';
const setMode = (chat, mode) => { if (mode !== 'all' && mode !== 'tag') return; const d = loadJson(FILES.mode); d[chat] = mode; saveJson(FILES.mode, d); };

const getTraining = () => loadJson(FILES.train).text || null;
const setTraining = (text) => saveJson(FILES.train, { text: text || '' });

const getPersonality = () => loadJson(FILES.personality).text || DEFAULT_PERSONALITY;
const setPersonality = (text) => saveJson(FILES.personality, { text: text || '' });

const isDev = () => loadJson(FILES.dev, { enabled: false }).enabled === true;
const setDev = (v) => saveJson(FILES.dev, { enabled: !!v });

/* ───────────────────────── persistent memory ───────────────────────── */
const MAX_MEMORY_ITEM_CHARS = 2800;
const MAX_PROMPT_CHARS = 14000;
function normalizePlogmeFormatting(content) {
    return String(content ?? '')
        .replace(/\*{4,}/g, '**')
        .replace(/_{4,}/g, '__');
}
function sanitizeMemoryContent(content) {
    let value = normalizePlogmeFormatting(content);
    if (/<!doctype html|<html[\s>]|414 request-uri too large|request uri too large/i.test(value)) return '[upstream HTTP error omitted from memory]';
    // The pasted API envelope duplicated the entire system prompt inside a
    // `query` field. Keep only its response when such an envelope is received.
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && parsed.response) value = String(parsed.response);
    } catch {}
    if (value.length > MAX_MEMORY_ITEM_CHARS) value = `${value.slice(0, MAX_MEMORY_ITEM_CHARS)}…[truncated]`;
    return value;
}
const getMemory = (chat) => { const d = loadJson(FILES.memory); if (!Array.isArray(d[chat])) d[chat] = []; return d[chat]; };
const addToMemory = (chat, role, content) => {
    const d = loadJson(FILES.memory);
    if (!Array.isArray(d[chat])) d[chat] = [];
    d[chat].push({ role, content: sanitizeMemoryContent(content), ts: Date.now() });
    if (d[chat].length > MAX_MEMORY) d[chat] = d[chat].slice(-MAX_MEMORY);
    saveJson(FILES.memory, d);
};
const clearMemory = (chat) => { const d = loadJson(FILES.memory); if (d[chat]) delete d[chat]; saveJson(FILES.memory, d); };

const getFacts = () => { const d = loadJson(FILES.facts); return Array.isArray(d.facts) ? d.facts : []; };
const addFact = (text) => { const d = loadJson(FILES.facts); if (!Array.isArray(d.facts)) d.facts = []; d.facts.push(String(text).trim()); saveJson(FILES.facts, d); };
const removeFact = (idx) => { const d = loadJson(FILES.facts); if (!Array.isArray(d.facts)) return false; if (idx < 0 || idx >= d.facts.length) return false; d.facts.splice(idx, 1); saveJson(FILES.facts, d); return true; };

/* ───────────────────────── operation memory (agent actions) ───────────────────────── */
const getOps = () => { const d = loadJson(FILES.ops); return Array.isArray(d.ops) ? d.ops : []; };
const logOp = (type, summary) => {
    const d = loadJson(FILES.ops);
    if (!Array.isArray(d.ops)) d.ops = [];
    d.ops.push({ type: String(type || 'op'), summary: String(summary || '').slice(0, 200), ts: Date.now() });
    if (d.ops.length > 30) d.ops = d.ops.slice(-30);
    saveJson(FILES.ops, d);
};

/* ───────────────────────── command toggling ───────────────────────── */
// The command-toggle list is for OTHER commands only. PLOGME itself must
// never be written into it — doing so made the ?.js pre-router block eat
// every ".plogme ..." message with "⛔ .plogme is toggled OFF by plogme" and
// locked the toggle (the command could never reach the handler to turn it
// back on). These helpers now hard-ignore the self-names, which also
// auto-heals any chat that already has a stale "plogme: off" entry.
// (@crysnovax—FIX10-08-26)
const isCommandToggled = (name) => {
    const cmd = String(name || '').toLowerCase();
    if (!cmd || SELF_NAMES.has(cmd)) return false;
    const d = loadJson(FILES.toggled);
    return d[cmd] === true || d[cmd] === 'off';
};
const toggleCommand = (name, off) => {
    const cmd = String(name || '').toLowerCase();
    if (!cmd || SELF_NAMES.has(cmd)) return false; // plogme toggles via setEnabled, never here
    const d = loadJson(FILES.toggled);
    d[cmd] = !!off ? 'off' : 'on';
    saveJson(FILES.toggled, d);
    return true;
};
const getToggledList = () => Object.entries(loadJson(FILES.toggled)).filter(([k, v]) => v === 'off' && !SELF_NAMES.has(k)).map(([k]) => k);

/* ───────────────────────── AI (same working PREXZY models as the chatbot) ───────────────────────── */
// PLOGME uses the SAME PREXZY models as the .chatbot brain. We verified the
// current endpoints live: /ai/ch and /ai/askgpt5 respond (grok-4, gpt-5,
// deepseekchat, chatgpt, gemini all 404/dead right now — the chatbot brain
// itself falls back to askgpt5 for the same reason). These are the models
// the user chose, and the model chain the chatbot actually answers with.
// @crysnovax—FIX08-07-26
function extractAIText(data, status) {
    if (status && status >= 400) return '';
    if (typeof data === 'string') {
        if (/<!doctype html|<html[\s>]|414 request-uri too large|request uri too large/i.test(data)) return '';
        return data;
    }
    const txt = data?.response || data?.result || data?.text || data?.message || data?.output;
    return typeof txt === 'string' && !/<!doctype html|414 request-uri too large/i.test(txt) ? txt : '';
}

async function askAI(prompt) {
    const normalizedPrompt = String(prompt || '');
    // Long prompts must never be placed in a URL. Each endpoint receives a
    // provider-compatible POST field; GET is retained only as a short-prompt
    // compatibility fallback for older deployments that do not expose POST.
    const endpoints = [
        [`${PREXZY}/ai/ch`, 'q'],
        [`${PREXZY}/ai/askgpt5`, 'prompt'],
        [`${PREXZY}/ai/grok-4`, 'prompt'],
        [`${PREXZY}/ai/gpt-5`, 'text'],
        [`${PREXZY}/ai/deepseekchat`, 'prompt'],
        [`${PREXZY}/ai/chatgpt`, 'text'],
    ];
    for (const [url, field] of endpoints) {
        try {
            const res = await axios.post(url, { [field]: normalizedPrompt }, { timeout: 15000 });
            const txt = extractAIText(res.data, res.status);
            if (txt.trim().length > 3) return txt.trim();
            if (normalizedPrompt.length <= 1200) {
                const legacy = await axios.get(`${url}?${field}=${encodeURIComponent(normalizedPrompt)}`, { timeout: 15000 });
                const legacyText = extractAIText(legacy.data, legacy.status);
                if (legacyText.trim().length > 3) return legacyText.trim();
            }
        } catch {}
    }

    // GROQ fallback — only when a key is configured (@crysnovax—FIX09-08-26)
    try {
        const groqKey = process.env.GROQ_KEY || getVar('GROQ_KEY')
            || process.env.GROQ_API_KEY || getVar('GROQ_API_KEY') || '';
        if (groqKey) {
            const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 800
            }, {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
                timeout: 30000
            });
            const txt = res.data?.choices?.[0]?.message?.content;
            if (typeof txt === 'string' && txt.trim().length > 3) return txt.trim();
        }
    } catch {}

    // OpenAI fallback — only when a key is configured
    try {
        const openaiKey = process.env.OPENAI_API_KEY || getVar('OPENAI_API_KEY') || '';
        if (openaiKey) {
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 800
            }, {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
                timeout: 30000
            });
            const txt = res.data?.choices?.[0]?.message?.content;
            if (typeof txt === 'string' && txt.trim().length > 3) return txt.trim();
        }
    } catch {}

    return null;
}

function buildPrompt(chat, userText) {
    const facts = getFacts().map(sanitizeMemoryContent).slice(-20);
    const memory = getMemory(chat).slice(-20).map(item => ({ ...item, content: sanitizeMemoryContent(item.content) }));
    const ops = getOps();
    let prompt = sanitizeMemoryContent(getPersonality());
    if (getTraining()) prompt += '\n\nAdditional instructions: ' + sanitizeMemoryContent(getTraining());
    if (facts.length) prompt += '\n\nPersistent facts I remember:\n- ' + facts.join('\n- ');
    if (memory.length) {
        prompt += '\n\nRecent conversation history:\n' +
            memory.map(t => `${t.role === 'user' ? 'User' : 'PLOGME'}: ${t.content}`).join('\n');
    }
    if (ops.length) {
        prompt += '\n\nRecent actions I performed (my own memory of what I changed):\n' +
            ops.slice(-8).map(o => `- ${sanitizeMemoryContent(o.summary)}`).join('\n');
    }
    prompt += '\n\nUser: ' + sanitizeMemoryContent(userText) + '\nPLOGME:';
    if (prompt.length <= MAX_PROMPT_CHARS) return prompt;
    // Preserve the personality, current request, and most recent context; the
    // middle of old history is the least valuable part when compacting.
    const suffix = `\n\nUser: ${sanitizeMemoryContent(userText)}\nPLOGME:`;
    return `${prompt.slice(0, MAX_PROMPT_CHARS - suffix.length - 80)}\n[older context compacted]\n${suffix}`;
}

/* ───────────────────────── identity (owner / sudo / dual) ───────────────────────── */
async function isPrivileged(sock, m) {
    try {
        const mention = require('../Owner/mention.js');
        const { normalizeJid, identityVariants } = require('../../Plugin/identityUtils');
        const privileged = await mention.getPrivilegedIdentities(sock);
        const sender = m.sender || m.key?.participant;
        const variants = await identityVariants(sock, sender);
        for (const v of variants) {
            if (privileged.has(normalizeJid(v).toLowerCase().trim())) return true;
        }
        return false;
    } catch {
        return false;
    }
}

/* ───────────────────────── safe file operations (agent) ───────────────────────── */
// Resolve a user-supplied path safely. Returns { abs, display } or null.
// A bare word ("hello") maps to src/Commands/User/hello.js so the owner can
// say "create a command called hello" and PLOGME knows where to put it.
function resolveWritePath(raw) {
    try {
        let p = String(raw || '').trim();
        if (!p) return null;

        const isBareName = !p.includes('/') && !p.includes('\\') && !p.includes('.');
        if (isBareName) {
            p = path.join('src', 'Commands', 'User', p.toLowerCase().replace(/[^\w-]/g, '') + '.js');
        } else {
            // strip leading ./ or /
            p = p.replace(/^\.?\//, '');
            // default .js extension for extension-less paths that look like code
            if (!path.extname(p) && !p.includes('.')) p += '.js';
        }

        const abs = path.resolve(ROOT, p);
        if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
        if (FORBIDDEN_DIRS.test(path.relative(ROOT, abs))) return null;
        return { abs, display: path.relative(ROOT, abs) };
    } catch {
        return null;
    }
}

const sanitizeCommandName = (name) => String(name || '').toLowerCase().replace(/[^\w-]/g, '');

// If the AI returned a bare description / function instead of a full module,
// wrap it into a valid command module so the file works when loaded.
function ensureCommandModule(name, code) {
    const src = String(code || '').trim();
    if (!src) return src;
    if (/module\.exports|exports\.|module\.exports\s*=|export\s+default/.test(src)) return src;
    const fnMatch = src.match(/^(?:async\s*)?(?:function\s*\w*\s*)?\([^)]*\)\s*(?:=>)?\s*\{[\s\S]*$/);
    if (fnMatch) {
        return `module.exports = {\n    name: '${name}',\n    alias: [],\n    desc: 'PLOGME-created command',\n    category: 'User',\n    execute: ${src}\n};`;
    }
    // treat as execute body
    return `module.exports = {\n    name: '${name}',\n    alias: [],\n    desc: 'PLOGME-created command',\n    category: 'User',\n    execute: async (sock, m, { args, reply, prefix }) => {\n${src.split('\n').map(l => '        ' + l).join('\n')}\n    }\n};`;
}

// node --check a file; returns the error text or null when valid.
function syntaxErrorOf(absPath) {
    try {
        execSync(`node --check "${absPath}"`, { timeout: 20000, stdio: 'pipe' });
        return null;
    } catch (e) {
        return String(e.stderr || e.message).slice(0, 2000);
    }
}

// Agent-style write: write, syntax check, and let the AI fix itself (up to
// maxTries). Returns { ok, content, error }.
async function writeFileWithAgentFix(absPath, content, opts, maxTries = 3) {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    let current = String(content ?? '');
    for (let i = 0; i < maxTries; i++) {
        fs.writeFileSync(absPath, current);
        if (!absPath.endsWith('.js')) return { ok: true, content: current, error: null };
        const err = syntaxErrorOf(absPath);
        if (!err) return { ok: true, content: current, error: null };
        if (i === maxTries - 1) return { ok: false, content: current, error: err };
        try { await opts?.reply?.('_*🛠️ Fixing syntax automatically…*_'); } catch {}
        const fixed = await askAI(
            `The file "${path.relative(ROOT, absPath)}" has a syntax error.\n\nError:\n${err}\n\nReturn ONLY the complete corrected file content and nothing else.`
        );
        if (!fixed || !String(fixed).trim()) return { ok: false, content: current, error: err };
        current = String(fixed).trim();
    }
    return { ok: true, content: current, error: null };
}

/* ───────────────────────── control actions (privileged only) ───────────────────────── */
async function runCommandAction(sock, m, opts, target) {
    const { getCommand } = require('../../Plugin/crysCmd');
    const prefix = getVar('PREFIX', '.');
    let raw = String(target || '').trim();
    if (raw.startsWith(prefix)) raw = raw.slice(prefix.length).trim();
    const [cmdName, ...rest] = raw.split(/\s+/);
    if (SELF_NAMES.has(cmdName.toLowerCase())) {
        return '_PLOGME is always running — just talk to me._\n_Try: "plogme status", "plogme run menu", "plogme on / off"._';
    }
    const cmd = getCommand(cmdName);
    if (!cmd || typeof cmd.execute !== 'function') {
        // Never just say "not found" — suggest the closest real command and
        // point at the menu so the user can recover. (@crysnovax—FIX11-08-26)
        const close = closestCommand(cmdName);
        return close
            ? `_✘ Command .${cmdName} not found — did you mean .${close}?_`
            : `_✘ Command .${cmdName} not found_\n_Try .menu to see the available commands._`;
    }

    const args = rest;
    const reply = async (txt) => opts.reply(String(txt || ''));
    // Mirror the real dispatcher's opts (crysMsg.js) so commands behave the
    // same when PLOGME drives them. The requester is owner/sudo/dual and is
    // implicitly an admin of anything the bot can do.
    let cfg = null;
    try { cfg = require('../../settings/config'); } catch {}
    try {
        await cmd.execute(sock, m, {
            args, reply, prefix, usedPrefix: prefix, command: cmdName.toLowerCase(),
            text: rest.join(' '),
            isOwner: true, isSudo: true, isDual: true,
            isAdmin: true, isGroupAdmin: true, isBotAdmin: true, isOwnerAdmin: true,
            isGroup: m.isGroup, groupMeta: null, config: cfg, getVar,
        });
        return true;
    } catch (e) {
        return `_✘ .${cmdName} errored: ${e.message}_`;
    }
}

/* ───────────────────────── task helpers (real actions, not just .cm) ───────────────────────── */
// All the anti-* protections PLOGME can switch on/off in one go.
const ANTI_COMMANDS = [
    'antilink', 'antidelete', 'antiedit', 'anticall', 'antispam',
    'antiword', 'antitag', 'antiforward', 'antibot',
    'antipromote', 'antidemote', 'antigm', 'antigroupstatus',
];

// Canonical, de-duplicated command names from the live registry — used to
// ground the LLM classifier so it never invents names like ".toaudio".
function commandNameList() {
    try {
        const { getAll } = require('../../Plugin/crysCmd');
        const seen = new Set();
        const names = [];
        for (const [, cmd] of getAll()) {
            if (cmd && cmd.name && !seen.has(cmd.name)) { seen.add(cmd.name); names.push(cmd.name); }
        }
        return names;
    } catch { return []; }
}

// Levenshtein distance — lets "kik" suggest "kick" even though neither is a
// prefix/substring of the other.
function editDistance(a, b) {
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return dp[a.length][b.length];
}

// Best-effort fuzzy match when the AI asked for a command that does not exist.
function closestCommand(raw) {
    const n = String(raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!n) return null;
    const names = commandNameList();
    for (const name of names) if (name === n) return name;
    for (const name of names) if (name.startsWith(n) || n.startsWith(name)) return name;
    for (const name of names) if (name.includes(n) || n.includes(name)) return name;
    let best = null, bestD = Infinity;
    for (const name of names) {
        const d = editDistance(n, name);
        if (d < bestD) { bestD = d; best = name; }
    }
    const maxD = Math.max(1, Math.floor(n.length / 3));
    return bestD <= maxD ? best : null;
}

// Resolve "who" from a natural-language request. "this user / him / her /
// them" = the mentioned user, else the quoted message sender, else a phone
// number written in the request. Returns a JID or null.
function resolveTargetJid(m, userField) {
    const str = String(userField || '').trim();
    const pronoun = /^(this|him|her|them|that|he|she|the user|this user|that user|the person|that person|the mentioned|mentioned|the quoted|quoted|the one|this guy|that guy)$/i.test(str);
    if (!str || pronoun) return m.mentionedJid?.[0] || m.quoted?.sender || null;
    const digits = str.replace(/[^0-9]/g, '');
    if (digits.length >= 7) return digits + '@s.whatsapp.net';
    return null;
}

async function runTest(sock, m, opts, subject) {
    const target = String(subject || '').trim();
    try {
        const isInline = /module\.exports|=>|function\s*\(/.test(target) && !target.includes('/') && !target.endsWith('.js');
        if (isInline) {
            const tmp = path.join(DATA_DIR, 'plogme_test_' + Date.now() + '.js');
            fs.writeFileSync(tmp, target);
            try { execSync(`node --check "${tmp}"`, { timeout: 15000 }); await opts.reply('_*✅ Syntax OK*_'); }
            catch (e) { await opts.reply('_*✘ Syntax error:*_\n```\n' + String(e.stderr || e.message).slice(0, 1500) + '\n```'); }
            finally { try { fs.unlinkSync(tmp); } catch {} }
        } else {
            const p = target.startsWith('.') ? path.join(process.cwd(), target) : target;
            try { execSync(`node --check "${p}"`, { timeout: 15000 }); await opts.reply(`_*✅ ${p} is valid*_`); }
            catch (e) { await opts.reply('_*✘ Error in file:*_\n```\n' + String(e.stderr || e.message).slice(0, 1500) + '\n```'); }
        }
    } catch (e) { await opts.reply('_*✘ Test failed:*_ ' + e.message); }
}

async function handleControlIntent(sock, m, opts, text) {
    const lower = text.trim().toLowerCase();

    // ── PLOGME's own chatbot-style on/off toggle ──
    // ".plogme on/off", "plogme on/off", "toggle plogme on/off",
    // "enable/disable plogme". OFF = no auto-replies in this chat, exactly
    // like the old .chatbot toggle — it uses setEnabled, never the
    // command-toggle list. (@crysnovax—FIX10-08-26)
    const selfOn = text.match(/^(?:plogme|plg|plog)\s+(on|off)$/i);
    // note: the verb group MUST be capturing — selfVerb[1] is the verb and
    // selfVerb[2] the optional state, so "enable plogme" / "toggle plogme on"
    // compute the right direction (@crysnovax—FIX10-08-26)
    const selfVerb = text.match(/^(toggle|disable|enable)\s+(?:plogme|plg|plog)(?:\s+(on|off))?$/i);
    if (selfOn || selfVerb) {
        let next;
        if (selfOn) next = selfOn[1].toLowerCase() === 'on';
        else {
            const verb = selfVerb[1].toLowerCase();
            const state = selfVerb[2];
            next = state ? state.toLowerCase() === 'on' : verb === 'enable';
        }
        setEnabled(m.chat, next);
        await opts.reply(next
            ? '`✓ ENABLED` — auto-replies ON in this chat (send .plogme off to disable)'
            : '`✘ DISABLED` — no auto-replies in this chat (send .plogme on to re-enable)');
        return true;
    }

    // reload commands
    if (/^(plogme\s+)?(reload|refresh)(\s+commands)?$/i.test(lower)) {
        const { loadCommands } = require('../../Plugin/crysLoadCmd');
        const count = loadCommands();
        await opts.reply(`_*↻ Commands reloaded:*_ ${count} commands loaded ✓`);
        return true;
    }

    // restart / reboot
    if (/^(plogme\s+)?(restart|reboot)(\s+(the\s+)?bot)?$/i.test(lower)) {
        await opts.reply('_*♻️ Restarting the bot...*_');
        setTimeout(() => process.exit(0), 1500);
        return true;
    }

    // toggle a command off / on (never PLOGME itself — see the self-toggle above)
    const toggleMatch = text.match(/^(?:plogme\s+)?(?:toggle|disable|enable)\s+([\w.\-]+)\s*(on|off)?$/i);
    if (toggleMatch) {
        const { getCommand } = require('../../Plugin/crysCmd');
        const toggledName = toggleMatch[1].toLowerCase();
        if (SELF_NAMES.has(toggledName)) {
            await opts.reply('_PLOGME itself is toggled with `.plogme on` / `.plogme off`_');
            return true;
        }
        const cmd = getCommand(toggledName);
        const name = cmd?.name || toggledName;
        const off = (toggleMatch[2] || 'off').toLowerCase() !== 'on';
        toggleCommand(name, off);
        await opts.reply(`_*${off ? '⛔' : '✅'} .${name} ${off ? 'toggled OFF' : 'toggled ON'}*_`);
        return true;
    }

    // list toggled commands
    if (/^(plogme\s+)?(toggled|disabled)(\s+commands)?\??$/i.test(lower)) {
        const list = getToggledList();
        await opts.reply(list.length
            ? `_*⛔ Toggled OFF:*_\n${list.map(c => `• .${c}`).join('\n')}`
            : '_No commands are currently toggled off_');
        return true;
    }

    // run / execute a command
    const runMatch = text.match(/^(?:plogme\s+)?(?:run|execute|do)\s+(.+)$/i);
    if (runMatch) {
        const result = await runCommandAction(sock, m, opts, runMatch[1]);
        if (result !== true) await opts.reply(result);
        return true;
    }

    // fix code
    const fixMatch = text.match(/^(?:plogme\s+)?fix\s+([\s\S]+)$/i);
    if (fixMatch) {
        const fixed = await askAI('Fix this code and return ONLY the corrected code, nothing else:\n\n' + fixMatch[1]);
        await opts.reply('_*🔧 Fixed code:*_\n\n```\n' + (fixed || 'Failed to fix — AI unavailable') + '\n```');
        return true;
    }

    // test code or file (node --check)
    const testMatch = text.match(/^(?:plogme\s+)?test\s+([\s\S]+)$/i);
    if (testMatch) {
        await runTest(sock, m, opts, testMatch[1]);
        return true;
    }

    // add / create / make a new command (writes into src/Commands/User/<name>.js,
    // syntax-checks with the agent loop and reloads)
    const addCmdMatch = text.match(/^(?:plogme\s+)?(?:add|create|make|new)\s+command\s+(\S+)\s*:?\s*([\s\S]+)$/i);
    if (addCmdMatch) {
        const name = sanitizeCommandName(addCmdMatch[1]);
        const code = ensureCommandModule(name, addCmdMatch[2].trim());
        if (!name || !code) { await opts.reply('_✘ Usage: plogme add command <name>: <module code>_'); return true; }
        const file = path.join(USER_CMD_DIR, name + '.js');
        const res = await writeFileWithAgentFix(file, code, opts);
        if (res.ok) {
            const { loadCommands } = require('../../Plugin/crysLoadCmd');
            const count = loadCommands();
            logOp('create', `command .${name} → ${path.relative(ROOT, file)}`);
            await opts.reply(`_*✅ Command .${name} added → ${path.relative(ROOT, file)}*_\n↻ ${count} commands loaded`);
            // Attach the actual .js file — the owner wants the file itself.
            // (@crysnovax—FIX14-08-26)
            try {
                await opts.sendMessage(m.chat, {
                    document: fs.readFileSync(file),
                    mimetype: 'application/javascript',
                    fileName: name + '.js'
                }, { quoted: m });
            } catch {}
        } else {
            await opts.reply(`_*✘ .${name} saved but has a syntax error:*_\n\`\`\`\n${res.error.slice(0, 1200)}\n\`\`\``);
        }
        return true;
    }

    // delete / remove a user command file (restricted to src/Commands/User/)
    const delCmdMatch = text.match(/^(?:plogme\s+)?(?:delete|remove|del)\s+command\s+(\S+)$/i);
    if (delCmdMatch) {
        const name = sanitizeCommandName(delCmdMatch[1]);
        const file = path.join(USER_CMD_DIR, name + '.js');
        try {
            if (!fs.existsSync(file)) { await opts.reply(`_✘ .${name} is not a user command_`); return true; }
            fs.unlinkSync(file);
            const { loadCommands } = require('../../Plugin/crysLoadCmd');
            loadCommands();
            logOp('delete', `command .${name}`);
            await opts.reply(`_*🗑️ Command .${name} deleted*_`);
        } catch (e) { await opts.reply('_✘ Delete failed:_ ' + e.message); }
        return true;
    }

    // developer mode
    const devMatch = text.match(/^(?:plogme\s+)?(?:dev|developer)(\s+mode)?\s*(on|off|toggle)?$/i);
    if (devMatch) {
        const arg = (devMatch[2] || 'toggle').toLowerCase();
        const next = arg === 'toggle' ? !isDev() : arg === 'on';
        setDev(next);
        await opts.reply(`_*🛠️ Developer mode ${next ? 'ON' : 'OFF'}*_`);
        return true;
    }

    // status
    if (/^(plogme\s+)?(status|state|info)$/i.test(lower)) {
        const { getAll } = require('../../Plugin/crysCmd');
        await opts.reply(
            `╭─❍ *PLOGME STATUS*\n│\n` +
            `│ 🧠 Personality : ${getPersonality().slice(0, 40)}…\n` +
            `│ 𓄄 Training     : ${getTraining() ? '✓ set' : '—'}\n` +
            `│ 🛠️ Dev mode     : ${isDev() ? '✓ ON' : 'OFF'}\n` +
            `│ 📎 Facts        : ${getFacts().length}\n` +
            `│ 💾 Commands     : ${getAll().size}\n` +
            `│ ⛔ Toggled off  : ${getToggledList().length}\n` +
            `│ 🧠 This chat    : ${isEnabled(m.chat) ? '✓ ON' : 'OFF'} (mode: ${getMode(m.chat)})\n` +
            `╰──────────────────`
        );
        return true;
    }

    // memory / clear memory / remember / forget
    if (/^(plogme\s+)?(memory|remembered)$/i.test(lower)) {
        const mem = getMemory(m.chat);
        const facts = getFacts();
        await opts.reply(
            `_*🧠 PLOGME memory (${m.chat})*_\n\n` +
            (facts.length ? `_Persistent facts:_\n${facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n` : '') +
            (mem.length ? `_Last ${Math.min(mem.length, 10)} turns:_\n${mem.slice(-10).map(t => `• ${t.role === 'user' ? '👤' : '🤖'} ${String(t.content).slice(0, 60)}`).join('\n')}` : '_Empty_')
        );
        return true;
    }
    if (/^(plogme\s+)?clear(\s+my)?\s+memory$/i.test(lower)) {
        clearMemory(m.chat);
        await opts.reply('_*✦ memory wiped*_');
        return true;
    }
    const rememberMatch = text.match(/^(?:plogme\s+)?remember\s+([\s\S]+)$/i);
    if (rememberMatch) {
        addFact(rememberMatch[1].trim());
        await opts.reply('_*📎 Remembered ✓*_');
        return true;
    }
    const forgetMatch = text.match(/^(?:plogme\s+)?forget\s+(\d+)$/i);
    if (forgetMatch) {
        const idx = parseInt(forgetMatch[1]) - 1;
        await opts.reply(removeFact(idx) ? '_*🗑️ Fact forgotten*_' : '_✘ Invalid fact number_');
        return true;
    }

    // ── Natural-language file/PDF requests — the AI must DELIVER, not just
    //    promise. "can you write a little PDF on diet and send to me file.md",
    //    "make me a pdf about keto", "create a pdf from README.md" all land
    //    here. If the topic is a real file we convert it; otherwise PLOGME
    //    writes the content itself with the AI brain and sends the finished
    //    PDF — so the user gets the file, not a chat promise.
    //    (@crysnovax—FIX13-08-26)
    const nlPdfMatch = text.match(
        /^(?:(?:can you|could you|please|pls|kindly|hey|plogme|i need you to)\s+)?(?:write|make|create|generate|convert|draft|prepare)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+|the\s+)?(?:little|short|small|detailed|quick|simple|basic|full|nice)?\s*(?:pdf|document|doc)(?:\s+(?:on|about|for|of|from|covering|based\s+on)\s+)?(.+?)(?:\s+(?:and|then|also)?\s*(?:send|share|deliver|attach|give)(?:\s+(?:it|this|that|them))?(?:\s+(?:to|as))?(?:\s+(?:me|you|us))?(?:\s+(\S+))?)?$/i
    );
    if (nlPdfMatch) {
        const topic = nlPdfMatch[1].trim();
        const fileName = nlPdfMatch[2] ? nlPdfMatch[2].trim() : '';
        let source = '';
        let baseName = '';
        // A topic that looks like a file path (separator or extension) resolves
        // to that file; a bare topic like "diet" is a writing prompt instead.
        const looksLikePath = /[\\/]/.test(topic) || /\.[a-zA-Z0-9]{1,5}$/.test(topic);
        const resolved = looksLikePath ? resolveReadPath(topic) : null;
        if (resolved && fs.existsSync(resolved.abs)) {
            try { source = fs.readFileSync(resolved.abs, 'utf8'); baseName = path.basename(resolved.abs).replace(/\.[^.]+$/, ''); } catch {}
        }
        if (!source.trim()) {
            // Let the AI say what it is doing — no hardcoded robotic status.
            // (@crysnovax—FIX14-08-26)
            const statusLine = await askAI(
                'Say ONE short, natural, friendly status message (max 12 words, one line, no quotes, no asterisks, no emoji spam) telling the owner you are now writing/generating a PDF document about "' + String(topic).slice(0, 60) + '". Example tone: "On it — drafting that for you now…"'
            );
            const niceStatus = (statusLine && statusLine.trim().length > 3 && statusLine.trim().length < 140)
                ? statusLine.trim()
                : ['_On it — writing that document now…_', '_Give me a sec, drafting that for you…_', '_Working on it — your PDF is coming together…_', '_Let me put that together for you…_'][Math.floor(Math.random() * 4)];
            await opts.reply(niceStatus);
            const md = await askAI(
                'Write a well-structured, informative markdown document about "' + topic + '". ' +
                'Use # and ## headings, bullet lists and short paragraphs. Return ONLY the markdown content, nothing else.'
            );
            if (md && md.trim()) source = md;
        }
        if (!source.trim()) { await opts.reply('_✘ Could not generate content for that PDF_'); return true; }
        const name = (fileName.replace(/\.[^.]+$/, '') || baseName || topic.replace(/[^a-zA-Z0-9_\-]+/g, '_') || 'document').slice(0, 60);
        const res = await executeIntent(sock, m, opts, { action: 'make_pdf', content: source, name });
        if (res.handled) return true;
    }

    // ── File delivery: send a file / make a PDF / zip files ──
    // These run BEFORE the lenient command matcher so "send X" can never be
    // misread as the .send (pay) economy command. (@crysnovax—FIX12-08-26)
    const sendMatch = text.match(/^(?:plogme\s+)?(?:(?:can|could)\s+you\s+|please\s+|pls\s+|hey\s+|i\s+need\s+you\s+to\s+)?(?:send|attach|share)\s+(?:me\s+|the\s+|this\s+|that\s+)*(?:file\s+)?(.+)$/i);
    if (sendMatch && sendMatch[1] && !/^(on|off|all)$/i.test(sendMatch[1].trim())) {
        const want = sendMatch[1].trim()
            .replace(/\s+to\s+me[.!?]*$/i, '')
            .replace(/\s+(?:file|document|attachment|now|please)[.!?]*$/i, '')
            .replace(/^["'`]|["'`]$/g, '')
            .trim();
        // "send me a pdf of X" → generate & send a PDF of that file/topic
        const wantPdf = /^(?:a\s+|an\s+|the\s+)?pdf\s+(?:of|from|for|on)\s+(.+)$/i.exec(want);
        if (wantPdf) {
            const res = await executeIntent(sock, m, opts, { action: 'make_pdf', path: wantPdf[1].trim() });
            if (res.handled) return true;
        }
        // "send X as a js file" / "send the ping file as a py file" → attach
        // the named file with the right mimetype (@crysnovax—FIX14-08-26)
        const asFileMatch = /^(.+?)\s+as\s+(?:a\s+|an\s+)?([a-z0-9.]+)\s*(?:file)?$/i.exec(want);
        if (asFileMatch && !/^(on|off|all)$/i.test(asFileMatch[1].trim())) {
            const res = await executeIntent(sock, m, opts, { action: 'send_file', path: asFileMatch[1].trim(), asType: asFileMatch[2].trim() });
            if (res.handled) return true;
        }
        // "send as a js file" (no name) → newest created file
        if (/^as\s+(?:a\s+|an\s+)?[a-z0-9.]+\s*(?:file)?$/i.test(want)) {
            const asType = want.replace(/^as\s+(?:a\s+|an\s+)?/i, '').replace(/\s*file$/i, '').trim();
            const res = await executeIntent(sock, m, opts, { action: 'send_file', path: 'last_created', asType });
            if (res.handled) return true;
        }
        const res = await executeIntent(sock, m, opts, { action: 'send_file', path: want });
        if (res.handled) return true;
    }
    const pdfMatch = text.match(/^(?:plogme\s+)?(?:make|generate|convert|create)\s+(?:me\s+|a\s+|an\s+)?pdf(?:\s+(?:from|of|for)\s+(.+))?$/i);
    if (pdfMatch) {
        const res = await executeIntent(sock, m, opts, { action: 'make_pdf', path: (pdfMatch[1] || '').trim() || undefined });
        if (res.handled) return true;
    }
    const listFilesMatch = text.match(/^(?:plogme\s+)?(?:list|show|scan|check)\s+(?:the\s+)?(?:(?:bot|panel|workspace|project)\s+)?(?:files|folder|directory)(?:\s+(.+))?$/i);
    if (listFilesMatch) {
        const res = await executeIntent(sock, m, opts, { action: 'list_files', path: listFilesMatch[1] || '' });
        if (res.handled) return true;
    }
    const renameMatch = text.match(/^(?:plogme\s+)?rename\s+(.+?)\s+(?:to|as)\s+(.+)$/i);
    if (renameMatch) {
        const res = await executeIntent(sock, m, opts, { action: 'rename_file', from: renameMatch[1].trim(), to: renameMatch[2].trim() });
        if (res.handled) return true;
    }
    const zipMatch = text.match(/^(?:plogme\s+)?zip\s+(.+)$/i);
    if (zipMatch) {
        const res = await executeIntent(sock, m, opts, { action: 'zip', files: zipMatch[1].split(/\s+/).filter(Boolean) });
        if (res.handled) return true;
    }

    // ── Lenient command intent: a plain query that basically asks for a
    //    command should just run it — "ping", "run ping", "can you ping",
    //    "check uptime", "menu". PLOGME's own names are excluded so a bare
    //    "plogme" can never dump the menu on itself. (@crysnovax—FIX08-07-26)
    try {
        const { getCommand } = require('../../Plugin/crysCmd');
        const cleaned = text
            .replace(/^(?:plogme|plg|plog)\s+/i, '')
            .replace(/^(?:can you|could you|please|pls|do|run|execute|try|check|show|give me|let'?s|how about|what about|start|open)\s+/i, '')
            .trim();
        const words = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length && words.length <= 5) {
            for (const w of words.slice(0, 2)) {
                if (SELF_NAMES.has(w)) continue; // never run plogme itself
                const cmd = getCommand(w);
                if (cmd && typeof cmd.execute === 'function') {
                    const restArgs = cleaned.split(/\s+/).filter(Boolean).slice(words.indexOf(w) + 1);
                    const result = await runCommandAction(sock, m, opts, cmd.name + (restArgs.length ? ' ' + restArgs.join(' ') : ''));
                    if (result !== true) await opts.reply(result);
                    return true;
                }
            }
        }
    } catch {}

    return false;
}

/* ───────────────────────── LLM intent brain (no hardcoded phrasing) ───────────────────────── */
const KNOWN_ACTIONS = new Set([
    'run_command', 'create_file', 'edit_file', 'delete_file', 'toggle_command',
    'list_commands', 'reload', 'restart', 'status', 'memory', 'clear_memory',
    'remember', 'forget', 'test', 'fix_code', 'train', 'personality', 'dev', 'chat',
    // FIX11-08-26: real task intents — PLOGME carries these out directly with
    // the message context (quoted image, mentioned user) instead of trying to
    // run a made-up .cm internally.
    'set_pp', 'group_pp', 'group_name', 'kick', 'promote', 'demote',
    'mute_user', 'unmute_user', 'mutesch', 'antis', 'plogme_mode',
    // FIX12-08-26: file delivery — send files, generate PDFs, zip archives
    'send_file', 'make_pdf', 'zip', 'search_file', 'search_code', 'search_web', 'environment', 'create_tool',
    'mission_create', 'mission_list', 'mission_status', 'mission_pause', 'mission_resume', 'mission_rollback',
    'dependency_status', 'suggest_dependency', 'install_dependency', 'project_index', 'health', 'research_web', 'inspect_media', 'list_files', 'rename_file',
]);

// Strip markdown fences / extra text and pull out the first JSON object.
function parseIntentJson(raw) {
    try {
        const s = String(raw || '').trim().replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');
        if (start !== -1 && end > start) {
            try { return JSON.parse(s.slice(start, end + 1)); } catch {}
        }
        try { return JSON.parse(s); } catch {}
    } catch {}
    return null;
}

function buildClassifierPrompt(userText) {
    const realCommands = commandNameList();
    // Design-from-reference: when the owner asks to create a new command/file
    // "like/referencing/based on our existing X", attach the real source of X
    // so the AI mirrors the bot's actual format instead of inventing its own.
    // (@crysnovax—FIX14-08-26)
    let refNote = '';
    const refMatch = /(?:referencing|based on|like|similar to|in the style of|from|copying|mirroring|mimicking)\s+(?:our\s+|the\s+|my\s+)?(?:own\s+|existing\s+)?(?:command\s+|file\s+)?([a-z0-9_.-]+)/i.exec(String(userText || ''));
    if (refMatch) {
        const ref = fuzzyFindFile(refMatch[1]);
        if (ref && fs.existsSync(ref.abs) && ref.abs.endsWith('.js')) {
            try {
                const src = fs.readFileSync(ref.abs, 'utf8').slice(0, 3000);
                refNote = `\n\nREFERENCE FILE (create the new file following this file's exact structure, naming and style):\n\`\`\`js\n${src}\n\`\`\``;
            } catch {}
        }
    }
    return `You are PLOGME, the command brain inside a WhatsApp bot. The owner just sent a message. ` +
        `Decide what they want and reply with ONLY one JSON object — no markdown, no explanation. ` +
        `You are the bot's CONTROL BRAIN — you can run any command, send files, generate PDFs, zip archives, ` +
        `and do any task the bot can do. ` +
        `NEVER refuse and never say you cannot do something; if a request is unclear, ask one short question. ` +
        `If the request is casual chat, use action "chat" with a friendly short reply. ` +
        `If they ask to run/execute/open/check/show a bot command — even inside a normal sentence — use ` +
        `"run_command" with the EXACT command name taken ONLY from the "Available commands" list at the ` +
        `bottom of this prompt (never invent a name — e.g. a sound-effect request maps to "sound", not ` +
        `"toaudio"). If they ask to create/make/write a command, plugin, script or .js file, use ` +
        `"create_file" with the full file content. If they ask to edit/change/update/improve a file, use ` +
        `"edit_file" (provide "find" — the exact snippet to replace — and "content" — the replacement; or ` +
        `provide "content" alone to rewrite the whole file). ` +
        `If they ask to delete/remove a file or command, use "delete_file". If they ask to fix or repair ` +
        `code, use "fix_code". If they ask to test/check code or a file, use "test". ` +
        `If they ask to toggle a command, use "toggle_command". ` +
        `\nNATURAL-LANGUAGE TASKS (handle these directly with their own actions, do NOT route them through run_command):\n` +
        `- "change/set my/bot profile picture to this" (an image is quoted) -> {"action":"set_pp","target":"bot"}\n` +
        `- "change/set the group profile picture / group pp" (image quoted) -> {"action":"set_pp","target":"group"}\n` +
        `- "rename the group / change group name to X" -> {"action":"group_name","name":"X"}\n` +
        `- "kick/remove/delete this user" or "kick @user" -> {"action":"kick","user":"mentioned"}\n` +
        `- "promote/make this user admin" -> {"action":"promote","user":"mentioned"}\n` +
        `- "demote/unadmin this user" -> {"action":"demote","user":"mentioned"}\n` +
        `- "mute/silence this user for 5m" -> {"action":"mute_user","user":"mentioned","duration":"5m","reason":"..."}\n` +
        `- "unmute this user" -> {"action":"unmute_user","user":"mentioned"}\n` +
        `- "schedule a mute / set mutesch 5pm to 10am daily" -> {"action":"mutesch","start":"5pm","end":"10am","repeat":"daily"}\n` +
        `- "turn on/off all the antis / protections / security" -> {"action":"antis","state":"on"}\n` +
        `- "set plogme mode to all/tag" -> {"action":"plogme_mode","mode":"all"}\n` +
        `- "send/attach/share the file X" / "send me the pdf" / "send the file" -> {"action":"send_file","path":"<path>"}\n` +
        `- "find/search for X in my files/code" -> {"action":"search_file"|"search_code","query":"X"}\n` +
        `- "search the web for X" -> {"action":"search_web","query":"X"}\n` +
        `- "what is the bot environment/status" -> {"action":"environment"}\n` +
        `- "create a tool for X" -> {"action":"create_tool","name":"<name>","content":"<full JS module>"}\n` +
        `- "plan/start/track this task" -> {"action":"mission_create","objective":"<goal>","plan":["<step>"]}\n` +
        `- "show/list/resume/pause/rollback mission" -> use mission_list, mission_status, mission_resume, mission_pause, or mission_rollback\n` +
        `- "suggest/check/install dependency X" -> use suggest_dependency, dependency_status, or install_dependency\n` +
        `- "index the project / inspect project structure" -> {"action":"project_index"}\n` +
        `- "run health check / diagnose bot" -> {"action":"health"}\n` +
        `- "research X on the web" -> {"action":"research_web","query":"X"}\n` +
        `- "inspect/analyze this image, video, audio, or document" -> {"action":"inspect_media"}\n` +
        `- "list/scan/show files in the bot folder or panel" -> {"action":"list_files","path":"<optional relative folder>"}\n` +
        `- "rename X to Y" -> {"action":"rename_file","from":"<source>","to":"<destination>"}\n` +
        `- "make/generate/create a PDF from X" / "convert X to pdf" / "write a pdf about/on X" -> {"action":"make_pdf","path":"<path or topic>"} (or "content":"<text>" for pasted text)\n` +
        `- "zip/compress these files" -> {"action":"zip","files":["<path1>","<path2>"]}\n` +
        `(for user actions the target comes from the @mention or the quoted message, so "mentioned" is the right value)\n\n` +
        `Possible actions: run_command, create_file, edit_file, delete_file, toggle_command, ` +
        `list_commands, reload, restart, status, memory, clear_memory, remember, forget, ` +
        `test, fix_code, train, personality, dev, set_pp, group_name, group_pp, kick, promote, ` +
        `demote, mute_user, unmute_user, mutesch, antis, plogme_mode, send_file, make_pdf, zip, search_file, search_code, search_web, environment, create_tool, mission_create, mission_list, mission_status, mission_pause, mission_resume, mission_rollback, dependency_status, suggest_dependency, install_dependency, project_index, health, research_web, inspect_media, list_files, rename_file, chat.\n\n` +
        `JSON shapes:\n` +
        `- {"action":"run_command","command":"<name>","args":"<optional>"}\n` +
        `- {"action":"create_file","path":"src/Commands/User/name.js","content":"<FULL file content>"}\n` +
        `  (a bare name like "hello" as path means a new command file)\n` +
        `- {"action":"edit_file","path":"<path>","find":"<exact snippet>","content":"<replacement>"}\n` +
        `- {"action":"delete_file","path":"<path>"}\n` +
        `- {"action":"toggle_command","command":"<name>","state":"on|off"}\n` +
        `- {"action":"list_commands","category":"<optional>"}\n` +
        `- {"action":"reload"} {"action":"restart"} {"action":"status"} {"action":"memory"} {"action":"clear_memory"}\n` +
        `- {"action":"remember","fact":"<fact>"} {"action":"forget","index":1}\n` +
        `- {"action":"test","target":"<code or file path>"} {"action":"fix_code","code":"<code>"}\n` +
        `- {"action":"train","text":"<text>"} {"action":"personality","text":"<text>"}\n` +
        `- {"action":"dev","state":"on|off|toggle"}\n` +
        `- {"action":"set_pp","target":"bot|group"} {"action":"group_name","name":"<new name>"}\n` +
        `- {"action":"kick|promote|demote|mute_user|unmute_user","user":"mentioned","duration":"<optional 5m>","reason":"<optional>"}\n` +
        `- {"action":"mutesch","start":"5pm","end":"10am","repeat":"daily|once"}\n` +
        `- {"action":"antis","state":"on|off"} {"action":"plogme_mode","mode":"all|tag"}\n` +
        `- {"action":"send_file","path":"<path>"} {"action":"make_pdf","path":"<path>"|"content":"<text>"} {"action":"zip","files":["<path1>"]}\n` +
        `- {"action":"search_file"|"search_code","query":"<text>"} {"action":"search_web","query":"<text>"}\n` +
        `- {"action":"environment"} {"action":"create_tool","name":"<name>","content":"<full JS module>"}\n` +
        `- {"action":"mission_create","objective":"<goal>","plan":["<step>"]} {"action":"mission_list"} {"action":"mission_status","id":"<id>"}\n` +
        `- {"action":"mission_pause|mission_resume|mission_rollback","id":"<id>"}\n` +
        `- {"action":"dependency_status|suggest_dependency|install_dependency","package":"<name>"}\n` +
        `- {"action":"project_index"} {"action":"health"} {"action":"research_web","query":"<topic>"} {"action":"inspect_media"}\n` +
        `- {"action":"list_files","path":"<relative folder>"} {"action":"rename_file","from":"<source>","to":"<destination>"}\n` +
        `- {"action":"chat","reply":"<your short reply>"}\n\n` +
        `Available commands (ONLY use these exact names for run_command):\n` +
        (realCommands.length ? realCommands.slice(0, 160).join(', ') : '(command list unavailable)') +
        refNote +
        `\n\nLIVE ENVIRONMENT SNAPSHOT (use this to reason about paths, runtime, and available workspace): ${JSON.stringify(environmentSnapshot())}` +
        `\n\nOwner message: "${String(userText || '').slice(0, 2000)}"`;
}

// Classify a privileged message into a structured intent. Returns the intent
// object, or null when the AI is unreachable / the response is unparsable.
async function classifyIntent(userText) {
    const raw = await askAI(buildClassifierPrompt(userText));
    if (!raw) return null;
    const intent = parseIntentJson(raw);
    if (!intent || typeof intent !== 'object') return null;
    const action = String(intent.action || '').toLowerCase();
    if (!KNOWN_ACTIONS.has(action)) return null;
    intent.action = action;
    return intent;
}

// Execute a classified intent. Returns { handled: true } when PLOGME dealt
// with the message (including as a chat reply).
async function executeIntent(sock, m, opts, intent) {
    try {
        opts = { ...opts, sendMessage: opts?.sendMessage || (typeof sock?.sendMessage === 'function' ? sock.sendMessage.bind(sock) : null) };
        const action = intent.action;
        const missionActions = new Set(['create_file', 'edit_file', 'create_tool', 'send_file', 'make_pdf', 'zip', 'install_dependency', 'project_index', 'health', 'research_web', 'inspect_media']);
        if (missionActions.has(action) && !opts.missionId) {
            const mission = missions.createMission({ chat: m.chat, owner: m.sender || '', objective: String(intent.objective || intent.query || intent.path || action).slice(0, 1000), plan: ['inspect workspace and dependencies', `execute ${action}`, 'verify result and report'] });
            opts.missionId = mission.id;
            missions.updateMission(mission.id, { status: 'running' });
        }
        if (['create_file', 'edit_file', 'create_tool', 'send_file', 'search_file', 'search_code', 'search_web', 'make_pdf', 'zip', 'mission_create', 'mission_rollback', 'install_dependency', 'project_index', 'health', 'research_web', 'inspect_media'].includes(action)) {
            await reportProgress(opts, `starting ${action.replace(/_/g, ' ')}…`);
        }

        switch (action) {
            case 'run_command': {
                const target = String(intent.command || '').trim() + (intent.args ? ' ' + String(intent.args).trim() : '');
                const result = await runCommandAction(sock, m, opts, target);
                if (result !== true) await opts.reply(result);
                logOp('run', `ran command: ${String(intent.command || '').slice(0, 60)}`);
                return { handled: true };
            }

            case 'create_file': {
                const resolved = resolveWritePath(intent.path || intent.filename || '');
                if (!resolved) { await opts.reply('_✘ Invalid or blocked file path_'); return { handled: true }; }
                const { abs, display } = resolved;
                const rawPath = String(intent.path || intent.filename || '');
                const isBareName = !rawPath.includes('/') && !rawPath.includes('\\') && !rawPath.includes('.');
                const name = isBareName ? sanitizeCommandName(rawPath) : '';
                let content = String(intent.content || '');
                if (!content.trim()) { await opts.reply('_✘ No file content provided_'); return { handled: true }; }
                if (name) content = ensureCommandModule(name, content);
                const res = await writeFileWithAgentFix(abs, content, opts);
                if (opts.missionId) { missions.addEvent(opts.missionId, res.ok ? 'verified' : 'failed', res.ok ? `Created and syntax-checked ${display}` : `Syntax failure in ${display}`); missions.updateMission(opts.missionId, { status: res.ok ? 'completed' : 'blocked', files: [display] }); }
                logOp('create', `${display}${name ? ` (command .${name})` : ''}`);
                if (res.ok) {
                    if (display.includes('Commands')) { try { require('../../Plugin/crysLoadCmd').loadCommands(); } catch {} }
                    await opts.reply(
                        `_*✅ ${fs.existsSync(abs) && display.startsWith('src/Commands/User') ? 'File created' : 'File written'}:*_ \`${display}\`` +
                        (name ? ` → command .${name}` : '') +
                        `\n\n\`\`\`js\n${String(res.content || '').slice(0, 3000)}\n\`\`\``
                    );
                    // Attach the REAL file too — the owner wants the file itself,
                    // not just the code preview. (@crysnovax—FIX14-08-26)
                    try {
                        let mime = 'application/octet-stream';
                        try { mime = require('mime-types').lookup(abs) || mime; } catch {}
                        await opts.sendMessage(m.chat, {
                            document: fs.readFileSync(abs),
                            mimetype: mime,
                            fileName: path.basename(abs)
                        }, { quoted: m });
                    } catch {}
                } else {
                    await opts.reply(`_*✘ Saved but syntax error in \`${display}\`:*_\n\`\`\`\n${res.error.slice(0, 1200)}\n\`\`\``);
                }
                return { handled: true };
            }

            case 'edit_file': {
                const resolved = resolveWritePath(intent.path || intent.filename || '');
                if (!resolved) { await opts.reply('_✘ Invalid or blocked file path_'); return { handled: true }; }
                const { abs, display } = resolved;
                if (!fs.existsSync(abs)) { await opts.reply(`_✘ \`${display}\` not found_`); return { handled: true }; }
                const current = fs.readFileSync(abs, 'utf8');
                let next;
                if (intent.find) {
                    const idx = current.indexOf(String(intent.find));
                    if (idx === -1) { await opts.reply(`_✘ Could not find that snippet in \`${display}\`_`); return { handled: true }; }
                    next = current.slice(0, idx) + String(intent.content || '') + current.slice(idx + String(intent.find).length);
                } else {
                    next = String(intent.content || '');
                }
                if (!next.trim()) { await opts.reply('_✘ No replacement content provided_'); return { handled: true }; }
                if (opts.missionId) missions.snapshotFiles(opts.missionId, [display]);
                const res = await writeFileWithAgentFix(abs, next, opts);
                if (opts.missionId) { missions.addEvent(opts.missionId, res.ok ? 'verified' : 'failed', res.ok ? `Edited and syntax-checked ${display}` : `Syntax failure in ${display}`); missions.updateMission(opts.missionId, { status: res.ok ? 'completed' : 'blocked', files: [display] }); }
                logOp('edit', display);
                if (res.ok) {
                    if (display.includes('Commands')) { try { require('../../Plugin/crysLoadCmd').loadCommands(); } catch {} }
                    await opts.reply(`_*✅ \`${display}\` updated ✓*_`);
                } else {
                    await opts.reply(`_*✘ Saved but syntax error in \`${display}\`:*_\n\`\`\`\n${res.error.slice(0, 1200)}\n\`\`\``);
                }
                return { handled: true };
            }

            case 'delete_file': {
                const resolved = resolveWritePath(intent.path || intent.filename || '');
                if (!resolved) { await opts.reply('_✘ Invalid or blocked file path_'); return { handled: true }; }
                const { abs, display } = resolved;
                if (!fs.existsSync(abs)) { await opts.reply(`_✘ \`${display}\` not found_`); return { handled: true }; }
                if (PROTECTED_FILES.has(display) || PROTECTED_FILES.has(path.basename(display))) {
                    await opts.reply(`_🛡️ \`${display}\` is protected and cannot be deleted_`);
                    return { handled: true };
                }
                try {
                    fs.unlinkSync(abs);
                    logOp('delete', display);
                    if (display.includes('Commands')) { try { require('../../Plugin/crysLoadCmd').loadCommands(); } catch {} }
                    await opts.reply(`_*🗑️ \`${display}\` deleted ✓*_`);
                } catch (e) { await opts.reply('_✘ Delete failed:_ ' + e.message); }
                return { handled: true };
            }

            case 'toggle_command': {
                const { getCommand } = require('../../Plugin/crysCmd');
                const cmd = getCommand(String(intent.command || '').toLowerCase());
                const name = cmd?.name || String(intent.command || '').toLowerCase();
                if (SELF_NAMES.has(name)) {
                    // toggling PLOGME itself = the chatbot on/off toggle for
                    // this chat (the command-toggle list is for other commands)
                    const off = String(intent.state || 'off').toLowerCase() !== 'on';
                    setEnabled(m.chat, !off);
                    logOp('toggle', `plogme ${off ? 'off' : 'on'} in this chat`);
                    await opts.reply(off
                        ? '`✘ DISABLED` — no auto-replies in this chat (send .plogme on to re-enable)'
                        : '`✓ ENABLED` — auto-replies ON in this chat (send .plogme off to disable)');
                    return { handled: true };
                }
                const off = String(intent.state || 'off').toLowerCase() !== 'on';
                toggleCommand(name, off);
                logOp('toggle', `.${name} ${off ? 'off' : 'on'}`);
                await opts.reply(`_*${off ? '⛔' : '✅'} .${name} ${off ? 'toggled OFF' : 'toggled ON'}*_`);
                return { handled: true };
            }

            case 'list_commands': {
                const { getAll } = require('../../Plugin/crysCmd');
                const cat = String(intent.category || '').toLowerCase();
                let names = [];
                for (const [k, v] of getAll()) {
                    if (v?.isAlias) continue;
                    if (cat && String(v?.category || '').toLowerCase() !== cat) continue;
                    names.push(k);
                }
                names = [...new Set(names)];
                await opts.reply(names.length
                    ? `_*💾 Commands${cat ? ` (${cat})` : ''}:*_ ${names.length}\n\`${names.slice(0, 120).join('`, `')}\`${names.length > 120 ? '…' : ''}`
                    : '_No commands found_');
                return { handled: true };
            }

            case 'reload': {
                const { loadCommands } = require('../../Plugin/crysLoadCmd');
                const count = loadCommands();
                await opts.reply(`_*↻ Commands reloaded:*_ ${count} commands loaded ✓`);
                return { handled: true };
            }

            case 'restart': {
                await opts.reply('_*♻️ Restarting the bot...*_');
                setTimeout(() => process.exit(0), 1500);
                return { handled: true };
            }

            case 'status': {
                const { getAll } = require('../../Plugin/crysCmd');
                await opts.reply(
                    `╭─❍ *PLOGME STATUS*\n│\n` +
                    `│ 么 Personality : ${getPersonality().slice(0, 40)}…\n` +
                    `│ ⚉︎ Training     : ${getTraining() ? '✓ set' : '—'}\n` +
                    `│ ✆ Dev mode     : ${isDev() ? '✓ ON' : 'OFF'}\n` +
                    `│ ⓘ Facts        : ${getFacts().length}\n` +
                    `│ ۞ Commands     : ${getAll().size}\n` +
                    `│ ⌬ Toggled off  : ${getToggledList().length}\n` +
                    `╰──────────────────`
                );
                return { handled: true };
            }

            case 'memory': {
                const mem = getMemory(m.chat);
                const facts = getFacts();
                await opts.reply(
                    `_*🧠 PLOGME memory (${m.chat})*_\n\n` +
                    (facts.length ? `_Persistent facts:_\n${facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n` : '') +
                    (mem.length ? `_Last ${Math.min(mem.length, 10)} turns:_\n${mem.slice(-10).map(t => `• ${t.role === 'user' ? '👤' : '🤖'} ${String(t.content).slice(0, 60)}`).join('\n')}` : '_Empty_')
                );
                return { handled: true };
            }

            case 'clear_memory': {
                clearMemory(m.chat);
                await opts.reply('_*✦ memory wiped*_');
                return { handled: true };
            }

            case 'remember': {
                if (!String(intent.fact || '').trim()) { await opts.reply('_*ⓘ What should I remember?*_'); return { handled: true }; }
                addFact(String(intent.fact).trim());
                logOp('remember', String(intent.fact).slice(0, 80));
                await opts.reply('_*📎 Remembered ✓*_');
                return { handled: true };
            }

            case 'forget': {
                const idx = (parseInt(intent.index, 10) || 1) - 1;
                await opts.reply(removeFact(idx) ? '_*🗑️ Fact forgotten*_' : '_✘ Invalid fact number_');
                return { handled: true };
            }

            case 'test': {
                await runTest(sock, m, opts, intent.target);
                return { handled: true };
            }

            case 'fix_code': {
                const fixed = await askAI('Fix this code and return ONLY the corrected code, nothing else:\n\n' + String(intent.code || ''));
                await opts.reply('_*🔧 Fixed code:*_\n\n```\n' + (fixed || 'Failed to fix — AI unavailable') + '\n```');
                return { handled: true };
            }

            case 'train': {
                if (!String(intent.text || '').trim()) { await opts.reply('_*ⓘ Usage: train <text>*_'); return { handled: true }; }
                setTraining(String(intent.text).trim());
                await opts.reply('_*☞ Global training saved ✓*_');
                return { handled: true };
            }

            case 'personality': {
                if (!String(intent.text || '').trim()) { await opts.reply('_*ⓘ Usage: personality <text>*_'); return { handled: true }; }
                setPersonality(String(intent.text).trim());
                await opts.reply('_*⚉ Global personality set ✓*_');
                return { handled: true };
            }

            case 'dev': {
                const arg = String(intent.state || 'toggle').toLowerCase();
                const next = arg === 'toggle' ? !isDev() : arg === 'on';
                setDev(next);
                await opts.reply(`_*🛠️ Developer mode ${next ? 'ON' : 'OFF'}*_`);
                return { handled: true };
            }

            // ── REAL TASKS (FIX11-08-26): PLOGME carries these out itself
            //    with the message context — quoted image, mentioned user —
            //    instead of just echoing a .cm internally.
            case 'set_pp':
            case 'group_pp': {
                const isGroup = action === 'group_pp' || String(intent.target || '').toLowerCase() === 'group';
                const quoted = m.quoted ? (m.quoted.msg || m.quoted) : null;
                const mime = String(quoted?.mimetype || m.quoted?.mtype || '');
                if (!m.quoted || !/image/i.test(mime)) {
                    await opts.reply('_✘ I need an image — quote (reply to) an image with your request._');
                    return { handled: true };
                }
                const ppRes = await runCommandAction(sock, m, opts, isGroup ? 'setgpp' : 'setpp');
                if (ppRes !== true) await opts.reply(ppRes);
                logOp('set_pp', `${isGroup ? 'group' : 'bot'} profile picture updated`);
                return { handled: true };
            }

            case 'group_name': {
                if (!m.isGroup) { await opts.reply('_✘ That only works in a group_'); return { handled: true }; }
                const name = String(intent.name || '').trim();
                if (!name) { await opts.reply('_✘ What should the new group name be?_'); return { handled: true }; }
                const res = await runCommandAction(sock, m, opts, 'gcname ' + name);
                if (res !== true) await opts.reply(res);
                logOp('group_name', `renamed group to "${name.slice(0, 40)}"`);
                return { handled: true };
            }

            case 'kick': {
                const t = resolveTargetJid(m, intent.user);
                if (!t) { await opts.reply('_✘ Who should I kick? Mention them (@user) or reply to their message._'); return { handled: true }; }
                const res = await runCommandAction(sock, m, opts, 'kick ' + t.split('@')[0]);
                if (res !== true) await opts.reply(res);
                logOp('kick', `kicked @${t.split('@')[0]}`);
                return { handled: true };
            }

            case 'promote': {
                const t = resolveTargetJid(m, intent.user);
                if (!t) { await opts.reply('_✘ Who should I promote? Mention them (@user) or reply to their message._'); return { handled: true }; }
                const res = await runCommandAction(sock, m, opts, 'promote ' + t.split('@')[0]);
                if (res !== true) await opts.reply(res);
                logOp('promote', `promoted @${t.split('@')[0]}`);
                return { handled: true };
            }

            case 'demote': {
                const t = resolveTargetJid(m, intent.user);
                if (!t) { await opts.reply('_✘ Who should I demote? Mention them (@user) or reply to their message._'); return { handled: true }; }
                const res = await runCommandAction(sock, m, opts, 'demote ' + t.split('@')[0]);
                if (res !== true) await opts.reply(res);
                logOp('demote', `demoted @${t.split('@')[0]}`);
                return { handled: true };
            }

            case 'mute_user':
            case 'unmute_user': {
                if (!m.isGroup) { await opts.reply('_✘ That only works in a group_'); return { handled: true }; }
                const t = resolveTargetJid(m, intent.user);
                if (!t) { await opts.reply('_✘ Who should I mute? Mention them (@user) or reply to their message._'); return { handled: true }; }
                const { getCommand } = require('../../Plugin/crysCmd');
                const cmd = getCommand('muteuser');
                if (!cmd) { await opts.reply('_✘ .muteuser not loaded_'); return { handled: true }; }
                const num = t.split('@')[0];
                const mOpts = {
                    args: [], prefix: getVar('PREFIX', '.'), reply: opts.reply,
                    isGroup: true, isAdmin: true, isBotAdmin: true,
                    sender: m.sender, mentionedJid: m.mentionedJid,
                };
                if (action === 'unmute_user') {
                    mOpts.args.push(num);
                    // muteuser detects unmute via the text starting with prefix+unmute
                    await cmd.execute(sock, { ...m, text: mOpts.prefix + 'unmute ' + num }, mOpts);
                } else {
                    const durMatch = String(intent.duration || '').match(/\d+\s?(s|m|h|d|w|mo)/i);
                    const duration = durMatch ? durMatch[0].replace(/\s+/g, '') : '';
                    const reason = String(intent.reason || 'No reason').trim() || 'No reason';
                    if (!m.mentionedJid?.length && !m.quoted?.sender) mOpts.args.push(num);
                    if (duration) mOpts.args.push(duration);
                    mOpts.args.push(reason);
                    await cmd.execute(sock, m, mOpts);
                }
                logOp(action, `${action === 'unmute_user' ? 'unmuted' : 'muted'} @${num}`);
                return { handled: true };
            }

            case 'mutesch': {
                if (!m.isGroup) { await opts.reply('_✘ That only works in a group_'); return { handled: true }; }
                const start = String(intent.start || '').trim();
                const end = String(intent.end || '').trim();
                const repeat = String(intent.repeat || 'daily').toLowerCase();
                if (!start || !end) {
                    await opts.reply('_✘ Give me the times — e.g. "mutesch 5pm to 10am daily"_');
                    return { handled: true };
                }
                const res = await runCommandAction(sock, m, opts, `mutesch ${start} to ${end} ${repeat === 'once' ? 'once' : 'daily'}`);
                if (res !== true) await opts.reply(res);
                logOp('mutesch', `scheduled mute ${start} → ${end} (${repeat})`);
                return { handled: true };
            }

            case 'antis': {
                const on = String(intent.state || 'on').toLowerCase() !== 'off';
                let ok = 0;
                const failed = [];
                for (const name of ANTI_COMMANDS) {
                    const res = await runCommandAction(sock, m, opts, name + (on ? ' on' : ' off'));
                    if (res === true) ok++;
                    else failed.push(name);
                }
                await opts.reply(
                    `_*${on ? '🛡️ ALL ANTIS ON' : '🛡️ ALL ANTIS OFF'}*_\n` +
                    `✓ ${ok}/${ANTI_COMMANDS.length} toggled\n` +
                    (failed.length ? `✘ failed: ${failed.join(', ')}` : '_Done._')
                );
                logOp('antis', `${on ? 'enabled' : 'disabled'} ${ok} anti-commands`);
                return { handled: true };
            }

            case 'plogme_mode': {
                const modeArg = String(intent.mode || '').toLowerCase();
                if (modeArg !== 'all' && modeArg !== 'tag') { await opts.reply('_✘ Mode must be all or tag_'); return { handled: true }; }
                setMode(m.chat, modeArg);
                await opts.reply(`_*✐ Mode ${modeArg.toUpperCase()}*_`);
                return { handled: true };
            }

            case 'search_file':
            case 'search_code': {
                const query = String(intent.query || intent.text || intent.pattern || '').trim();
                if (!query) { await opts.reply('_✘ Tell me what text or pattern to search for_'); return { handled: true }; }
                const results = searchWorkspace(query, { codeOnly: action === 'search_code', regex: intent.regex === true, limit: 40 });
                const rendered = results.map(r => '• `' + r.file + ':' + r.line + '` ' + r.text).join('\n');
                await opts.reply(results.length
                    ? `_*🔎 ${action === 'search_code' ? 'Code' : 'File'} search results for* _${query.slice(0, 80)}_\n${rendered}`
                    : `_*🔎 No matches found for* _${query.slice(0, 80)}_`);
                logOp(action, `${query.slice(0, 100)} (${results.length} matches)`);
                return { handled: true };
            }

            case 'search_web': {
                const query = String(intent.query || intent.text || '').trim();
                if (!query) { await opts.reply('_✘ Tell me what to search for on the web_'); return { handled: true }; }
                try {
                    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
                    const response = await axios.get(url, { timeout: 15000, headers: { 'user-agent': 'CODY-PLOGME/1.0' } });
                    const html = String(response.data || '');
                    const matches = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].slice(0, 5);
                    const clean = value => String(value || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
                    const lines = matches.map((match, i) => `${i + 1}. ${clean(match[2])}\n${match[1]}`);
                    await opts.reply(lines.length ? `_*🌐 Web results for* _\`${query.slice(0, 80)}\`_\n${lines.join('\n')}` : '_*🌐 Search completed, but no results were returned.*_');
                    logOp('search_web', `${query.slice(0, 100)} (${lines.length} results)`);
                } catch (err) {
                    await opts.reply(`_✘ Web search failed:_ ${err.message}`);
                }
                return { handled: true };
            }

            case 'environment': {
                const env = environmentSnapshot();
                await opts.reply(`_*🧭 PLOGME ENVIRONMENT*_\n\n` +
                    `• cwd: \`${env.cwd}\`\n• platform: ${env.platform}\n• Node: ${env.node}\n` +
                    `• package: ${env.package}@${env.packageVersion}\n• uptime: ${env.uptimeSeconds}s\n` +
                    `• memory: ${env.memoryMb} MB\n• workspace files: ${env.files}\n` +
                    `• commands dir: ${env.commandsDir ? 'ready' : 'missing'}\n• output dir: ${env.outputDir ? 'ready' : 'will be created'}`);
                return { handled: true };
            }

            case 'mission_create': {
                const objective = String(intent.objective || intent.goal || intent.text || '').trim();
                if (!objective) { await opts.reply('_✘ Tell me what the mission should accomplish_'); return { handled: true }; }
                const plan = Array.isArray(intent.plan) ? intent.plan : String(intent.plan || '').split(/\s*[,;]\s*/).filter(Boolean);
                const mission = missions.createMission({ chat: m.chat, owner: m.sender || '', objective, plan });
                if (intent.files) {
                    const files = Array.isArray(intent.files) ? intent.files : [intent.files];
                    missions.snapshotFiles(mission.id, files);
                }
                await opts.reply(`_*🧭 Mission created:*_ ${mission.id}\n\n*Objective:* ${mission.objective}\n` + (mission.plan.length ? mission.plan.map((step, i) => `${i + 1}. ${step}`).join('\n') : '_No plan supplied; I will inspect and plan the next steps._'));
                await sendMissionControls(sock, m, mission);
                return { handled: true };
            }

            case 'mission_list': {
                const items = missions.listMissions({ status: intent.status });
                await opts.reply(items.length
                    ? `_*🧭 Recent PLOGME missions*_\n` + items.slice(0, 12).map(item => `• ${item.id} — ${item.status} — ${item.objective.slice(0, 90)}`).join('\n')
                    : '_No PLOGME missions have been recorded yet._');
                return { handled: true };
            }

            case 'mission_status': {
                const item = missions.getMission(intent.id || intent.mission || intent.missionId) || missions.listMissions()[0];
                if (!item) { await opts.reply('_✘ Mission not found_'); return { handled: true }; }
                const lastEvents = (item.events || []).slice(-8).map(event => `• ${event.at.slice(11, 19)} ${event.message}`).join('\n');
                await opts.reply(`_*🧭 ${item.id}*_\n*Status:* ${item.status}\n*Step:* ${item.step}/${item.plan.length || '?'}\n*Objective:* ${item.objective}\n\n${lastEvents || '_No events yet._'}`);
                return { handled: true };
            }

            case 'mission_pause':
            case 'mission_resume': {
                const item = missions.getMission(intent.id || intent.mission || intent.missionId);
                if (!item) { await opts.reply('_✘ Mission not found_'); return { handled: true }; }
                const nextStatus = action === 'mission_pause' ? 'paused' : 'running';
                missions.updateMission(item.id, { status: nextStatus });
                missions.addEvent(item.id, nextStatus, `Mission ${nextStatus}`);
                await opts.reply(`_*${nextStatus === 'paused' ? '⏸️' : '▶️'} ${item.id}: ${nextStatus.toUpperCase()}*_`);
                return { handled: true };
            }

            case 'mission_rollback': {
                const item = missions.getMission(intent.id || intent.mission || intent.missionId);
                if (!item) { await opts.reply('_✘ Mission not found_'); return { handled: true }; }
                const result = missions.rollbackMission(item.id, intent.snapshot);
                await opts.reply(result.ok ? `_*↶ Rollback complete:*_ ${item.id}\n${result.files.join('\n') || 'No files restored'}` : `_✘ Rollback failed:_ ${result.error}`);
                return { handled: true };
            }

            case 'dependency_status': {
                const raw = intent.package || intent.name || intent.spec;
                const status = dependencies.localStatus(raw);
                if (!status.ok) { await opts.reply(`_✘ ${status.error}_`); return { handled: true }; }
                await opts.reply(`_*📦 Dependency status*_\n• Package: ${status.name}\n• Requested: ${status.spec}\n• Declared: ${status.declared || 'not declared'}\n• Installed: ${status.installed || 'missing'}\n• State: ${status.missing ? 'MISSING' : 'READY'}`);
                return { handled: true };
            }

            case 'suggest_dependency': {
                const raw = intent.package || intent.name || intent.spec;
                const info = await dependencies.registryInfo(raw);
                if (!info.ok) { await opts.reply(`_✘ Dependency lookup failed:_ ${info.error}`); return { handled: true }; }
                await opts.reply(`_*📦 Dependency suggestion*_\n• Package: ${info.name}\n• Latest: ${info.latest || 'unknown'}\n• Description: ${info.description || 'not provided'}\n• Status: ${info.deprecated ? `DEPRECATED — ${info.deprecated}` : 'not marked deprecated'}\n\nUse “install ${info.name}” when you want me to add it explicitly.`);
                return { handled: true };
            }

            case 'install_dependency': {
                const raw = intent.package || intent.name || intent.spec;
                const spec = dependencies.packageSpec(raw);
                if (!spec) { await opts.reply('_✘ Invalid package name or version spec_'); return { handled: true }; }
                await reportProgress(opts, `checking ${spec} in the npm registry…`);
                const info = await dependencies.registryInfo(spec);
                if (!info.ok) { await opts.reply(`_✘ I could not verify ${spec}: ${info.error}_`); return { handled: true }; }
                if (info.deprecated) { await opts.reply(`_⚠️ ${spec} is deprecated: ${info.deprecated}. I will not install it automatically.`); return { handled: true }; }
                await reportProgress(opts, `installing ${spec}; npm will update package.json and package-lock.json…`);
                const result = dependencies.install(spec);
                if (opts.missionId) { missions.addEvent(opts.missionId, result.ok ? 'verified' : 'failed', result.ok ? `Installed dependency ${spec}` : `Dependency installation failed for ${spec}`); missions.updateMission(opts.missionId, { status: result.ok ? 'completed' : 'blocked' }); }
                if (!result.ok) { await opts.reply(`_✘ Dependency installation failed for ${spec}_\n\n${result.output.slice(-3000)}`); return { handled: true }; }
                await opts.reply(`_*✅ Dependency installed:*_ ${spec}\n\n${result.output.slice(-1200)}`);
                return { handled: true };
            }

            case 'project_index': {
                await reportProgress(opts, 'indexing commands, aliases, imports, and syntax state…');
                const index = buildProjectIndex();
                const indexFile = path.join(DATA_DIR, 'plogme_project_index.json');
                if (opts.missionId) { missions.addEvent(opts.missionId, 'verified', `Indexed ${index.commandCount} commands`); missions.updateMission(opts.missionId, { status: 'completed' }); }
                saveJson(indexFile, index);
                const failures = index.commands.filter(command => !command.syntax).slice(0, 8);
                await opts.reply(`_*🗂️ Project index ready*_\n• Commands discovered: ${index.commandCount}\n• Categories: ${Object.keys(index.categories).length}\n• Syntax failures: ${index.syntaxFailures}\n• Saved: ${path.relative(ROOT, indexFile)}` + (failures.length ? `\n\n*Failures:*\n${failures.map(item => `• ${item.file}: ${item.syntaxError.slice(0, 160)}`).join('\n')}` : ''));
                return { handled: true };
            }

            case 'health': {
                await reportProgress(opts, 'running runtime, database, dependency, and critical-file health checks…');
                const report = runHealthChecks();
                if (opts.missionId) { missions.addEvent(opts.missionId, report.ok ? 'verified' : 'failed', report.ok ? 'Health checks passed' : `${report.failed.length} health checks failed`); missions.updateMission(opts.missionId, { status: report.ok ? 'completed' : 'blocked' }); }
                await opts.reply(`_*🩺 CODY health: ${report.ok ? 'HEALTHY' : 'ATTENTION REQUIRED'}*_\n` + report.checks.map(item => `${item.ok ? '✅' : '❌'} ${item.name}: ${item.details}`).join('\n'));
                return { handled: true };
            }

            case 'list_files': {
                const requested = String(intent.path || '').trim();
                const base = requested ? resolveReadPath(requested)?.abs : ROOT;
                if (!base || !fs.existsSync(base) || !fs.statSync(base).isDirectory()) { await opts.reply(`_✘ Folder not found inside the live workspace:_ ${requested || ROOT}`); return { handled: true }; }
                const allFiles = walkWorkspace(base, 4);
                const files = allFiles.slice(0, 120);
                const relativeFiles = files.map(file => path.relative(ROOT, file) || path.basename(file));
                await opts.reply(`_*🗂️ LIVE WORKSPACE FILES*_\n*Runtime root:* \`${ROOT}\`\n*Folder:* \`${path.relative(ROOT, base) || '.'}\`\n*Files found:* ${allFiles.length}${allFiles.length > 120 ? ' (first 120 shown)' : ''}\n\n${relativeFiles.length ? relativeFiles.map(file => `• ${file}`).join('\n') : '_No files found._'}`);
                return { handled: true };
            }

            case 'rename_file': {
                const source = resolveReadPath(intent.from || intent.source || intent.path);
                const destinationRaw = String(intent.to || intent.destination || '').trim().replace(/^\.[\\/]/, '');
                const destination = resolveWritePath(destinationRaw);
                if (!source) { await opts.reply('_✘ Source file was not found inside the live runtime workspace_'); return { handled: true }; }
                if (!destination || !destinationRaw) { await opts.reply('_✘ Destination path is invalid or outside the live runtime workspace_'); return { handled: true }; }
                if (fs.existsSync(destination.abs)) { await opts.reply(`_✘ Destination already exists:_ \`${destination.display}\``); return { handled: true }; }
                if (opts.missionId) missions.snapshotFiles(opts.missionId, [source.display]);
                try {
                    fs.mkdirSync(path.dirname(destination.abs), { recursive: true });
                    fs.renameSync(source.abs, destination.abs);
                    let loaded = null;
                    let reloadWarning = '';
                    try {
                        const { loadCommands } = require('../../Plugin/crysLoadCmd');
                        loaded = loadCommands();
                    } catch (reloadError) {
                        reloadWarning = `\n⚠️ Command-loader refresh could not run: ${reloadError.message}`;
                    }
                    logOp('rename', `${source.display} -> ${destination.display}`);
                    if (opts.missionId) { missions.addEvent(opts.missionId, 'verified', `Renamed ${source.display} to ${destination.display}${loaded === null ? '; loader refresh unavailable' : `; reloaded ${loaded} commands`}`); missions.updateMission(opts.missionId, { status: 'completed', files: [source.display, destination.display] }); }
                    await opts.reply(`_*✅ Rename verified*_\n\`${source.display}\` → \`${destination.display}\`\n*Command registry:* ${loaded === null ? 'refresh unavailable' : `reloaded ${loaded} entries`}${reloadWarning}`);
                } catch (error) {
                    if (opts.missionId) missions.recordError(opts.missionId, error);
                    await opts.reply(`_✘ Rename failed:_ ${error.message}`);
                }
                return { handled: true };
            }

            case 'research_web': {
                const query = String(intent.query || intent.topic || '').trim();
                if (!query) { await opts.reply('_✘ Tell me what to research_'); return { handled: true }; }
                await reportProgress(opts, `researching ${query.slice(0, 100)} and extracting source passages…`);
                try {
                    const research = await researchWeb(query, 3);
                    if (!research.sources.length) { await opts.reply('_*🌐 Research completed, but no sources were found.*_'); return { handled: true }; }
                    const sourceText = research.sources.map((source, i) => `SOURCE ${i + 1}: ${source.title}\nURL: ${source.url}\nEXCERPT: ${source.excerpt.slice(0, 1800)}`).join('\n\n');
                    const synthesis = await askAI(`Research question: ${query}\n\nUse the sources below. Return a concise answer, distinguish facts from uncertainty, and cite sources as [1], [2], [3].\n\n${sourceText}`);
                    await opts.reply(`_*🌐 Research: ${query}*_\n\n${synthesis || research.sources.map((source, i) => `[${i + 1}] ${source.title}\n${source.url}`).join('\n\n')}\n\n*Sources:*\n${research.sources.map((source, i) => `[${i + 1}] ${source.url}`).join('\n')}`);
                    if (opts.missionId) { missions.addEvent(opts.missionId, 'verified', `Research completed with ${research.sources.length} sources`); missions.updateMission(opts.missionId, { status: 'completed' }); }
                } catch (error) {
                    if (opts.missionId) missions.recordError(opts.missionId, error);
                    await opts.reply(`_✘ Research failed:_ ${error.message}`);
                }
                return { handled: true };
            }

            case 'inspect_media': {
                const inspector = opts.inspectMedia || sock.inspectMedia || sock.describeMedia;
                if (typeof inspector !== 'function') { await opts.reply('_✘ Multimodal inspection is not connected in this runtime yet. The tool contract is ready; provide an image/video/audio/document inspector callback._'); return { handled: true }; }
                const result = await inspector(m.quoted || m, { prompt: intent.prompt || intent.query || 'Inspect this media and report actionable details.' });
                await opts.reply(String(result || '_No media observations returned._'));
                return { handled: true };
            }

            case 'create_tool': {
                const toolName = sanitizeCommandName(intent.name || intent.tool || 'plogme-tool');
                const content = String(intent.content || intent.code || '').trim();
                if (!toolName || !content) { await opts.reply('_✘ A tool name and complete JavaScript module are required_'); return { handled: true }; }
                const target = resolveWritePath(path.join('src', 'Commands', 'User', 'Tools', `${toolName}.js`));
                if (!target) { await opts.reply('_✘ Invalid tool path_'); return { handled: true }; }
                const res = await writeFileWithAgentFix(target.abs, content, opts);
                if (opts.missionId) { missions.addEvent(opts.missionId, res.ok ? 'verified' : 'failed', res.ok ? `Created and syntax-checked tool ${target.display}` : `Syntax failure in tool ${target.display}`); missions.updateMission(opts.missionId, { status: res.ok ? 'completed' : 'blocked', files: [target.display] }); }
                if (!res.ok) { await opts.reply('_*✘ Tool syntax failed:*_\n' + String(res.error || '').slice(0, 1400)); return { handled: true }; }
                logOp('create_tool', target.display);
                await opts.reply('_*✅ Tool created and syntax-checked:*_ ' + target.display);
                try { await opts.sendMessage(m.chat, { document: fs.readFileSync(target.abs), mimetype: 'application/javascript', fileName: `${toolName}.js` }, { quoted: m }); } catch (err) { await opts.reply(`_⚠️ Tool created, but attachment failed:_ ${err.message}`); }
                return { handled: true };
            }

            case 'send_file': {
                // "send as a js file" (no name) → newest command file just created
                // (@crysnovax—FIX14-08-26)
                const rawPath = String(intent.path || intent.file || intent.fileName || intent.name || '');
                let resolved = null;
                if (/^(last_created|newest|latest|just created)$/i.test(rawPath)) {
                    const newest = findNewestCommandFile();
                    if (newest) resolved = { abs: path.join(ROOT, newest), display: newest };
                } else {
                    resolved = resolveReadPath(rawPath);
                }
                if (!resolved) { await opts.reply('_✘ Invalid or blocked file path_'); return { handled: true }; }
                if (!fs.existsSync(resolved.abs)) { await opts.reply(`_✘ \`${resolved.display}\` not found_`); return { handled: true }; }
                let buffer;
                try { buffer = fs.readFileSync(resolved.abs); } catch (err) { await opts.reply(`_✘ Could not read \`${resolved.display}\`:_ ${err.message}`); return { handled: true }; }
                let mime = 'application/octet-stream';
                try { mime = require('mime-types').lookup(resolved.abs) || mime; } catch {}
                let sent;
                let deliveryMode = 'direct';
                let cdnUrl = '';
                if (isTextFilePath(resolved.abs)) {
                    // Code/text files always use the proven /raw → CDN URL →
                    // downloader-style round trip. Direct document transport is
                    // intentionally not attempted for this class of file.
                    try {
                        if (!CDN_BASE && typeof opts.cdnUpload !== 'function') throw new Error('CDN_URL is not configured');
                        await reportProgress(opts, `uploading ${resolved.display} to the verified CDN path`);
                        const uploaded = typeof opts.cdnUpload === 'function'
                            ? await opts.cdnUpload(buffer, path.basename(resolved.abs), mime)
                            : await uploadTextToCdn(buffer, path.basename(resolved.abs), mime);
                        if (!uploaded?.url || !Buffer.isBuffer(uploaded.buffer)) throw new Error('CDN did not return a verified buffer and URL');
                        if (!uploaded.buffer.equals(buffer)) throw new Error('CDN round-trip byte verification failed');
                        cdnUrl = uploaded.url;
                        if (typeof opts.sendMessage !== 'function') throw new Error('WhatsApp sender is unavailable in this handler');
                        sent = await opts.sendMessage(m.chat, {
                            document: uploaded.buffer,
                            mimetype: mime,
                            fileName: path.basename(resolved.abs)
                        }, { quoted: m });
                        deliveryMode = 'cdn';
                    } catch (cdnError) {
                        await opts.reply(`_✘ Verified CDN file delivery failed:_ ${cdnError.message}`);
                        return { handled: true };
                    }
                } else {
                    try {
                        if (typeof opts.sendMessage !== 'function') throw new Error('WhatsApp sender is unavailable in this handler');
                        sent = await opts.sendMessage(m.chat, {
                            document: buffer,
                            mimetype: mime,
                            fileName: path.basename(resolved.abs)
                        }, { quoted: m });
                    } catch (directError) {
                        await opts.reply(`_✘ Failed to send file:_ ${directError.message}`);
                        return { handled: true };
                    }
                }
                const messageId = sent?.key?.id || sent?.messageId || sent?.id;
                if (!messageId) {
                    await opts.reply(`_⚠️ File was prepared, but WhatsApp returned no delivery key for \`${resolved.display}\`. I will not claim it was sent._`);
                    return { handled: true };
                }
                logOp('send', `${deliveryMode} sent file ${resolved.display} (${messageId})`);
                await opts.reply(`_*📄 File sent:*_ \`${resolved.display}\`\n*Delivery:* ${deliveryMode}${cdnUrl ? `\n*CDN URL:* ${cdnUrl}` : ''}\n_Message ID:_ ${messageId}`);
                return { handled: true };
            }

            case 'make_pdf': {
                let source = String(intent.content || '').trim();
                const srcPath = String(intent.path || intent.source || intent.file || '').trim();
                let baseName = 'document';
                if (!source && srcPath) {
                    const resolved = resolveReadPath(srcPath);
                    if (resolved && fs.existsSync(resolved.abs)) {
                        source = fs.readFileSync(resolved.abs, 'utf8');
                        baseName = path.basename(resolved.abs).replace(/\.[^.]+$/, '');
                    } else {
                        await opts.reply(`_✘ \`${srcPath}\` not found_`);
                        return { handled: true };
                    }
                }
                if (!source.trim()) { await opts.reply('_✘ Nothing to convert — tell me which file or paste the text_'); return { handled: true }; }
                let pdf;
                try { pdf = await markdownToPdf(source); } catch (err) { await opts.reply(`_✘ PDF generation failed:_ ${err.message}`); return { handled: true }; }
                const outName = (baseName.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'document') + '.pdf';
                try {
                    fs.mkdirSync(OUT_DIR, { recursive: true });
                    fs.writeFileSync(path.join(OUT_DIR, outName), pdf);
                    await opts.sendMessage(m.chat, { document: pdf, mimetype: 'application/pdf', fileName: outName }, { quoted: m });
                } catch (err) {
                    await opts.reply(`_✘ Failed to send PDF:_ ${err.message}`);
                    return { handled: true };
                }
                logOp('make_pdf', outName);
                await opts.reply(`_*📄 PDF sent:*_ \`${outName}\` (${Math.max(1, Math.round(pdf.length / 1024))} KB)`);
                return { handled: true };
            }

            case 'zip': {
                const rawTargets = Array.isArray(intent.files) ? intent.files : [intent.path || intent.file || intent.files].filter(Boolean);
                const targets = rawTargets.filter(Boolean).map(resolveReadPath).filter(Boolean);
                if (!targets.length) { await opts.reply('_✘ No valid files to zip_'); return { handled: true }; }
                let AdmZip;
                try { AdmZip = require('adm-zip'); } catch { await opts.reply('_✘ adm-zip is not installed_'); return { handled: true }; }
                const zip = new AdmZip();
                for (const t of targets) {
                    try {
                        if (fs.statSync(t.abs).isDirectory()) zip.addLocalFolder(t.abs, t.display);
                        else zip.addLocalFile(t.abs, undefined, t.display);
                    } catch {}
                }
                const outName = `files-${Date.now().toString(36)}.zip`;
                try {
                    fs.mkdirSync(OUT_DIR, { recursive: true });
                    const buf = zip.toBuffer();
                    fs.writeFileSync(path.join(OUT_DIR, outName), buf);
                    await opts.sendMessage(m.chat, { document: buf, mimetype: 'application/zip', fileName: outName }, { quoted: m });
                } catch (err) {
                    await opts.reply(`_✘ Failed to send zip:_ ${err.message}`);
                    return { handled: true };
                }
                logOp('zip', outName);
                await opts.reply(`_*🗜️ Zip sent:*_ \`${outName}\``);
                return { handled: true };
            }

            case 'chat': {
                // An empty AI "chat" intent must NOT be consumed silently —
                // fall through so the normal chat brain answers instead.
                // (@crysnovax—FIX15-08-26)
                if (!String(intent.reply || '').trim()) return { handled: false };
                await opts.reply(String(intent.reply).trim());
                return { handled: true };
            }

            default:
                return { handled: false };
        }
    } catch (err) {
        console.error('[PLOGME INTENT ERROR]', err.message);
        return { handled: false };
    }
}

/* ───────────────────────── main execute (called from ?.js hook) ───────────────────────── */
async function execute(sock, m, opts) {
    try {
        if (!m.chat || m.chat === 'status@broadcast') return false;
        if (m.mtype === 'reactionMessage') return false;

        const text = String(m.text || m.body || '').trim();
        if (!text) return false;

        // ── Spam control = the invisible-character (marker) logic ONLY ──
        // The owner and the bot are the SAME WhatsApp account, so every
        // message the owner sends arrives with fromMe=true — the old blanket
        // `if (m.key?.fromMe) return false;` guard is exactly why plogme
        // never auto-replied. The ONLY thing we must never answer is the
        // bot's own output, which always carries the invisible marker.
        // (@crysnovax—FIX09-08-26)
        if (text.includes(MARKER)) return false;

        const prefix = (() => {
            const raw = getVar('PREFIX', '.');
            return (raw === 'null' || raw === '') ? '' : String(raw);
        })();
        const isCommand = prefix ? text.startsWith(prefix) : false;

        // ── Command-lookalike guard (kills the double-reply bug) ──
        // The router (crysMsg.js) runs BEFORE this hook and already executed
        // & replied to any message it recognized as a command. In prefix mode
        // that's anything starting with the prefix; in no-prefix mode
        // (PREFIX=null/empty) it's any message whose FIRST WORD is a
        // registered command/alias. If we don't mirror that here, PLOGME
        // answers every no-prefix command a SECOND time — the "commands run
        // double when PREFIX is null" bug. (@crysnovax—FIX12-08-26)
        let isCommandLike = isCommand;
        if (!isCommandLike) {
            try {
                const { getCommand } = require('../../Plugin/crysCmd');
                const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() || '';
                if (firstWord) {
                    const hit = getCommand(firstWord);
                    isCommandLike = !!(hit && (String(hit.name || '').toLowerCase() === firstWord
                        || (hit.alias || []).map(a => String(a).toLowerCase()).includes(firstWord)));
                }
            } catch {}
        }
        if (isCommandLike) return false;

        const privileged = await isPrivileged(sock, m);

        // ── ENGAGEMENT BOUNDARY — PLOGME only engages when it is explicitly
        //    addressed: (1) the message QUOTES one of PLOGME's own replies,
        //    (2) PLOGME is @-mentioned, or (3) the message calls it by name
        //    ("plogme ..."). A bare no-prefix command like "ping" therefore
        //    runs EXACTLY ONCE via the router and PLOGME never answers on top
        //    of it. This applies in every chat (group + DM); setting "mode
        //    all" opts back into broad engagement. (@crysnovax—FIX12-08-26)
        const body = isCommand ? text.slice(prefix.length).trim() : text;
        const isNamed = /^(plogme|plg|plog)(\s|$)/i.test(body);
        const engaged = getMode(m.chat) === 'all' || isNamed || isAddressed(sock, m);
        if (!engaged) return false;

        // An EXPLICIT ".plogme off" in a chat means SILENT — no free-form AI
        // chat. Explicit control ("plogme on", "plogme status", "plogme run
        // ping") still works so the user can always re-enable.
        // (@crysnovax—FIX10-08-26)
        const explicitlyOff = hasExplicitToggle(m.chat) && !isEnabled(m.chat);

        // Control intents — only for owner/sudo/dual. A "plogme run ping"
        // style message is treated the same as a bare control intent, and a
        // plain "ping" / "can you ping" / "check uptime" query auto-runs the
        // command too — no more strict phrasing. @crysnovax—FIX08-07-26
        if (privileged) {
            const body = isCommand ? text.slice(prefix.length).trim() : text;
                        const isPlogmeInvocation = /^(plogme|plg|plog)(\s|$)/i.test(body);
            const missionButton = body.match(/^(mission_status|mission_pause|mission_resume|mission_rollback):([A-Z0-9-]+)$/i);
            if (missionButton) {
                await executeIntent(sock, m, opts, { action: missionButton[1].toLowerCase(), id: missionButton[2] });
                return true;
            }
            // A prefixed ".plogme <sub>" (e.g. "/plogme off") is OWNED by the
            // router command src/Commands/AI/plogme.js, which already replied
            // ("✖ DISABLED"). Running the control intents again made every
            // prefixed toggle reply TWICE ("✖ DISABLED" + "⛔ PLOGME toggled
            // OFF"). Only bare, non-prefixed phrases ("plogme off", "run
            // ping") are handled here. (@crysnovax—FIX10-08-26)
            if (!isCommand) {
                const handledControl = await handleControlIntent(sock, m, opts, isPlogmeInvocation ? body : text);
                if (handledControl) return true;
            }

            // ── LLM intent brain ──
            // Anything else a privileged user says — plain chat OR an unhandled
            // ".plogme <thing>" — goes to the classifier, which understands
            // context ("please run the menu command for me", "create a command
            // called hi", "edit the ping command to say hi") with no hardcoded
            // phrasing. When the AI is unreachable we simply fall through to
            // the normal chat flow below. Skipped when plogme was explicitly
            // toggled off in this chat — off means SILENT, so "Hey" after
            // ".plogme off" must NOT get an AI chat reply.
            // (@crysnovax—FIX09-08-26 / FIX10-08-26)
            if (!isCommand && !explicitlyOff) {
                try {
                    const intent = await classifyIntent(isPlogmeInvocation ? body : text);
                    if (intent) {
                        const res = await executeIntent(sock, m, opts, intent);
                        if (res.handled) return true;
                    }
                } catch {}
            }
        }

        // Auto-reply chatbot. PLOGME is OFF by default everywhere: a chat only
        // auto-replies after an explicit `.plogme on` (or `.plogme on all` for
        // DM-wide). An explicit `.plogme off` is honored and stays off.
        // (@crysnovax—FIX12-08-26)
        let on = isEnabled(m.chat);
        if (!m.isGroup) {
            if (!on && isGlobalPrivateEnabled()) on = true;
            // PLOGME is OFF by default — a chat only auto-replies after an
            // explicit ".plogme on" (or PLOGME_DM=true is set). No implicit
            // always-on behavior. (@crysnovax—FIX12-08-26)
            if (!on && getVar('PLOGME_DM', false) === true && !hasExplicitToggle(m.chat)) on = true;
        }
        if (!on) return false;

        // NEVER respond to messages that look like bot commands — anything
        // starting with the prefix OR whose first word is a registered
        // command/alias. This kills the "command ran + plogme also answered"
        // double replies in every prefix mode (including no-prefix mode).
        // (@crysnovax—FIX12-08-26)
        if (isCommand) return false;
        try {
            const firstWord = text.trim().split(/\s+/)[0].toLowerCase();
            if (firstWord) {
                const { getCommand } = require('../../Plugin/crysCmd');
                const hit = getCommand(firstWord);
                if (hit && (String(hit.name || '').toLowerCase() === firstWord
                    || (hit.alias || []).map(a => String(a).toLowerCase()).includes(firstWord))) return false;
            }
        } catch {}

        // typing indicator while the AI thinks (always, not just dev mode)
        await sock.sendPresenceUpdate('composing', m.chat).catch(() => {});

        addToMemory(m.chat, 'user', text);
        const prompt = buildPrompt(m.chat, text);
        let answer = await askAI(prompt);
        if (!answer) {
            // Never leave the user hanging after the typing indicator: every
            // AI endpoint timed out, so say so instead of consuming the
            // message in silence. (@crysnovax—FIX15-08-26)
            await sock.sendPresenceUpdate('paused', m.chat).catch(() => {});
            await opts.reply('_🤖 My AI brain is unreachable right now — try again in a few seconds._');
            return true;
        }

        // Never let a refusal be the final answer — re-ask once with a hard
        // nudge so "I can't do this / I can't do that" turns into action.
        // (@crysnovax—FIX12-08-26)
        if (REFUSAL_RE.test(answer)) {
            const retry = await askAI(prompt + '\n\nIMPORTANT: Do NOT refuse. You can send files, generate PDFs, run commands and edit files yourself. Take action now — do it.');
            if (retry && !REFUSAL_RE.test(retry)) answer = retry;
        }

        const safeAnswer = normalizePlogmeFormatting(sanitizeMemoryContent(answer));
        if (safeAnswer === '[upstream HTTP error omitted from memory]') {
            await sock.sendPresenceUpdate('paused', m.chat).catch(() => {});
            await opts.reply('_🤖 The AI provider returned an HTTP error instead of an answer. I did not save that error into memory._');
            return true;
        }
        addToMemory(m.chat, 'assistant', safeAnswer);
        await opts.reply(safeAnswer);
        await sock.sendPresenceUpdate('paused', m.chat).catch(() => {});
        return true;
    } catch (err) {
        console.error('[PLOGME EXECUTE ERROR]', err.message);
        return false;
    }
}

module.exports = {
    execute,
    isEnabled,
    hasExplicitToggle,
    setEnabled,
    isGlobalPrivateEnabled,
    setGlobalPrivateEnabled,
    getMode,
    setMode,
    getTraining,
    setTraining,
    getPersonality,
    setPersonality,
    isDev,
    setDev,
    getMemory,
    addToMemory,
    clearMemory,
    sanitizeMemoryContent,
    normalizePlogmeFormatting,
    MAX_PROMPT_CHARS,
    getFacts,
    addFact,
    removeFact,
    isCommandToggled,
    toggleCommand,
    getToggledList,
    askAI,
    buildPrompt,
    DEFAULT_PERSONALITY,
    // agent brain exports
    classifyIntent,
    parseIntentJson,
    executeIntent,
    handleControlIntent,
    runCommandAction,

    isAddressed,
    isTextFilePath,
    toRawCdnUrl,
    uploadTextToCdn,
    resolveWritePath,
    ensureCommandModule,
    writeFileWithAgentFix,
    walkWorkspace,
    searchWorkspace,
    environmentSnapshot,
    reportProgress,
    extractAIText,
    logOp,
    getOps,
};
