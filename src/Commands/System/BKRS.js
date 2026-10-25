const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { formatBotDateTime } = require('../../Utils/timezone');

const DEFAULT_BACKUP_API = 'https://bk.crysnovax.com';
const BACKUP_REQUEST_TIMEOUT = 30000;
const backupSession = new Map();
const restoreSession = new Map();
const SENSITIVE_ENV_NAME = /(?:SESSION|AUTH|CRED|TOKEN|SECRET|PASSWORD|API.?KEY|PRIVATE.?KEY)/i;
const SENSITIVE_OBJECT_KEY = /(?:SESSION|AUTH|CRED|TOKEN|SECRET|PASSWORD|API.?KEY|PRIVATE.?KEY)/i;
const EXCLUDED_PATH_SEGMENTS = new Set(['session', 'sessions', 'creds', 'credentials', 'auth', 'authstate']);
const EXCLUDED_OBJECT_KEYS = new Set([
    'session', 'sessions', 'sessionid', 'sessiondata', 'sessionpath', 'sessionfile',
    'sessionstate', 'sessionjson', 'sessionsjson', 'sessioncreds', 'sessioncredentials',
    'sessionauthstate', 'authstate', 'authstatejson', 'authstatepath', 'creds',
    'credsjson', 'credentials', 'whatsappauth', 'whatsappsession', 'baileysauth', 'baileyssession'
]);

class BackupConfigError extends Error {}

function normalizePhone(value) {
    const phone = String(value || '').replace(/\D/g, '');
    if (phone.length < 7 || phone.length > 15) throw new Error('Enter a phone number with 7–15 digits.');
    return phone;
}

function getBackupApiConfig() {
    const baseUrl = String(process.env.BACKUP_API_URL || DEFAULT_BACKUP_API).trim().replace(/\/+$/, '');
    const token = String(process.env.BACKUP_API_TOKEN || 'x').trim();

    if (!token || token.length < 32) {
        throw new BackupConfigError('Backup is not configured: set BACKUP_API_TOKEN to a random secret of at least characters.');
    }
    let parsed;
    try { parsed = new URL(baseUrl); } catch { throw new BackupConfigError('BACKUP_API_URL is not a valid URL.'); }
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
        throw new BackupConfigError('BACKUP_API_URL must use HTTPS.');
    }
    return { baseUrl, token };
}

function getBackupConfig() {
    return getBackupApiConfig();
}

async function backupApiPost(endpoint, payload) {
    const { baseUrl, token } = getBackupApiConfig();
    return axios.post(`${baseUrl}${endpoint}`, payload, {
        timeout: BACKUP_REQUEST_TIMEOUT,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        headers: { Authorization: `Bearer ${token}` }
    });
}

function normalizedKey(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isExcludedPath(relativePath) {
    return String(relativePath).split(/[\\/]/).some(segment => EXCLUDED_PATH_SEGMENTS.has(normalizedKey(segment)));
}

function sanitizeObject(value) {
    if (Array.isArray(value)) return value.map(sanitizeObject);
    if (!value || typeof value !== 'object') return value;
    const result = {};
    for (const [key, child] of Object.entries(value)) {
        if (!EXCLUDED_OBJECT_KEYS.has(normalizedKey(key)) && !SENSITIVE_OBJECT_KEY.test(key)) result[key] = sanitizeObject(child);
    }
    return result;
}

function sanitizeEnvironment(contents) {
    return String(contents || '').split(/\r?\n/).filter(line => {
        const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
        return !match || !SENSITIVE_ENV_NAME.test(match[1]);
    }).join('\n').trim();
}

function collectDatabaseFiles(root = process.cwd()) {
    const databaseDir = path.join(root, 'database');
    const database = {};
    if (!fs.existsSync(databaseDir)) return database;

    const walk = (directory, relativeDirectory = '') => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const relativePath = path.posix.join(relativeDirectory, entry.name);
            const fullPath = path.join(directory, entry.name);
            if (isExcludedPath(relativePath) || entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) {
                walk(fullPath, relativePath);
                continue;
            }
            if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
            const text = fs.readFileSync(fullPath, 'utf8');
            try {
                database[relativePath] = JSON.stringify(sanitizeObject(JSON.parse(text)));
            } catch {
                // Preserve malformed/unstructured JSON files as text; restore still verifies the write.
                database[relativePath] = text;
            }
        }
    };
    walk(databaseDir);
    return database;
}

