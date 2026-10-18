'use strict';

const fs = require('fs');
const path = require('path');
const { identityVariants, normalizeJid, resolveCommandTarget } = require('./identityUtils');

const DB_PATH = path.join(process.cwd(), 'database', 'anti-permits.json');

function readDB() {
    try {
        return fs.existsSync(DB_PATH)
            ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
            : { groups: {} };
    } catch {
        return { groups: {} };
    }
}

function writeDB(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function normalize(value) {
    return normalizeJid(String(value || '')).toLowerCase().trim();
}

function ensureGroup(db, chat) {
    if (!db.groups || typeof db.groups !== 'object') db.groups = {};
    if (!Array.isArray(db.groups[chat])) db.groups[chat] = [];
    db.groups[chat] = [...new Set(db.groups[chat].map(normalize).filter(Boolean))];
    return db.groups[chat];
}

async function expandIdentities(sock, candidates = []) {
    const expanded = new Set();
    for (const candidate of candidates.filter(Boolean)) {
        for (const variant of await identityVariants(sock, candidate)) {
            const normalized = normalize(variant);
            if (normalized) expanded.add(normalized);
        }
    }
    return expanded;
}

async function isAntiPermitted(sock, chat, candidates = []) {
    if (!chat) return false;
    const db = readDB();
    const permitted = Array.isArray(db.groups?.[chat]) ? db.groups[chat].map(normalize) : [];
    if (!permitted.length) return false;
    const identities = await expandIdentities(sock, candidates);
    return permitted.some(jid => identities.has(jid));
}

async function resolvePermitTarget(sock, m, rawValue = '') {
    return resolveCommandTarget(sock, m, rawValue);
}

function addPermit(chat, jid) {
    const db = readDB();
    const permits = ensureGroup(db, chat);
    const normalized = normalize(jid);
    if (!normalized) return { changed: false, permits };
    const changed = !permits.includes(normalized);
    if (changed) permits.push(normalized);
    writeDB(db);
    return { changed, permits };
}

function removePermit(chat, jid) {
    const db = readDB();
    const permits = ensureGroup(db, chat);
    const normalized = normalize(jid);
    const remaining = permits.filter(item => item !== normalized);
    const changed = remaining.length !== permits.length;
    db.groups[chat] = remaining;
    writeDB(db);
    return { changed, permits: remaining };
}

function listPermits(chat) {
    const db = readDB();
    return Array.isArray(db.groups?.[chat]) ? db.groups[chat].map(normalize).filter(Boolean) : [];
}

module.exports = {
    DB_PATH,
    addPermit,
    isAntiPermitted,
    listPermits,
    normalize,
    readDB,
    removePermit,
    resolvePermitTarget,
    writeDB,
};
