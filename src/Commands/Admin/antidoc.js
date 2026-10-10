'use strict';
const path = require('path');
const {
    createAntiMessageModeration,
    readJson,
    writeJson,
} = require('../../Plugin/antiMessageModeration');

function findDocuments(value, output = [], seen = new WeakSet()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return output;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
        if (key === 'documentMessage' && child && typeof child === 'object') output.push(child);
        findDocuments(child, output, seen);
    }
    return output;
}

function documentExtension(document) {
    const fileName = String(document?.fileName || document?.filename || '').trim();
    const filenameExtension = path.extname(fileName).slice(1).toLowerCase();
    if (filenameExtension) return filenameExtension;
    const mime = String(document?.mimetype || '').toLowerCase().split(';')[0];
    const knownMime = {
        'application/pdf': 'pdf',
        'application/zip': 'zip',
        'application/x-7z-compressed': '7z',
        'application/x-rar-compressed': 'rar',
        'application/vnd.android.package-archive': 'apk',
        'application/x-msdownload': 'exe',
        'application/vnd.microsoft.portable-executable': 'exe',
        'application/msword': 'doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'text/plain': 'txt',
    };
    return knownMime[mime] || '';
}

function shouldBlockDocument(payload, config = {}) {
    const docs = findDocuments(payload);
    if (!docs.length) return false;
    const allowed = new Set((config.allowedExtensions || []).map(value => String(value).toLowerCase()));
    const denied = new Set((config.deniedExtensions || []).map(value => String(value).toLowerCase()));
    // Explicit deny always wins; otherwise strict mode allows only listed extensions.
    return docs.some(document => {
        const extension = documentExtension(document);
        return denied.has(extension) || !extension || !allowed.has(extension);
    });
}

const plugin = createAntiMessageModeration({
    command: 'antidoc',
    aliases: ['nodoc', 'antidocument'],
    label: 'Anti Document',
    description: 'Restrict document messages by extension',
    databaseName: 'antidoc.json',
    warningDatabaseName: 'antidoc_warns.json',
    detector: (payload, { config }) => shouldBlockDocument(payload, config),
    violationLabel: 'documents'
});
const dbPath = path.join(process.cwd(), 'database', 'antidoc.json');
plugin.execute = async (sock, m, { args = [], reply }) => {
    const db = readJson(dbPath);
    const config = db[m.chat] || (db[m.chat] = {
        enabled: false,
        action: 'delete',
        allowedExtensions: [],
        deniedExtensions: [],
    });
    if (!Array.isArray(config.allowedExtensions)) config.allowedExtensions = [];
    if (!Array.isArray(config.deniedExtensions)) config.deniedExtensions = [];
    if (!['delete', 'warn', 'kick', 'tkick'].includes(config.action)) config.action = 'delete';
    const sub = String(args[0] || 'status').toLowerCase();
    const ext = String(args[1] || '').toLowerCase().replace(/^\./, '');
    if (sub === 'status') {
        return reply(`*Anti Document Settings*\n\n• Status: ${config.enabled ? 'ON' : 'OFF'}\n• Action: ${config.action.toUpperCase()}${config.action === 'warn' ? ' (3 warnings → kick)' : ''}\n• Allowed extensions: ${config.allowedExtensions.join(', ') || 'none (strict: all documents blocked)'}\n• Denied extensions: ${config.deniedExtensions.join(', ') || 'none'}\n\nCommands:\n• .antidoc on / off\n• .antidoc allow <extension>\n• .antidoc deny <extension>\n• .antidoc remove <extension>\n• .antidoc action <delete|warn|kick|tkick> [5m]`);
    }
    if (sub === 'on' || sub === 'off') {
        config.enabled = sub === 'on';
        writeJson(dbPath, db);
        return reply(`*Anti Document* ${config.enabled ? 'enabled' : 'disabled'}.`);
    }
    if (['allow', 'deny', 'remove'].includes(sub)) {
        if (!/^[a-z0-9][a-z0-9+_-]{0,15}$/i.test(ext)) return reply(`Usage: .antidoc ${sub} <extension>\nExample: .antidoc ${sub} pdf`);
        if (sub === 'allow') {
            config.allowedExtensions = [...new Set([...config.allowedExtensions, ext])];
            config.deniedExtensions = config.deniedExtensions.filter(value => value !== ext);
        } else if (sub === 'deny') {
            config.deniedExtensions = [...new Set([...config.deniedExtensions, ext])];
            config.allowedExtensions = config.allowedExtensions.filter(value => value !== ext);
        } else {
            config.allowedExtensions = config.allowedExtensions.filter(value => value !== ext);
            config.deniedExtensions = config.deniedExtensions.filter(value => value !== ext);
        }
        writeJson(dbPath, db);
        return reply(sub === 'remove' ? `Removed ${ext} from the document rules.` : `${ext} added to the ${sub} list.`);
    }
    const requestedAction = sub === 'action' ? String(args[1] || '').toLowerCase() : sub;
    if (['delete', 'warn', 'kick', 'tkick'].includes(requestedAction)) {
        config.action = requestedAction;
        const duration = sub === 'action' ? args[2] : args[1];
        if (requestedAction === 'tkick' && duration) config.tkickDuration = String(duration);
        writeJson(dbPath, db);
        return reply(`*Anti Document action:* ${requestedAction.toUpperCase()}.`);
    }
    return reply('Usage: .antidoc status | on | off | allow <ext> | deny <ext> | remove <ext> | delete | warn | kick | tkick [5m]');
};
plugin.shouldBlockDocument = shouldBlockDocument;
plugin.findDocuments = findDocuments;
plugin.documentExtension = documentExtension;
plugin.handleAntiDoc = plugin.handleModeration;
module.exports = plugin;