function collectBackupData(root = process.cwd()) {
    const envPath = path.join(root, '.env');
    const env = fs.existsSync(envPath) ? sanitizeEnvironment(fs.readFileSync(envPath, 'utf8')) : '';
    return {
        database: collectDatabaseFiles(root),
        env,
        timestamp: Date.now()
    };
}

function isSafeDatabaseFilename(filename) {
    if (typeof filename !== 'string' || !filename.toLowerCase().endsWith('.json')) return false;
    const segments = filename.split(/[\\/]/);
    return segments.length > 0 && segments.every(segment =>
        segment && segment !== '.' && segment !== '..' && !EXCLUDED_PATH_SEGMENTS.has(normalizedKey(segment))
    );
}

function mergeSafeEnvironment(restoredText, root = process.cwd()) {
    const restored = sanitizeEnvironment(restoredText);
    if (!restored) return false;
    const envPath = path.join(root, '.env');
    const currentLines = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
    const restoredLines = restored.split(/\r?\n/).filter(Boolean);
    const restoredNames = new Set(restoredLines.map(line => /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1]).filter(Boolean));
    const retained = currentLines.filter(line => {
        const name = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line)?.[1];
        return !name || !restoredNames.has(name);
    });
    const merged = [...retained.filter(line => line.trim()), ...restoredLines].join('\n') + '\n';
    fs.writeFileSync(envPath, merged, 'utf8');
    if (fs.readFileSync(envPath, 'utf8') !== merged) throw new Error('Verification failed for safe .env settings');
    return true;
}

function restoreBackupFiles(backupData, root = process.cwd()) {
    if (!backupData || typeof backupData !== 'object' || Array.isArray(backupData)) throw new Error('Backup payload is invalid.');
    const entries = backupData.database && typeof backupData.database === 'object' && !Array.isArray(backupData.database)
        ? Object.entries(backupData.database)
        : [];
    const databaseDir = path.resolve(root, 'database');
    const writes = entries.filter(([filename]) => !isExcludedPath(filename)).map(([filename, content]) => {
        if (!isSafeDatabaseFilename(filename)) throw new Error(`Unsafe database filename: ${filename}`);
        const filePath = path.resolve(databaseDir, filename);
        if (!filePath.startsWith(`${databaseDir}${path.sep}`)) throw new Error(`Unsafe database filename: ${filename}`);
        const original = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        let data = original;
        try { data = JSON.stringify(sanitizeObject(JSON.parse(original))); } catch {}
        return { filePath, data };
    });

    for (const { filePath, data } of writes) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, data, 'utf8');
        if (fs.readFileSync(filePath, 'utf8') !== data) throw new Error(`Verification failed for ${path.relative(databaseDir, filePath)}`);
    }
    const env = typeof backupData.env === 'string' ? mergeSafeEnvironment(backupData.env, root) : false;
    return { dbCount: writes.length, env };
}

async function getBackupHistory(phone) {
    const response = await backupApiPost('/backup/history', { phone });
    return Array.isArray(response.data?.history) ? response.data.history : [];
}

function historyRows(history, prefix, command, phone) {
    if (!history.length) return [];
    return history.slice(0, 10).map((item, index) => [
        `#${index + 1}${index === 0 ? ' (latest)' : ''}`,
        formatBotDateTime(item.timestamp),
        item.sizeFormatted || 'N/A',
        item.backupId
    ]);
}

function commandError(error) {
    const status = error.response?.status;
    if (error instanceof BackupConfigError) return error.message;
    if (status === 401) return 'Backup API authorization failed. Check BACKUP_API_TOKEN in CODY and Cloudflare.';
    if (status === 503) return error.response?.data?.error || 'Backup Worker configuration is incomplete.';
    return error.response?.data?.error || error.message || 'Unexpected backup error.';
}

async function sendTable(sock, chat, header, title, rows, footer) {
    await sock.sendMessage(chat, { headerText: header, contentText: '---', title, table: rows, footerText: footer });
}

