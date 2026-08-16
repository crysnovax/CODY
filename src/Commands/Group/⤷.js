const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { prepareWAMessageMedia, generateWAMessageContent, generateMessageIDV2, buildLinkPreview } = require('@crysnovax/baileys');

// ── Admin-gated groups ────────────────────────────────────────
// gstatus in these groups is ADMINS-ONLY. A non-admin is rejected outright,
// and `gstatus <text> | all` always skips these groups when the sender is
// not an admin of the target group — even when broadcast from elsewhere.
// (@crysnovax—FIX15-08-26)
const RESTRICTED_GROUPS = new Set([
    '120363426760068896@g.us',
    '120363396903069780@g.us',
    '120363411385283733@g.us',
    '120363410281907240@g.us',
]);

const normalizeJid = (jid = '') => String(jid || '').replace(/:\d+@/, '@');
const STATUS_COLORS = ['#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#845EC2', '#00C9A7'];
const NAMED_STATUS_COLORS = { red: '#FF6B6B', blue: '#4D96FF', green: '#6BCB77', yellow: '#FFD93D', purple: '#845EC2', violet: '#845EC2', teal: '#00C9A7', cyan: '#00C9A7', orange: '#FF9671', pink: '#FF6F91', white: '#FFFFFF', black: '#000000' };
let statusColorIndex = 0;
const nextStatusColor = () => STATUS_COLORS[statusColorIndex++ % STATUS_COLORS.length];
const normalizeBackgroundColor = value => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return undefined;
    if (NAMED_STATUS_COLORS[raw]) return NAMED_STATUS_COLORS[raw];
    if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase();
    if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toUpperCase()}`;
    return undefined;
};
const parseStatusOptions = (text = '', args = []) => {
    let source = Array.isArray(args) && args.length ? args.join(' ') : String(text);
    let caption;
    const bgMatch = source.match(/(?:^|\s)--bg=([^\s]+)/i);
    const backgroundColor = normalizeBackgroundColor(bgMatch?.[1]);
    source = source.replace(/(?:^|\s)--bg=[^\s]+/gi, ' ').trim();
    const cpMatch = source.match(/(?:^|\s)--cp=(.+)$/i);
    if (cpMatch) { caption = cpMatch[1].trim().replace(/^['\"]|['\"]$/g, ''); source = source.slice(0, cpMatch.index).trim(); }
    const copyCaption = /(?:^|\s)(?:-cp|--copy-caption)(?=\s|$)/i.test(source);
    source = source.replace(/(?:^|\s)(?:-cp|--copy-caption)(?=\s|$)/gi, ' ').trim();
    const cleanTokens = source.split(/\s+/).filter(Boolean).filter(token => !/^id.+@g\.us$/i.test(token));
    return { backgroundColor, copyCaption, caption, cleanText: cleanTokens.join(' ').trim() };
};
const resolveStatusTarget = (command = 'gstatus', args = [], currentChat = '') => {
    const tokens = Array.isArray(args) ? args : String(args || '').split(/\s+/);
    if (String(command).toLowerCase() === 'gstatusall') return 'all';
    const idToken = tokens.find(token => /^id.+@g\.us$/i.test(String(token)));
    return idToken ? String(idToken).slice(2) : currentChat;
};

// True when the sender is a group admin of the given group (checked by JID
// or phone, matching crysMsg.js's own admin detection).
async function isSenderAdminOfGroup(sock, groupJid, senderJid) {
    try {
        const meta = await sock.groupMetadata(groupJid).catch(() => null);
        const adminJids = (meta?.participants || [])
            .filter(p => p.admin)
            .map(p => normalizeJid(p.id));
        const sender = normalizeJid(senderJid);
        const senderPhone = sender.split('@')[0];
        return adminJids.includes(sender)
            || adminJids.some(j => j.split('@')[0] === senderPhone);
    } catch {
        return false;
    }
}

// ── Status ID Store ───────────────────────────────────────────
const DB_PATH = path.join(__dirname, '../../../database/gstatus-ids.json');

function loadIds() {
    try {
        if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {}
    return {};
}

function saveId(jid, msgId) {
    try {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
        const db = loadIds();
        if (!db[jid]) db[jid] = [];
        db[jid].push(msgId);
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error('[GSTATUS DB ERROR]', err.message);
    }
}

function clearIds(jid) {
    try {
        const db = loadIds();
        const ids = db[jid] || [];
        delete db[jid];
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
        return ids;
    } catch {}
    return [];
}

// ── Helper: send + track ──────────────────────────────────────
async function relayAndTrack(sock, jid, message) {
    const msgId = generateMessageIDV2(sock.user.id);
    await sock.relayMessage(jid, message, { messageId: msgId });
    saveId(jid, msgId);
    return msgId;
}

async function sendGroupStatusCompat(sock, jid, content, backgroundColor) {
    const selectedColor = backgroundColor || nextStatusColor();
    if (typeof sock.sendGroupStatus === 'function') {
        return sock.sendGroupStatus(jid, content, { backgroundColor: selectedColor });
    }
    if (typeof generateWAMessageContent !== 'function' || typeof sock.relayMessage !== 'function') {
        throw new Error('This Baileys runtime cannot publish a compatible group status');
    }
    const message = await generateWAMessageContent({ ...content, groupStatus: true }, {
        upload: sock.waUploadToServer,
        logger: sock.logger,
        backgroundColor: selectedColor,
        options: sock.config?.options
    });
    const messageId = generateMessageIDV2(sock.user.id);
    await sock.relayMessage(jid, message, { messageId });
    return { key: { remoteJid: jid, fromMe: true, id: messageId }, message };
}

// ── URL Detection ─────────────────────────────────────────────
function extractFirstUrl(text) {
    if (!text) return null;
    const match = text.match(/(https?:\/\/[^\s]+)/i);
    return match ? match[0] : null;
}

// ── Build preview object ──────────────────────────────────────
async function buildPreview(url, sock, customTitle, customDesc) {
    const result = await buildLinkPreview(url, sock, { customTitle, customDesc });
    if (!result.imageBuffer) return { url, title: result.title, description: result.description };

    let hq = null;
    let smallThumb = null;
    try {
        const prepared = await prepareWAMessageMedia(
            { image: result.imageBuffer },
            { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
        );
        hq = prepared.imageMessage;
        smallThumb = hq?.jpegThumbnail ? Buffer.from(hq.jpegThumbnail) : null;
    } catch (err) {
        console.error('[HQ THUMB ERROR]', err.message);
    }

    return { url, title: result.title, description: result.description, smallThumb, hq };
}

// ── Build groupStatusMessageV2 with an audio payload ───────────
// WhatsApp's group-status protocol needs the audio uploaded through
// prepareWAMessageMedia and wrapped in the same groupStatusMessageV2
// container used for text, then RELAYED — sendMessage(..., {groupStatus:true})
// produces an "unsupported message" for audio. (@crysnovax—FIX14-08-26)
async function buildGroupStatusAudioMessage(audioBuffer, mimetype, ptt, sock) {
    const prepared = await prepareWAMessageMedia(
        { audio: audioBuffer, mimetype: mimetype || 'audio/ogg; codecs=opus', ptt: !!ptt },
        { upload: sock.waUploadToServer }
    );
    // The client only renders group-status AUDIO correctly when the inner
    // audio message carries contextInfo.isGroupStatus — the exact flag
    // Baileys' own generateWAMessageContent sets for groupStatus messages.
    // Without it, groups show the audio as an "unsupported message".
    // (@crysnovax—FIX15-08-26)
    if (prepared.audioMessage) {
        prepared.audioMessage.contextInfo = { isGroupStatus: true };
    }
    return { groupStatusMessageV2: { message: { audioMessage: prepared.audioMessage } } };
}

// ── Build groupStatusMessageV2 with link preview ──────────────
function buildGroupStatusTextMessage(text, preview) {
    const extMsg = { text };
    if (preview) {
        extMsg.matchedText = preview.url;
        extMsg.canonicalUrl = preview.url;
        extMsg.title = preview.title || '';
        extMsg.description = preview.description || '';
        extMsg.previewType = 5;
        if (preview.smallThumb) extMsg.jpegThumbnail = preview.smallThumb;
        if (preview.hq) {
            extMsg.thumbnailDirectPath = preview.hq.directPath;
            extMsg.mediaKey = preview.hq.mediaKey;
            extMsg.mediaKeyTimestamp = preview.hq.mediaKeyTimestamp;
            extMsg.thumbnailWidth = preview.hq.width;
            extMsg.thumbnailHeight = preview.hq.height;
            extMsg.thumbnailSha256 = preview.hq.fileSha256;
            extMsg.thumbnailEncSha256 = preview.hq.fileEncSha256;
        }
    }
    return { groupStatusMessageV2: { message: { extendedTextMessage: extMsg } } };
}

module.exports = {
    name: 'gstatus',
    alias: ['groupstatus', 'gs', 'gstatusall'],
    desc: 'Post a status to the group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,

    execute: async (sock, m, { text, args, reply, command }) => {
        try {
            const quoted = m.quoted || {};
            const chat = m.chat;
            const statusOptions = parseStatusOptions(text, args);
            text = statusOptions.cleanText;
            const routeTarget = resolveStatusTarget(command || 'gstatus', args, chat);

            await sock.sendMessage(chat, {
                react: { text: '📸', key: m.key }
            });

            // ── GS CLEAR — delete all tracked statuses ────
            if (text && text.trim().toLowerCase() === 'clear') {
                const ids = clearIds(chat);
                if (!ids.length) return reply('`—͟͟͞͞𖣘 No tracked statuses to delete`');

                let deleted = 0, failed = 0;
                for (const msgId of ids) {
                    try {
                        await sock.deleteGroupStatus(chat, {
                            remoteJid: chat,
                            fromMe: true,
                            id: msgId
                        });
                        deleted++;
                    } catch { failed++; }
                    await new Promise(r => setTimeout(r, 300));
                }
                return reply(`\`—͟͟͞͞𖣘 Cleared ${deleted} status(es)${failed ? `, ${failed} failed` : ''}\``);
            }

            // ─────────────────────────────
            // FEATURE: BROADCAST TO ALL GROUPS
            // !gstatus text | all, !gstatusall text, or !gstatusall -cp
            // ─────────────────────────────
            if (routeTarget === 'all' || (text && text.includes('|'))) {
                const [left, right] = text.includes('|') ? text.split('|').map(v => v.trim()) : [text, 'all'];

                if (right && right.toLowerCase() === 'all') {
                    const messageText = left || statusOptions.caption || (statusOptions.copyCaption ? (quoted.caption || quoted.text || '') : '') || quoted.text || quoted.caption || '';

                    if (!messageText && !(quoted.mtype && typeof quoted.download === 'function')) {
                        return reply('`✘ Please provide a message or reply to media to broadcast`');
                    }

                    const groups = await sock.groupFetchAllParticipating();
                    const groupIds = Object.keys(groups);
                    let broadcastMedia = null;
                    const quotedType = quoted.mtype;
                    if (quotedType && ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(quotedType) && typeof quoted.download === 'function') {
                        const media = await quoted.download();
                        const caption = messageText || statusOptions.caption || (statusOptions.copyCaption ? (quoted.caption || quoted.text || '') : '') || quoted.caption || quoted.text || '';
                        if (quotedType === 'imageMessage' || quotedType === 'stickerMessage') broadcastMedia = { image: media, caption };
                        if (quotedType === 'videoMessage') broadcastMedia = { video: media, caption };
                        if (quotedType === 'audioMessage') broadcastMedia = { audio: media, mimetype: quoted.mimetype || 'audio/ogg; codecs=opus', ptt: !!quoted.ptt };
                        if (quotedType === 'documentMessage') broadcastMedia = { document: media, mimetype: quoted.mimetype, fileName: quoted.fileName || 'document', caption };
                    }

                    if (!groupIds.length) {
                        return reply('`✘ Bot is not in any groups`');
                    }

                    await reply(`\`—͟͟͞͞𖣘 Broadcasting to ${groupIds.length} groups...\``);

                    let success = 0;
                    let failed = 0;
                    let skipped = 0;
                    const url = extractFirstUrl(messageText);
                    let message;

                    if (url) {
                        const preview = await buildPreview(url, sock, '', '');
                        message = buildGroupStatusTextMessage(messageText, preview);
                    } else {
                        message = { groupStatusMessageV2: { message: { extendedTextMessage: { text: messageText } } } };
                    }

                    for (const groupId of groupIds) {
                        // Admin-gated groups are SKIPPED by force for non-admins
                        // — the broadcast must never post there on their behalf.
                        // (@crysnovax—FIX15-08-26)
                        if (RESTRICTED_GROUPS.has(groupId) && !(await isSenderAdminOfGroup(sock, groupId, m.sender))) {
                            skipped++;
                            continue;
                        }
                        try {
                            if (broadcastMedia) {
                                const sent = await sendGroupStatusCompat(sock, groupId, broadcastMedia, statusOptions.backgroundColor);
                                saveId(groupId, sent?.key?.id);
                            } else {
                                await relayAndTrack(sock, groupId, message);
                            }
                            success++;
                        } catch (err) {
                            failed++;
                        }
                        await new Promise(res => setTimeout(res, 500));
                    }

                    return reply(
                        `\`—͟͟͞͞𖣘 Broadcast Done\`\n` +
                        `Success: ${success}\nFailed: ${failed}` +
                        (skipped ? `\nSkipped: ${skipped}` : '')
                    );
                }
            }

            // ─────────────────────────────
            // PARSE: text | jid
            // ─────────────────────────────
            let messageText = '';
            let targetJid = routeTarget && routeTarget !== 'all' ? routeTarget : chat;

            if (text && text.includes('|')) {
                const [left, right] = text.split('|').map(v => v.trim());

                if (!left && right) {
                    targetJid = right;
                } else {
                    messageText = left || statusOptions.caption || '';
                    if (right) targetJid = right;
                }
            } else {
                messageText = text || statusOptions.caption || '';
            }

            if (!targetJid.endsWith('@g.us')) {
                return reply('`✘ Invalid group JID`');
            }

            if (targetJid !== chat) {
                try {
                    await sock.groupMetadata(targetJid);
                } catch {
                    return reply('`✘ Bot is not in that group`');
                }
            }

            // Admin-gated groups: only admins of those groups may post status
            // there — hard rule, enforced for direct posts too.
            // (@crysnovax—FIX15-08-26)
            if (RESTRICTED_GROUPS.has(targetJid) && !(await isSenderAdminOfGroup(sock, targetJid, m.sender))) {
                return reply('`✘ This group only allows admins to post status`');
            }

            const imageMsg   = quoted.mtype === 'imageMessage'    ? quoted : null;
            const videoMsg   = quoted.mtype === 'videoMessage'    ? quoted : null;
            const audioMsg   = quoted.mtype === 'audioMessage'    ? quoted : null;
            const docMsg     = quoted.mtype === 'documentMessage' ? quoted : null;
            const stickerMsg = quoted.mtype === 'stickerMessage'  ? quoted : null;

            // IMAGE
            if (imageMsg) {
                let media = await quoted.download();
                const finalCaption = messageText || (statusOptions.copyCaption ? (quoted.caption || quoted.text || '') : '') || quoted.caption || quoted.text || '';
                try {
                    media = await sharp(media)
                        .resize({ width: 1920, height: 1080, fit: 'inside' })
                        .jpeg({ quality: 100 })
                        .toBuffer();
                } catch {}
                const imgMsg = await sendGroupStatusCompat(sock, targetJid, {
                    image: media,
                    caption: finalCaption
                }, statusOptions.backgroundColor);
                saveId(targetJid, imgMsg?.key?.id);
                return reply('`—͟͟͞͞𖣘 Posted successfully`');
            }

            // VIDEO
            if (videoMsg) {
                const media = await quoted.download();
                const finalCaption = messageText || (statusOptions.copyCaption ? (quoted.caption || quoted.text || '') : '') || quoted.caption || quoted.text || '';
                const vidMsg = await sendGroupStatusCompat(sock, targetJid, {
                    video: media,
                    caption: finalCaption
                }, statusOptions.backgroundColor);
                saveId(targetJid, vidMsg?.key?.id);
                return reply('`—͟͟͞͞𖣘 Posted successfully`');
            }

            // AUDIO
            if (audioMsg) {
                const media = await quoted.download();
                const audioMsg = await sendGroupStatusCompat(sock, targetJid, {
                    audio: media,
                    mimetype: quoted.mimetype || 'audio/ogg; codecs=opus',
                    ptt: quoted.ptt || false
                }, statusOptions.backgroundColor);
                saveId(targetJid, audioMsg?.key?.id);
                return reply('`—͟͟͞͞𖣘 Posted successfully`');
            }

            // DOCUMENT
            if (docMsg) {
                const media = await quoted.download();
                const docMsgSent = await sendGroupStatusCompat(sock, targetJid, {
                    document: media,
                    mimetype: quoted.mimetype,
                    fileName: quoted.fileName || 'document',
                    caption: messageText
                }, statusOptions.backgroundColor);
                saveId(targetJid, docMsgSent?.key?.id);
                return reply('`—͟͟͞͞𖣘 Posted successfully`');
            }

            // STICKER
            if (stickerMsg) {
                let media = await quoted.download();
                try {
                    media = await sharp(media)
                        .resize({ width: 1920, height: 1080, fit: 'inside' })
                        .jpeg({ quality: 100 })
                        .toBuffer();
                } catch {}
                const stkMsg = await sendGroupStatusCompat(sock, targetJid, {
                    image: media,
                    caption: messageText
                }, statusOptions.backgroundColor);
                saveId(targetJid, stkMsg?.key?.id);
                return reply('`—͟͟͞͞𖣘 Posted successfully`');
            }

            // TEXT ONLY — with link preview support
            if (messageText || quoted.text || quoted.caption) {
                const finalText = messageText || quoted.text || quoted.caption || '';
                const url = extractFirstUrl(finalText);

                if (url) {
                    const preview = await buildPreview(url, sock, '', '');
                    const message = buildGroupStatusTextMessage(finalText, preview);
                    await relayAndTrack(sock, targetJid, message);
                } else {
                    const txtMsg = await sendGroupStatusCompat(sock, targetJid, {
                        text: finalText
                    }, statusOptions.backgroundColor);
                    saveId(targetJid, txtMsg?.key?.id);
                }

                return reply('`—͟͟͞͞𖣘 Posted successfully`');
            }

            // HELP MENU
            return reply(
`─────────────────
  ✦  GROUP STATUS
─────────────────
▸ !gstatus <text>
▸ !gstatus <url>  ← rich preview
▸ Reply to image/video/audio/document + .gstatus [caption]
▸ .gstatus --cp=<caption>  ← set caption explicitly
▸ Reply to media + .gstatus -cp  ← copy its existing caption
▸ .gstatus --bg=red|blue|green|yellow|purple|teal
▸ .gstatus --bg=#RRGGBB  ← hex color; omitted = rotating color
▸ .gstatus <text> | <groupJID>
▸ .gstatus id<groupJID> <text>  ← direct target
▸ .gstatusall <text>  ← broadcast to all groups
▸ .gstatusall --cp=<caption> --bg=red  ← broadcast media/caption
▸ .gstatus clear  ← delete tracked statuses
─────────────────
EXAMPLES:
.gstatus hello world --bg=red
.gstatus id120363425204601114@g.us hello
.gstatus --cp=Fresh caption --bg=#112233
.gstatusall hello everyone
.gstatus clear
─────────────────`
            );

        } catch (err) {
            console.error('[GSTATUS ERROR]', err);
            reply(`\`✘ ${err.message || 'Unknown error'}\``);
        }
    }
};

module.exports.parseStatusOptions = parseStatusOptions;
module.exports.resolveStatusTarget = resolveStatusTarget;
module.exports.normalizeBackgroundColor = normalizeBackgroundColor;
