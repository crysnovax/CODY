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

function readConfig(filePath, defaults) {
    try {
        if (fs.existsSync(filePath)) {
            return { ...defaults, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
        }
    } catch (error) {
        console.error('[STATUS CONFIG]', error.message);
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
    const seenObjects = new WeakSet();
    let inspected = 0;
    while (queue.length && inspected < 160) {
        const current = queue.shift();
        if (!current || typeof current !== 'object' || seenObjects.has(current)) continue;
        seenObjects.add(current);
        inspected += 1;
        for (const [field, payload] of Object.entries(current)) {
            if (MEDIA_FIELDS.has(field) && payload && typeof payload === 'object') {
                return { field, payload };
            }
            if (WRAPPER_FIELDS.has(field) && payload && typeof payload === 'object') {
                const nested = field === 'groupStatusMessage' || field === 'groupStatusMessageV2'
                    ? payload.message || payload
                    : payload.message || payload;
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
    const author = (event.authorJid || 'unknown').split('@')[0];
    console.log(chalk.cyan(`[ASS] Saved ${media.field} status from ${author} → ${targetJid.split('@')[0]}`));
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
    console.log(chalk.cyan(`[ACS] Commented on status from ${(event.authorJid || 'unknown').split('@')[0]}`));
    return true;
}

async function runAction(label, action, event) {
    try {
        await action();
    } catch (error) {
        console.log(chalk.red(`[STATUS ${label} FAILED] ${error?.message || error}`));
    }
}

const setupStatusHandler = (sock) => {
    console.log('[STATUS] Baileys status handler attached; waiting for status updates');

    // Diagnostic only: the actual decoded status subscription is installed by
    // sock.onStatusMessage() below, not by this transport observer.
    if (typeof sock.ws?.on === 'function') {
        sock.ws.on('CB:message', node => {
            if (node?.attrs?.from === 'status@broadcast') {
                console.log('[STATUS TRACE] Raw status stanza received from WhatsApp');
            }
        });
    }

    if (typeof sock.onStatusMessage !== 'function') {
        console.error('[STATUS] This Plogme version lacks onStatusMessage(); install plogme@2.2.6 or newer');
        return () => {};
    }

    const unsubscribe = sock.onStatusMessage(async event => {
        const message = event?.message;
        if (!message?.key?.id || !['status', 'group'].includes(event.kind)) return;
        const author = event.authorJid || message.key.participant || message.key.participantAlt || message.key.remoteJidAlt || 'unknown';
        const seenKey = `${event.kind}:${author}:${message.key.id}`;
        if (seen.has(seenKey)) return;
        seen.add(seenKey);
        if (seen.size > 5000) seen.clear();

        if (getVar('AUTO_STATUS_VIEW', true)) {
            await runAction('VIEW', () => markStatusViewed(sock, event), event);
        }
        if (getVar('AUTO_STATUS_LIKE', true)) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await runAction('LIKE', () => sendStatusReaction(sock, event), event);
        }
        await runAction('SAVE', () => autoSaveStatus(sock, event), event);
        await runAction('COMMENT', () => autoCommentStatus(sock, event), event);
    }, { from: 'all', includeGroupStatus: true });

    console.log('[STATUS] Subscribed through Baileys onStatusMessage()');
    return typeof unsubscribe === 'function' ? unsubscribe : () => {};
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
