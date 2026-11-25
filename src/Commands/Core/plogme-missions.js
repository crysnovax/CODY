'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'database');
const STORE_FILE = path.join(DATA_DIR, 'plogme_missions.json');
const SNAPSHOT_DIR = path.join(DATA_DIR, 'plogme_snapshots');
const MAX_EVENTS = 200;
const MAX_MISSIONS = 100;

function readStore() {
    try {
        if (!fs.existsSync(STORE_FILE)) return { missions: {} };
        const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
        return parsed && typeof parsed === 'object' && parsed.missions ? parsed : { missions: {} };
    } catch {
        return { missions: {} };
    }
}

function writeStore(store) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const temp = `${STORE_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(store, null, 2));
    fs.renameSync(temp, STORE_FILE);
}

function now() { return new Date().toISOString(); }
function missionId() { return `PLOGME-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`; }

function createMission(input = {}) {
    const store = readStore();
    const id = missionId();
    const mission = {
        id,
        chat: String(input.chat || ''),
        owner: String(input.owner || ''),
        objective: String(input.objective || 'Unspecified objective').slice(0, 1000),
        status: 'planning',
        step: 0,
        plan: Array.isArray(input.plan) ? input.plan.map(String).slice(0, 50) : [],
        files: [],
        tests: [],
        errors: [],
        snapshots: [],
        events: [{ at: now(), type: 'created', message: 'Mission created' }],
        createdAt: now(),
        updatedAt: now()
    };
    store.missions[id] = mission;
    const ids = Object.keys(store.missions);
    while (ids.length > MAX_MISSIONS) delete store.missions[ids.shift()];
    writeStore(store);
    return mission;
}

function getMission(id) { return readStore().missions[String(id)] || null; }
function listMissions(options = {}) {
    const missions = Object.values(readStore().missions).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return options.status ? missions.filter(m => m.status === options.status) : missions;
}

function updateMission(id, patch = {}) {
    const store = readStore();
    const current = store.missions[String(id)];
    if (!current) return null;
    const next = { ...current, ...patch, id: current.id, updatedAt: now() };
    next.events = Array.isArray(patch.events) ? patch.events : current.events;
    store.missions[current.id] = next;
    writeStore(store);
    return next;
}

function addEvent(id, type, message, extra = {}) {
    const mission = getMission(id);
    if (!mission) return null;
    const events = [...(mission.events || []), { at: now(), type: String(type), message: String(message), ...extra }].slice(-MAX_EVENTS);
    return updateMission(id, { events });
}

function setStep(id, step, status, message) {
    const mission = updateMission(id, { step: Number(step) || 0, ...(status ? { status: String(status) } : {}) });
    return message ? addEvent(id, 'progress', message, { step: Number(step) || 0 }) : mission;
}

function recordTest(id, name, passed, details = '') {
    const mission = getMission(id);
    if (!mission) return null;
    const tests = [...(mission.tests || []), { name: String(name), passed: !!passed, details: String(details).slice(0, 2000), at: now() }].slice(-100);
    return updateMission(id, { tests });
}

function recordError(id, error) {
    const mission = getMission(id);
    if (!mission) return null;
    const errors = [...(mission.errors || []), { message: String(error?.message || error), at: now() }].slice(-50);
    return updateMission(id, { errors, status: 'blocked' });
}

function recoverMission(id) {
    const mission = getMission(id);
    if (!mission) return null;
    updateMission(id, { status: 'running', recoveryCount: Number(mission.recoveryCount || 0) + 1 });
    addEvent(id, 'recovery', `Mission resumed from ${mission.status}`);
    return getMission(id);
}

function snapshotFiles(id, files = []) {
    const mission = getMission(id);
    if (!mission) return null;
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    const snapshotId = `${id}-${Date.now().toString(36)}`;
    const dir = path.join(SNAPSHOT_DIR, snapshotId);
    fs.mkdirSync(dir, { recursive: true });
    const entries = [];
    for (const raw of files) {
        const abs = path.resolve(ROOT, String(raw));
        if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) continue;
        if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
        const rel = path.relative(ROOT, abs);
        const target = path.join(dir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(abs, target);
        entries.push(rel);
    }
    const snapshots = [...(mission.snapshots || []), { id: snapshotId, dir, files: entries, at: now() }].slice(-10);
    updateMission(id, { snapshots });
    return { id: snapshotId, dir, files: entries };
}

function recordMoveSnapshot(id, from, to) {
    const mission = getMission(id);
    if (!mission) return null;
    const moves = [...(mission.moves || []), { from: String(from), to: String(to), at: now() }].slice(-20);
    updateMission(id, { moves });
    return moves.at(-1);
}

function rollbackMission(id, snapshotId) {
    const mission = getMission(id);
    if (!mission) return { ok: false, error: 'Mission not found' };
    const snapshot = (mission.snapshots || []).find(item => item.id === snapshotId) || mission.snapshots?.at(-1);
    if (!snapshot || !fs.existsSync(snapshot.dir)) return { ok: false, error: 'Snapshot not found' };
    for (const rel of snapshot.files || []) {
        const source = path.join(snapshot.dir, rel);
        const target = path.resolve(ROOT, rel);
        if (fs.existsSync(source)) {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(source, target);
        }
    }
    for (const move of [...(mission.moves || [])].reverse()) {
        const from = path.resolve(ROOT, move.from);
        const to = path.resolve(ROOT, move.to);
        if (fs.existsSync(to) && !fs.existsSync(from)) {
            fs.mkdirSync(path.dirname(from), { recursive: true });
            fs.renameSync(to, from);
        }
    }
    addEvent(id, 'rollback', `Restored snapshot ${snapshot.id}`);
    return { ok: true, snapshot: snapshot.id, files: snapshot.files || [] };
}

module.exports = {
    STORE_FILE,
    SNAPSHOT_DIR,
    createMission,
    getMission,
    listMissions,
    updateMission,
    addEvent,
    setStep,
    recordTest,
    recordError,
    recoverMission,
    snapshotFiles,
    recordMoveSnapshot,
    rollbackMission
};
