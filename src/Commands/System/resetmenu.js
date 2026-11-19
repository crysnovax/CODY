'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { delVar } = require('../../Plugin/configManager');

const ENV_PATH = path.join(process.cwd(), '.env');
const USER_CONFIG_PATH = path.join(__dirname, '../../../database/user-config.json');
const MENU_MEDIA_KEYS = ['MENU_GIF', 'MENU_IMG', 'MENU_VIDEO', 'MENU_URL', 'THUMB_URL'];
const MENU_MEDIA_KEY_SET = new Set(MENU_MEDIA_KEYS);

function writeAtomically(filePath, contents) {
    const mode = fs.existsSync(filePath) ? (fs.statSync(filePath).mode & 0o777) : 0o600;
    const tempPath = `${filePath}.tmp-resetmenu-${process.pid}`;
    try {
        fs.writeFileSync(tempPath, contents, { encoding: 'utf8', mode });
        fs.renameSync(tempPath, filePath);
    } catch (error) {
        try { fs.unlinkSync(tempPath); } catch {}
        throw error;
    }
}

function clearEnvironmentOverrides() {
    if (!fs.existsSync(ENV_PATH)) return false;

    const raw = fs.readFileSync(ENV_PATH, 'utf8');
    const newline = raw.includes('\r\n') ? '\r\n' : '\n';
    const hadFinalNewline = /(?:\r\n|\n)$/.test(raw);
    const lines = raw.split(/\r?\n/);
    if (hadFinalNewline) lines.pop();
    const kept = lines.filter(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return true;
        const assignment = trimmed.replace(/^export\s+/, '');
        const separator = assignment.indexOf('=');
        if (separator < 0) return true;
        const key = assignment.slice(0, separator).trim();
        return !MENU_MEDIA_KEY_SET.has(key);
    });
    const updated = kept.join(newline) + (hadFinalNewline ? newline : '');

    if (updated !== raw) writeAtomically(ENV_PATH, updated);
    return updated !== raw;
}

function clearUserConfigThumbUrl() {
    if (!fs.existsSync(USER_CONFIG_PATH)) return false;

    const raw = fs.readFileSync(USER_CONFIG_PATH, 'utf8');
    let userConfig;
    try { userConfig = JSON.parse(raw); } catch { return false; }
    if (!userConfig || typeof userConfig !== 'object' || !Object.prototype.hasOwnProperty.call(userConfig, 'thumbUrl')) return false;

    delete userConfig.thumbUrl;
    writeAtomically(USER_CONFIG_PATH, `${JSON.stringify(userConfig, null, 2)}\n`);
    return true;
}

function invalidateSettingsConfig() {
    try {
        delete require.cache[require.resolve('../../../settings/config')];
    } catch {}
}

module.exports = {
    name: 'resetmenu',
    alias: ['menureset'],
    desc: 'Restore the menu to its default live photo',
    category: 'Owner',
    ownerOnly: true,
    usage: 'resetmenu',
    reactions: { start: '↩️', success: '✅' },

    execute: async (sock, m, { reply, prefix = '.' } = {}) => {
        try {
            clearEnvironmentOverrides();
            clearUserConfigThumbUrl();

            for (const key of MENU_MEDIA_KEYS) {
                delVar(key);
                delete process.env[key];
            }
            invalidateSettingsConfig();

            return reply(`✓ Menu media reset to the default live photo. Use ${prefix}menu to preview it.`);
        } catch (error) {
            return reply(`✘ Could not reset menu media: ${error?.message || 'unknown error'}`);
        }
    }
};
