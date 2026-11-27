'use strict';

// Deterministic runtime guardrails for PLOGME's model-selected tools. The model
// may propose structured work, but this module owns risk metadata, execution
// limits, verification metadata, and durable recovery state.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'database');
const PROFILE_FILE = path.join(DATA_DIR, 'plogme_profiles.json');
const JOURNAL_FILE = path.join(DATA_DIR, 'plogme_mutations.json');
const MAX_PARALLEL = 3;

const TOOL_REGISTRY = Object.freeze({
    run_command: { risk: 'high', mutating: true, isolated: true, description: 'Run a registered bot command with bounded execution.' },
    isolated_command: { risk: 'high', mutating: true, isolated: true, description: 'Run an allowlisted executable without a shell, bounded by timeout and output limits.' },
    create_file: { risk: 'medium', mutating: true, verifiable: true, description: 'Create a workspace file and verify its contents.' },
    edit_file: { risk: 'medium', mutating: true, verifiable: true, description: 'Edit a workspace file and verify syntax where applicable.' },
    delete_file: { risk: 'high', mutating: true, reversible: true, verifiable: true, description: 'Delete a workspace file with rollback support.' },
    rename_file: { risk: 'medium', mutating: true, reversible: true, verifiable: true, description: 'Rename a workspace file and verify both paths.' },
    restart: { risk: 'high', mutating: true, description: 'Restart the bot process.' },
    install_dependency: { risk: 'high', mutating: true, description: 'Install a validated npm dependency.' },
    set_pp: { risk: 'medium', mutating: true, description: 'Change a bot or group profile picture.' },
    group_name: { risk: 'high', mutating: true, description: 'Change a group name.' },
    kick: { risk: 'high', mutating: true, description: 'Remove a group participant.' },
    promote: { risk: 'high', mutating: true, description: 'Promote a group participant.' },
    demote: { risk: 'high', mutating: true, description: 'Demote a group participant.' },
    antis: { risk: 'medium', mutating: true, description: 'Change anti-abuse protection settings.' },
    search_file: { risk: 'low', readonly: true, description: 'Search workspace files.' },
    search_code: { risk: 'low', readonly: true, description: 'Search source code.' },
    search_web: { risk: 'low', readonly: true, description: 'Search the web.' },
    health: { risk: 'low', readonly: true, description: 'Run health checks.' },
    project_index: { risk: 'low', readonly: true, description: 'Build a project index.' },
    inspect_media: { risk: 'low', readonly: true, description: 'Inspect quoted media.' },
    send_file: { risk: 'low', readonly: true, description: 'Prepare and deliver a file.' },
    make_pdf: { risk: 'medium', mutating: true, verifiable: true, description: 'Generate a PDF artifact.' },
    zip: { risk: 'medium', mutating: true, verifiable: true, description: 'Generate a ZIP artifact.' }
});