const backupCmd = {
    name: 'backup',
    alias: ['savebackup', 'cloudbackup'],
    desc: 'Create an encrypted, versioned backup of settings and database to Cloudflare',
    category: 'Owner',
    ownerOnly: true,
    usage: '.backup <phone> | .backup save | .backup history',
    reactions: { start: '💾', success: '✅', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const userId = m.sender;
        const text = args.join(' ').trim();
        const current = backupSession.get(userId) || { phone: '' };

        if (!text || text.toLowerCase() === 'help') {
            return sendTable(sock, m.chat, '## 💾 Cloud Backup', 'Commands', [
                ['1. Select number', `${prefix}backup 2348077528901`],
                ['2. Save a new version', `${prefix}backup save`],
                ['Show versions', `${prefix}backup history`]
            ], 'Every save creates a new encrypted version; previous versions are kept.');
        }

        if (text.toLowerCase() === 'cancel') {
            backupSession.delete(userId);
            return reply('Backup selection cleared.');
        }

        if (text.toLowerCase() === 'save') {
            if (!current.phone) return reply(`Select a phone first: ${prefix}backup <phone>`);
            try { getBackupConfig(); } catch (error) { return reply(`❌ ${error.message}`); }
            await sock.sendMessage(m.chat, { react: { text: '💾', key: m.key } });
            try {
                const data = collectBackupData();
                const response = await backupApiPost('/backup/save', {
                    phone: current.phone,
                    data
                });
                backupSession.set(userId, current);
                const result = response.data;
                const envIncluded = Boolean(data.env);
                await sendTable(sock, m.chat, '## ✅ Backup Version Saved', 'Cloudflare R2', [
                    ['📱 Phone', current.phone],
                    ['🆔 Version', result.backupId],
                    ['📅 Saved', formatBotDateTime(result.timestamp)],
                    ['📂 Database JSON files', Object.keys(data.database).length],
                    ['⚙️ Safe settings', envIncluded ? 'Included (secrets/session values omitted)' : 'No safe .env settings found'],
                    ['🔐 Encryption', 'AES-256-GCM'],
                    ['🧾 Session data', 'Excluded']
                ], `${prefix}backup save creates another version; it does not overwrite history.`);
                await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
                return;
            } catch (error) {
                console.error('[BACKUP]', error.message);
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`❌ Backup failed: ${commandError(error)}`);
            }
        }

        if (text.toLowerCase() === 'history') {
            if (!current.phone) return reply(`Select a phone first: ${prefix}backup <phone>`);
            try {
                const history = await getBackupHistory(current.phone);
                if (!history.length) return reply(`No saved versions found for ${current.phone}. Use ${prefix}backup save to create the first one.`);
                return sendTable(sock, m.chat, '## 🗂️ Backup History', current.phone,
                    historyRows(history, prefix, 'backup', current.phone),
                    'Each .backup save adds a separate version; nothing is overwritten.');
            } catch (error) {
                return reply(`❌ Could not load backup history: ${commandError(error)}`);
            }
        }

        let phone;
        try { phone = normalizePhone(text); } catch (error) { return reply(`❌ ${error.message}\nUse ${prefix}backup <phone>.`); }
        try {
            const history = await getBackupHistory(phone);
            backupSession.set(userId, { phone });
            if (!history.length) {
                return sendTable(sock, m.chat, '## 📱 Backup Number Selected', phone, [
                    ['Saved versions', 'None yet'],
                    ['Next step', `${prefix}backup save`]
                ], 'The first save creates a new encrypted version.');
            }
            return sendTable(sock, m.chat, '## 🗂️ Existing Backup History', phone,
                historyRows(history, prefix, 'backup', phone),
                `Selection saved. Use ${prefix}backup save to add a new version; existing versions stay unchanged.`);
        } catch (error) {
            return reply(`❌ Could not connect to backup service: ${commandError(error)}`);
        }
    }
};

