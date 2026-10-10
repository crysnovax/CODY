'use strict';
const fs = require('fs');
const path = require('path');
const DB_PATH = path.join(process.cwd(), 'database', 'modlog.json');
const MAX_ENTRIES = 500;
const AUDITED_COMMANDS = /^(?:anti\w+|no(?:sticker|voice|doc|poll|event)|warn|resetwarn|kick|mute|unmute|promote|demote|addmode|setapproval|ephemeral|setwelcome|setgoodbye|slowmode|antiraid)$/i;

function readDB() {
    try { return fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) : {}; }
    catch { return {}; }
}
function writeDB(db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function prune(entries, retentionDays, now = Date.now()) {
    const cutoff = now - Math.max(1, Number(retentionDays) || 30) * 86_400_000;
    return (Array.isArray(entries) ? entries : []).filter(entry => Number.isFinite(entry.timestamp) && entry.timestamp >= cutoff).slice(-MAX_ENTRIES);
}
function enabledConfig(db, group) {
    const config = db[group];
    if (!config?.enabled) return null;
    config.retentionDays = Math.min(90, Math.max(1, Number(config.retentionDays) || 30));
    config.entries = prune(config.entries, config.retentionDays);
    return config;
}
function record(group, event) {
    if (!group || !event) return false;
    const db = readDB();
    const config = enabledConfig(db, group);
    if (!config) return false;
    // Deliberately retain metadata only: no message bodies, captions, links, or arguments.
    config.entries.push({
        timestamp: Date.now(),
        kind: String(event.kind || 'moderation_action').slice(0, 32),
        command: String(event.command || '').slice(0, 48),
        action: String(event.action || '').slice(0, 48),
        actor: String(event.actor || '').slice(0, 100),
        target: String(event.target || '').slice(0, 100),
    });
    config.entries = prune(config.entries, config.retentionDays);
    writeDB(db);
    return true;
}
function recordAdminCommand(group, command, actor) {
    if (!AUDITED_COMMANDS.test(String(command || ''))) return false;
    return record(group, { kind: 'admin_command', command, actor });
}
function recordAction(group, { command, actor, target, action } = {}) {
    return record(group, { kind: 'moderation_action', command, actor, target, action });
}
function isAuditedCommand(command) {
    return AUDITED_COMMANDS.test(String(command || ''));
}
module.exports = { DB_PATH, MAX_ENTRIES, readDB, writeDB, prune, record, recordAdminCommand, recordAction, isAuditedCommand };