function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2));
    fs.renameSync(temp, file);
}
function id(prefix) { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`; }

function toolInfo(action) { return TOOL_REGISTRY[String(action || '').toLowerCase()] || { risk: 'medium', mutating: false, description: 'Unclassified tool' }; }
function toolCatalog() { return Object.entries(TOOL_REGISTRY).map(([name, info]) => ({ name, ...info })); }
function isDryRun(intent = {}, opts = {}) {
    return intent.dryRun === true || opts.dryRun === true || /^(dry[ -]?run|preview|what would you change)\b/i.test(String(opts.userRequest || ''));
}
function normalizePlan(intent = {}) {
    const raw = Array.isArray(intent.steps) ? intent.steps : [];
    return raw.map((step, index) => {
        if (typeof step === 'string') return { action: step, dependsOn: index ? [index - 1] : [] };
        return { ...(step || {}), action: String(step?.action || '').toLowerCase(), dependsOn: Array.isArray(step?.dependsOn) ? step.dependsOn : [] };
    }).filter(step => TOOL_REGISTRY[step.action] || step.action === 'chat');
}
function makePlan(intent = {}) {
    const steps = normalizePlan(intent);
    if (steps.length) return { goal: String(intent.goal || intent.objective || ''), steps };
    return { goal: String(intent.goal || intent.objective || intent.action || ''), steps: [{ ...intent, action: String(intent.action || '').toLowerCase(), dependsOn: [] }] };
}

function verifyPath(filePath, expected = {}) {
    const abs = path.resolve(ROOT, String(filePath || ''));
    const exists = fs.existsSync(abs);
    const isFile = exists && fs.statSync(abs).isFile();
    return { ok: expected.exists === false ? !exists : (expected.directory ? exists && !isFile : exists && isFile), path: path.relative(ROOT, abs), exists, isFile };
}
function verifyTool(action, details = {}) {
    const info = toolInfo(action);
    const checks = Array.isArray(details.checks) ? details.checks : [];
    const failed = checks.filter(check => check && check.ok === false);
    return { ok: failed.length === 0 && details.ok !== false, action, verified: info.verifiable !== false, checks, failed: failed.length };
}

function rememberProfile(chat, category, value, metadata = {}) {
    const profiles = readJson(PROFILE_FILE, {});
    const key = String(chat || 'global');
    if (!profiles[key] || typeof profiles[key] !== 'object') profiles[key] = { preferences: {}, facts: [], safety: [], project: {} };
    const bucket = ['preferences', 'facts', 'safety', 'project'].includes(category) ? category : 'preferences';
    if (bucket === 'project') profiles[key].project = { ...profiles[key].project, [String(metadata.key || 'note')]: String(value) };
    else profiles[key][bucket] = [...new Set([...(profiles[key][bucket] || []), String(value).slice(0, 1000)])].slice(-100);
    writeJson(PROFILE_FILE, profiles);
    return profiles[key];
}
function getProfile(chat) {
    const profiles = readJson(PROFILE_FILE, {});
    return profiles[String(chat || 'global')] || { preferences: [], facts: [], safety: [], project: {} };
}

async function runParallel(tasks, limit = MAX_PARALLEL) {
    const jobs = Array.isArray(tasks) ? tasks : [];
    const results = new Array(jobs.length);
    let cursor = 0;
    async function worker() {
        while (true) {
            const index = cursor++;
            if (index >= jobs.length) return;
            try { results[index] = await jobs[index](); }
            catch (error) { results[index] = { ok: false, error: error.message }; }
        }
    }
    await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), MAX_PARALLEL, jobs.length) }, worker));
    return results;
}

function runIsolatedCommand(command, args = [], options = {}) {
    const executable = String(command || '').trim();
    if (!/^[a-zA-Z0-9._/-]+$/.test(executable) || executable.includes('..')) return { ok: false, error: 'Command executable is not allowed.' };
    const safeArgs = (Array.isArray(args) ? args : []).map(String).slice(0, 40);
    const env = {};
    for (const name of ['PATH', 'NODE_PATH', 'LANG', 'HOME', 'TMPDIR']) if (process.env[name]) env[name] = process.env[name];
    const result = spawnSync(executable, safeArgs, {
        cwd: ROOT,
        env,
        timeout: Math.min(Number(options.timeout) || 20000, 60000),
        maxBuffer: 1024 * 1024,
        encoding: 'utf8',
        shell: false
    });
    if (result.error) return { ok: false, error: result.error.message, timedOut: result.error.code === 'ETIMEDOUT' };
    return { ok: result.status === 0, code: result.status, stdout: String(result.stdout || '').slice(0, 12000), stderr: String(result.stderr || '').slice(0, 4000) };
}

function recordMutation(input = {}) {
    const journal = readJson(JOURNAL_FILE, { entries: [] });
    const entry = { id: id('MUT'), at: new Date().toISOString(), ...input };
    journal.entries = [...(journal.entries || []), entry].slice(-200);
    writeJson(JOURNAL_FILE, journal);
    return entry;
}
function listMutations(limit = 20) { return readJson(JOURNAL_FILE, { entries: [] }).entries.slice(-limit); }

module.exports = {
    ROOT, MAX_PARALLEL, TOOL_REGISTRY, toolInfo, toolCatalog,
    isDryRun, normalizePlan, makePlan,
    verifyPath, verifyTool, rememberProfile, getProfile, runParallel,
    runIsolatedCommand, recordMutation, listMutations
};
