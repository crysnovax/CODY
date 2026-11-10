/**
 * CODY status automation. Baileys owns status detection, author resolution,
 * receipt/reaction serialization, comment construction, and media download.
 */
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { getVar } = require('./configManager');

const seen = new Set();
const ASS_CONFIG_PATH = path.join(process.cwd(), 'database', 'autosavestatus.json');
const ACS_CONFIG_PATH = path.join(process.cwd(), 'database', 'autocommentstatus.json');
const ACS_STICKER_PATH = path.join(process.cwd(), 'database', 'autocommentstatus-sticker.webp');
const defaultAssConfig = { enabled: false, mode: 'dm', target: null };
const defaultAcsConfig = { enabled: false, mode: 'text', text: '' };
const MEDIA_FIELDS = new Set(['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage']);
const WRAPPER_FIELDS = new Set([
    'deviceSentMessage', 'documentWithCaptionMessage', 'editedMessage', 'ephemeralMessage',
    'groupMentionedMessage', 'groupStatusMessage', 'groupStatusMessageV2', 'message',
    'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'
]);

function jidKind(jid) {
    if (typeof jid !== 'string' || !jid) return 'missing';
    if (jid === 'status@broadcast') return 'status-broadcast';
    const server = jid.split('@')[1]?.split(':')[0];
    if (server === 's.whatsapp.net') return 'pn';
    if (server === 'lid') return 'lid';
    if (server === 'g.us') return 'group';
    return server ? 'other' : 'unknown';
}

function payloadKinds(message) {
    const root = message?.message || message?.fakeObj?.message || {};
    return Object.keys(root).slice(0, 8).join(',') || 'none';
}

function isStatusInteraction(message) {
    const queue = [message?.message, message?.fakeObj?.message, message?.message?.message]
        .filter(value => value && typeof value === 'object');
    const visited = new WeakSet();
    let inspected = 0;
    while (queue.length && inspected < 160) {
        const current = queue.shift();
        if (!current || typeof current !== 'object' || visited.has(current)) continue;
        visited.add(current);
        inspected += 1;
        if (Object.hasOwn(current, 'reactionMessage') || Object.hasOwn(current, 'protocolMessage')) return true;
        for (const [field, value] of Object.entries(current)) {
            if (WRAPPER_FIELDS.has(field) && value && typeof value === 'object') queue.push(value);
        }
    }
    return false;
}

function hasResolvedStatusAuthor(event) {
    const key = event?.message?.key || event?.message?.fakeObj?.key || {};
    return [event?.authorJid, key.participant, key.participantAlt, key.remoteJidAlt, event?.message?.sender, event?.message?.from]
        .some(jid => ['pn', 'lid'].includes(jidKind(jid)));
}

function hasGroupStatus(message) {
    const queue = [message?.message, message?.fakeObj?.message].filter(value => value && typeof value === 'object');
    const visited = new WeakSet();
    let inspected = 0;
    while (queue.length && inspected < 100) {
        const current = queue.shift();
        if (!current || typeof current !== 'object' || visited.has(current)) continue;
        visited.add(current);
        inspected += 1;
        for (const [field, value] of Object.entries(current)) {
            if (field === 'groupStatusMessage' || field === 'groupStatusMessageV2') return true;
            if (WRAPPER_FIELDS.has(field) && value && typeof value === 'object') {
                queue.push(value.message || value);
            }
        }
    }
    return false;
}