const restoreCmd = {
    name: 'restore',
    alias: ['loadbackup', 'cloudrestore'],
    desc: 'List encrypted backup versions and restore a selected version',
    category: 'Owner',
    ownerOnly: true,
    usage: '.restore <phone> | .restore load [version] | .restore history',
    reactions: { start: '📥', success: '✅', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const userId = m.sender;
        const text = args.join(' ').trim();
        const current = restoreSession.get(userId) || { phone: '', history: [] };

        if (!text || text.toLowerCase() === 'help') {
            return sendTable(sock, m.chat, '## 📥 Cloud Restore', 'Commands', [
                ['1. List versions', `${prefix}restore 2348077528901`],
                ['2. Restore latest', `${prefix}restore load`],
                ['Restore version #N', `${prefix}restore load 2`],
                ['Refresh history', `${prefix}restore history`]
            ], 'Restoring replaces matching database files and safe settings on this deployment.');
        }

        if (text.toLowerCase() === 'cancel') {
            restoreSession.delete(userId);
            return reply('Restore selection cleared.');
        }

        if (text.toLowerCase() === 'history') {
            if (!current.phone) return reply(`Choose a phone first: ${prefix}restore <phone>`);
            try {
                current.history = await getBackupHistory(current.phone);
                restoreSession.set(userId, current);
                if (!current.history.length) return reply(`No backup versions found for ${current.phone}.`);
                return sendTable(sock, m.chat, '## 🗂️ Restore History', current.phone,
                    historyRows(current.history, prefix, 'restore', current.phone),
                    `Use ${prefix}restore load for latest, or ${prefix}restore load <number> for a listed version.`);
            } catch (error) {
                return reply(`❌ Could not load backup history: ${commandError(error)}`);
            }
        }

        if (/^load(?:\s|$)/i.test(text)) {
            const selector = text.replace(/^load\s*/i, '').trim();
            if (!current.phone) return reply(`Choose a phone first: ${prefix}restore <phone>`);
            let history = current.history;
            try {
                if (!history.length) history = await getBackupHistory(current.phone);
                if (!history.length) return reply(`No backup versions found for ${current.phone}.`);
                let selected;
                if (!selector) selected = history[0];
                else if (/^\d+$/.test(selector)) selected = history[Number(selector) - 1];
                else selected = history.find(item => item.backupId === selector);
                if (!selected) return reply(`Version not found. Use ${prefix}restore ${current.phone} to list available versions.`);

                await sock.sendMessage(m.chat, { react: { text: '📥', key: m.key } });
                const response = await backupApiPost('/restore/load', {
                    phone: current.phone,
                    backupId: selected.backupId
                });
                if (!response.data?.data || typeof response.data.data !== 'object') throw new Error('No backup data received.');
                const result = restoreBackupFiles(response.data.data);
                await sendTable(sock, m.chat, '## ✅ Restore Complete', 'Selected version', [
                    ['📱 Phone', current.phone],
                    ['🆔 Version', response.data.backupId || selected.backupId],
                    ['📅 Saved', formatBotDateTime(response.data.timestamp || selected.timestamp)],
                    ['📂 Database JSON files', result.dbCount],
                    ['⚙️ Safe settings', result.env ? 'Merged; secrets/session values kept local' : 'No safe settings in this version'],
                    ['🔐 Session data', 'Not included or restored'],
                    ['🔄 Action', 'Restarting bot shortly']
                ], 'Matching database JSON files are replaced. Files absent from the backup are left as they are.');
                await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
                restoreSession.delete(userId);
                setTimeout(() => process.exit(0), 3000);
                return;
            } catch (error) {
                console.error('[RESTORE]', error.message);
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`❌ Restore failed: ${commandError(error)}`);
            }
        }

        let phone;
        try { phone = normalizePhone(text); } catch (error) { return reply(`❌ ${error.message}\nUse ${prefix}restore <phone>.`); }
        try {
            const history = await getBackupHistory(phone);
            restoreSession.set(userId, { phone, history });
            if (!history.length) return reply(`No backup versions found for ${phone}.`);
            return sendTable(sock, m.chat, '## 🗂️ Available Restore Versions', phone,
                historyRows(history, prefix, 'restore', phone),
                `Use ${prefix}restore load for latest, or ${prefix}restore load <number> for an older version.`);
        } catch (error) {
            return reply(`❌ Could not connect to backup service: ${commandError(error)}`);
        }
    }
};

module.exports = [backupCmd, restoreCmd];
module.exports.helpers = {
    collectBackupData,
    collectDatabaseFiles,
    sanitizeEnvironment,
    sanitizeObject,
    isSafeDatabaseFilename,
    restoreBackupFiles,
    getBackupConfig,
    getBackupApiConfig
};
