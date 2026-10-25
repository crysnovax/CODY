'use strict';

const fs = require('fs');
const path = require('path');

function resolveStorePath() {
    return process.env.CODY_ALLADMIN_DB || path.join(process.cwd(), 'database', 'alladmin.json');
}

function readAllAdminSettings(storePath = resolveStorePath()) {
    try {
        if (!fs.existsSync(storePath)) return {};
        const value = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
        // Fail closed if the state file is unreadable or malformed.
        return {};
    }
}

function writeAllAdminSettings(settings, storePath = resolveStorePath()) {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    const temporaryPath = `${storePath}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(temporaryPath, JSON.stringify(settings, null, 2), 'utf8');
        fs.renameSync(temporaryPath, storePath);
    } catch (error) {
        try { fs.rmSync(temporaryPath, { force: true }); } catch {}
        throw error;
    }
}

function isAllAdminEnabled(groupJid, storePath = resolveStorePath()) {
    if (typeof groupJid !== 'string' || !groupJid.endsWith('@g.us')) return false;
    return readAllAdminSettings(storePath)[groupJid] === true;
}

function setAllAdminEnabled(groupJid, enabled, storePath = resolveStorePath()) {
    if (typeof groupJid !== 'string' || !groupJid.endsWith('@g.us')) {
        throw new TypeError('A valid WhatsApp group JID is required.');
    }
    if (typeof enabled !== 'boolean') throw new TypeError('enabled must be a boolean.');
    const settings = readAllAdminSettings(storePath);
    if (enabled) settings[groupJid] = true;
    else delete settings[groupJid];
    writeAllAdminSettings(settings, storePath);
    return enabled;
}

function isProtectedCommand(cmd) {
    return Boolean(cmd?.ownerOnly || cmd?.sudoOnly || cmd?.privilegedOnly);
}

function hasAllAdminAccess({ groupJid, isGroup, isAdmin, enabled, command }) {
    return Boolean(
        isGroup &&
        isAdmin &&
        enabled &&
        groupJid?.endsWith('@g.us') &&
        command?.category === 'Admin' &&
        !isProtectedCommand(command)
    );
}

function isAllAdminCommandBlocked({ enabled, isAdmin, command }) {
    return Boolean(enabled && command?.category === 'Admin' && !isAdmin);
}

function canManageAllAdmin({ isGroup, isAdmin }) {
    return Boolean(isGroup && isAdmin);
}

module.exports = {
    resolveStorePath,
    readAllAdminSettings,
    writeAllAdminSettings,
    isAllAdminEnabled,
    setAllAdminEnabled,
    isProtectedCommand,
    hasAllAdminAccess,
    isAllAdminCommandBlocked,
    canManageAllAdmin,
};