function readConfig(filePath, defaults) {
    try {
        if (fs.existsSync(filePath)) {
            return { ...defaults, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
        }
    } catch (error) {
        console.error(`[STATUS CONFIG] ${error.message}`);
    }
    return { ...defaults };
}

function getAssConfig() {
    return readConfig(ASS_CONFIG_PATH, defaultAssConfig);
}

function getAcsConfig() {
    return readConfig(ACS_CONFIG_PATH, defaultAcsConfig);
}

function getOwnerJid() {
    const number = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
    return number ? `${number}@s.whatsapp.net` : null;
}

function findStatusMedia(message) {
    const queue = [message?.message, message?.fakeObj?.message].filter(value => value && typeof value === 'object');
    const visited = new WeakSet();
    let inspected = 0;
    while (queue.length && inspected < 160) {
        const current = queue.shift();
        if (!current || typeof current !== 'object' || visited.has(current)) continue;
        visited.add(current);
        inspected += 1;
        for (const [field, payload] of Object.entries(current)) {
            if (MEDIA_FIELDS.has(field) && payload && typeof payload === 'object') {
                return { field, payload };
            }
            if (WRAPPER_FIELDS.has(field) && payload && typeof payload === 'object') {
                const nested = payload.message || payload;
                if (nested && typeof nested === 'object') queue.push(nested);
            }
        }
    }
    return undefined;
}

function mediaToSendContent(field, media, buffer) {
    const caption = media?.caption || '';
    if (field === 'imageMessage') return { image: buffer, ...(caption ? { caption } : {}) };
    if (field === 'videoMessage') return { video: buffer, ...(caption ? { caption } : {}), mimetype: media?.mimetype || 'video/mp4' };
    if (field === 'audioMessage') return { audio: buffer, mimetype: media?.mimetype || 'audio/mpeg', ptt: false };
    if (field === 'stickerMessage') return { sticker: buffer };
    if (field === 'documentMessage') {
        return {
            document: buffer,
            mimetype: media?.mimetype || 'application/octet-stream',
            fileName: media?.fileName || 'status_file',
            ...(caption ? { caption } : {})
        };
    }
    return undefined;
}

async function autoSaveStatus(sock, event) {
    const config = getAssConfig();
    if (!config.enabled) return false;
    const targetJid = config.mode === 'dm' ? getOwnerJid() : config.target;
    if (!targetJid) return false;
    const media = findStatusMedia(event.message);
    if (!media) return false;

    const buffer = await sock.downloadStatus(event.message, 'buffer');
    if (!buffer?.length) return false;
    const content = mediaToSendContent(media.field, media.payload, buffer);
    if (!content) return false;
    await sock.sendMessage(targetJid, content);
    return true;
}

async function markStatusViewed(sock, event) {
    if (event.kind === 'group') return sock.viewGroupStatus(event.message);
    return sock.viewStatus(event.message);
}

async function sendStatusReaction(sock, event) {
    const emoji = getVar('STATUS_EMOJI', '💚');
    if (event.kind === 'group') return sock.likeGroupStatus(event.message, emoji);
    return sock.likeStatus(event.message, emoji);
}

async function autoCommentStatus(sock, event) {
    if (event.kind !== 'status') return false;
    if (!hasResolvedStatusAuthor(event)) return false;
    const config = getAcsConfig();
    if (!config.enabled) return false;
    let comment;
    if (config.mode === 'sticker') {
        if (!fs.existsSync(ACS_STICKER_PATH)) return false;
        comment = { sticker: fs.readFileSync(ACS_STICKER_PATH), mimetype: 'image/webp' };
    } else {
        comment = String(config.text || '').trim();
        if (!comment) return false;
    }
    await sock.commentStatus(event.message, comment);
    return true;
}

function eventLogContext(event) {
    const key = event?.message?.key || event?.message?.fakeObj?.key || {};
    return `kind=${event?.kind || 'unknown'} type=${event?.type || 'unknown'} ` +
        `fromMe=${Boolean(key.fromMe)} author=${jidKind(event?.authorJid || key.participant || key.participantAlt)} ` +
        `payload=${payloadKinds(event?.message)}`;
}

async function runAction(label, action, event) {
    const context = eventLogContext(event);
    console.log(chalk.cyan(`[STATUS] ${label} start ${context}`));
    try {
        const result = await action();
        console.log(chalk.green(`[STATUS] ${label} ${result === false ? 'skipped' : 'ok'} ${context}`));
        return result;
    } catch (error) {
        const code = error?.output?.statusCode || error?.statusCode || error?.code || 'unknown';
        console.error(chalk.red(`[STATUS] ${label} failed code=${code} error=${error?.message || error} ${context}`));
        return false;
    }
}

const setupStatusHandler = (sock) => {
    console.log('[STATUS] Baileys status handler attached; waiting for status updates');

    if (typeof sock.ws?.on === 'function') {
        sock.ws.on('CB:message', node => {
            if (node?.attrs?.from === 'status@broadcast') {
                console.log('[STATUS] WhatsApp delivered a raw status stanza');
            }
        });
    }

    // This observer is diagnostic only. The Baileys subscription below owns
    // status classification and actions. No message text, IDs, or full JIDs log.
    const upsertObserver = ({ messages = [], type } = {}) => {
        for (const message of messages) {
            const key = message?.key || message?.fakeObj?.key || {};
            const personal = key.remoteJid === 'status@broadcast' || key.remoteJidAlt === 'status@broadcast';
            const group = hasGroupStatus(message);
            if (!personal && !group) continue;
            console.log(`[STATUS] decoded candidate kind=${group ? 'group' : 'personal'} type=${type || 'unknown'} ` +
                `fromMe=${Boolean(key.fromMe)} remote=${jidKind(key.remoteJid)} remoteAlt=${jidKind(key.remoteJidAlt)} ` +
                `participant=${jidKind(key.participant)} participantAlt=${jidKind(key.participantAlt)} payload=${payloadKinds(message)}`);
        }
    };
    if (typeof sock.ev?.on === 'function') {
        sock.ev.on('messages.upsert', upsertObserver);
        console.log('[STATUS] Decoded message observer attached');
    } else {
        console.warn('[STATUS] Socket has no event emitter; decoded status diagnostics unavailable');
    }

    const cleanup = () => sock.ev?.off?.('messages.upsert', upsertObserver);
    if (typeof sock.onStatusMessage !== 'function') {
        console.error('[STATUS] This Plogme version lacks onStatusMessage(); install plogme@2.2.7 or newer');
        return cleanup;
    }

    const unsubscribe = sock.onStatusMessage(async event => {
        const message = event?.message;
        const key = message?.key || message?.fakeObj?.key || {};
        console.log(`[STATUS] Baileys callback ${eventLogContext(event)} idPresent=${Boolean(key.id)}`);
        if (isStatusInteraction(message)) {
            console.log(`[STATUS] ignored status interaction ${eventLogContext(event)}`);
            return;
        }
        if (!key.id || !['status', 'group'].includes(event.kind)) {
            console.warn(`[STATUS] Ignored malformed/unsupported event ${eventLogContext(event)}`);
            return;
        }

        const author = event.authorJid || key.participant || key.participantAlt || key.remoteJidAlt || 'unknown';
        const seenKey = `${event.kind}:${author}:${key.id}`;
        if (seen.has(seenKey)) {
            console.log(`[STATUS] duplicate ignored ${eventLogContext(event)}`);
            return;
        }
        seen.add(seenKey);
        if (seen.size > 5000) seen.clear();
        const authorResolved = hasResolvedStatusAuthor(event);

        if (getVar('AUTO_STATUS_VIEW', true)) {
            if (authorResolved) await runAction('VIEW', () => markStatusViewed(sock, event), event);
            else console.warn(`[STATUS] VIEW skipped: status author unresolved ${eventLogContext(event)}`);
        } else {
            console.log(`[STATUS] VIEW disabled ${eventLogContext(event)}`);
        }
        if (getVar('AUTO_STATUS_LIKE', true)) {
            if (authorResolved) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await runAction('LIKE', () => sendStatusReaction(sock, event), event);
            } else console.warn(`[STATUS] LIKE skipped: status author unresolved ${eventLogContext(event)}`);
        } else {
            console.log(`[STATUS] LIKE disabled ${eventLogContext(event)}`);
        }
        await runAction('SAVE', () => autoSaveStatus(sock, event), event);
        await runAction('COMMENT', () => autoCommentStatus(sock, event), event);
    }, { from: 'all', includeGroupStatus: true });

    console.log('[STATUS] Subscribed through Baileys onStatusMessage()');
    return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
        cleanup();
    };
};

setInterval(() => seen.clear(), 30 * 60 * 1000).unref?.();

module.exports = {
    setupStatusHandler,
    getAssConfig,
    getAcsConfig,
    findStatusMedia,
    autoSaveStatus,
    autoCommentStatus,
    markStatusViewed,
    sendStatusReaction
};
