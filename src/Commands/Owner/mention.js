const fs   = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getList } = require('../../Plugin/accessListManager');
const { getContextInfo, identityVariants, normalizeJid } = require('../../Plugin/identityUtils');
const { downloadContentFromMessage } = require('plogme');
const { loadMentionSticker } = require('../../Plugin/mentionSticker');
const {
    parseReactionCount,
    MAX_STICKER_REACTION_ATTEMPTS,
    getQuotedStickerEnvelope,
    getQuotedStickerMessage,
    isSpecialStickerMessage,
    preparePremiumStickerForResend,
    saveStickerReactionMessage
} = require('./sreact');

const MENTION_FILE = path.join(__dirname, '../../../database/mention_config.json');
const MENTION_FILTER_FILE = path.join(__dirname, '../../../database/mention_filter.json');
const MENTION_STICKER_FILE = path.join(__dirname, '../../../database/mention-sticker.webp');
const MENTION_PROTOCOL_FILE = path.join(__dirname, '../../../database/mention-sticker-message.json');
const MENTION_VOICE_FILE = path.join(__dirname, '../../../database/mention-voice.ogg');
const MENTION_SAUDIO_STICKER_FILE = path.join(__dirname, '../../../database/mention-saudio.webp');
const MAX_VOICE_BYTES = 16 * 1024 * 1024;

// IMPORTANT: Never reassign this object — always mutate it with Object.assign
// so that the exported reference in handler stays valid across reloads
const mentionConfig = {
    active: false,
    action: '',
    sreactCount: 1,
    emoji:  '❤️‍🔥',
    text:   '',
    sticker: '',
    stickerKind: 'sticker',
    stickerIsAnimated: false,
    voice: '',
    voiceMime: 'audio/ogg; codecs=opus',
    voicePtt: true,
    saudioSticker: '',
    saudioAudio: ''
};

const loadMentionConfig = () => {
    try {
        if (fs.existsSync(MENTION_FILE)) {
            Object.assign(mentionConfig, JSON.parse(fs.readFileSync(MENTION_FILE, 'utf8')));
        }
    } catch (e) {
        console.error('[MENTION] Load error:', e.message);
    }
};

const saveMentionConfig = () => {
    try {
        fs.mkdirSync(path.dirname(MENTION_FILE), { recursive: true });
        fs.writeFileSync(MENTION_FILE, JSON.stringify(mentionConfig, null, 2));
    } catch (e) {
        console.error('[MENTION] Save error:', e.message);
    }
};

loadMentionConfig();

function loadMentionFilter() {
    try {
        if (fs.existsSync(MENTION_FILTER_FILE)) {
            const value = JSON.parse(fs.readFileSync(MENTION_FILTER_FILE, 'utf8'));
            if (value === true || value === false) return { enabled: value };
            // Older releases stored chat keys. Do not let those stale local
            // overrides make the new global command behave differently by chat.
            if (value && typeof value === 'object' &&
                Object.prototype.hasOwnProperty.call(value, 'enabled')) {
                return { enabled: value.enabled === true };
            }
            return {};
        }
    } catch (e) {
        console.error('[MENTION FILTER] Load error:', e.message);
    }
    return {};
}
function saveMentionFilter(state) {
    try {
        fs.mkdirSync(path.dirname(MENTION_FILTER_FILE), { recursive: true });
        fs.writeFileSync(MENTION_FILTER_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('[MENTION FILTER] Save error:', e.message);
    }
}
function getMentionFilterSetting() {
    const state = loadMentionFilter();
    return Object.prototype.hasOwnProperty.call(state, 'enabled') ? state.enabled === true : null;
}
function setMentionFilterSetting(enabled) {
    saveMentionFilter({ enabled: Boolean(enabled) });
}
function isMentionFilterEnabled(chat, plogmeEnabled) {
    if (!plogmeEnabled) return false;
    const setting = getMentionFilterSetting();
    return setting === null ? true : setting;
}

// Helper: normalize JID for comparison
const norm = (j) => normalizeJid(j).toLowerCase().trim();

async function getPrivilegedIdentities(sock) {
    const config = require('../../../settings/config');
    const ownerNumber = (process.env.OWNER_NUMBER || config.owner || '').replace(/\D/g, '');
    const phoneJids = [
        ownerNumber && `${ownerNumber}@s.whatsapp.net`,
        ...getList('SUDO_NUMBERS').map(number => `${number}@s.whatsapp.net`),
        ...getList('DUAL_NUMBERS').map(number => `${number}@s.whatsapp.net`),
    ].filter(Boolean);

    const identities = new Set();
    for (const jid of phoneJids) {
        for (const variant of await identityVariants(sock, jid)) identities.add(norm(variant));
    }
    return identities;
}

async function isPrivilegedSender(sock, m) {
    const privileged = await getPrivilegedIdentities(sock);
    const candidates = [m?.sender, m?.key?.participant, m?.key?.participantAlt].filter(Boolean);
    for (const candidate of candidates) {
        const variants = await identityVariants(sock, candidate);
        if ([...variants].some(variant => privileged.has(norm(variant)))) return true;
    }
    return false;
}

async function isPrivilegedBotMention(sock, m) {
    if (!isExplicitlyMentioned(m) || !(await isPrivilegedSender(sock, m))) return false;
    const botIdentities = new Set();
    for (const jid of [sock.user?.id, sock.user?.lid].filter(Boolean)) {
        for (const variant of await identityVariants(sock, jid)) botIdentities.add(norm(variant));
    }
    for (const jid of getExplicitMentionedJids(m)) {
        const variants = await identityVariants(sock, jid);
        if ([...variants].some(variant => botIdentities.has(norm(variant)))) return true;
    }
    return false;
}

async function isPrivilegedMentioned(sock, m, mek) {
    if (m.key?.fromMe) return false;
    const context = getContextInfo(m);
    // Only explicit @tags count. Reply metadata (participant/quoted sender)
    // must not trigger the configured mention response.
    const mentions = [...new Set([
        ...(context.mentionedJid || []),
        ...(m.mentionedJid || []),
        ...(m.msg?.contextInfo?.mentionedJid || []),
    ].filter(Boolean))];
    if (!mentions.length) return false;

    const privileged = await getPrivilegedIdentities(sock);
    for (const jid of mentions) {
        const variants = await identityVariants(sock, jid);
        if ([...variants].some(variant => privileged.has(norm(variant)))) return true;
    }
    return false;
}

function getExplicitMentionedJids(m) {
    const context = getContextInfo(m);
    return [...new Set([
        ...(context.mentionedJid || []),
        ...(m.mentionedJid || []),
        ...(m.msg?.contextInfo?.mentionedJid || []),
    ].filter(Boolean))];
}
function isExplicitlyMentioned(m) {
    return !m?.key?.fromMe && getExplicitMentionedJids(m).length > 0;
}

async function sendMentionSticker(sock, jid, options = {}) {
    if (mentionConfig.stickerKind === 'lottie' || mentionConfig.stickerKind === 'protocol') {
        if (!fs.existsSync(MENTION_PROTOCOL_FILE) || typeof sock.relayMessage !== 'function') {
            throw new Error('Special mention stickers require a preserved protocol message');
        }
        const saved = JSON.parse(fs.readFileSync(MENTION_PROTOCOL_FILE, 'utf8'));
        if (!saved || !['stickerMessage', 'lottieStickerMessage'].includes(saved.type) || !saved.value) {
            throw new Error('Saved special mention sticker has an invalid protocol envelope');
        }
        const sticker = preparePremiumStickerForResend(saved);
        return sock.relayMessage(jid, { [sticker.type]: sticker.value }, {
            messageId: options.messageId || undefined
        });
    }
    const payload = await loadMentionSticker(mentionConfig.sticker, {
        kind: mentionConfig.stickerKind,
        isAnimated: mentionConfig.stickerIsAnimated
    });
    return sock.sendMessage(jid, {
        sticker: payload.buffer,
        isAnimated: payload.isAnimated,
        premium: 1
    }, options.quoted ? { quoted: options.quoted } : undefined);
}

function saveMentionStickerEnvelope(envelope) {
    fs.mkdirSync(path.dirname(MENTION_PROTOCOL_FILE), { recursive: true });
    fs.writeFileSync(MENTION_PROTOCOL_FILE, JSON.stringify({ type: envelope.type, value: envelope.value }));
}

async function sendMentionVoice(sock, jid, options = {}) {
    const voicePath = mentionConfig.voice || MENTION_VOICE_FILE;
    if (!fs.existsSync(voicePath)) throw new Error('Configured mention voice note is missing');
    const audio = await fs.promises.readFile(voicePath);
    if (!audio.length) throw new Error('Configured mention voice note is empty');
    return sock.sendMessage(jid, {
        audio,
        mimetype: mentionConfig.voiceMime || 'audio/ogg; codecs=opus',
        ptt: mentionConfig.voicePtt !== false
    }, options.quoted ? { quoted: options.quoted } : undefined);
}

async function sendMentionSaudio(sock, jid, options = {}) {
    const stickerPath = mentionConfig.saudioSticker || MENTION_SAUDIO_STICKER_FILE;
    if (!fs.existsSync(stickerPath)) throw new Error('Configured mention saudio sticker is missing');
    const sticker = await fs.promises.readFile(stickerPath);
    if (!sticker.length || !mentionConfig.saudioAudio) throw new Error('Configured mention saudio audio is missing');
    return sock.sendMessage(jid, {
        sticker,
        stickerAudio: { url: mentionConfig.saudioAudio }
    }, options.quoted ? { quoted: options.quoted } : undefined);
}

function convertToVoiceNote(inputBuffer) {
    if (!Buffer.isBuffer(inputBuffer) || !inputBuffer.length) {
        return Promise.reject(new Error('Audio input is empty'));
    }
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, [
            '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn',
            '-c:a', 'libopus', '-b:a', '32k', '-application', 'voip',
            '-ar', '48000', '-ac', '1', '-f', 'ogg', 'pipe:1'
        ]);
        const chunks = [];
        let outputBytes = 0;
        let stderr = '';
        let settled = false;
        const fail = error => {
            if (settled) return;
            settled = true;
            reject(error);
        };
        ffmpeg.stdout.on('data', chunk => {
            outputBytes += chunk.length;
            if (outputBytes > MAX_VOICE_BYTES) {
                ffmpeg.kill('SIGKILL');
                fail(new Error('Converted voice note exceeds the 16 MB limit'));
                return;
            }
            chunks.push(chunk);
        });
        ffmpeg.stderr.on('data', chunk => {
            if (stderr.length < 8000) stderr += chunk.toString().slice(0, 8000 - stderr.length);
        });
        ffmpeg.on('error', error => fail(new Error(`FFmpeg could not start: ${error.message}`)));
        ffmpeg.on('close', code => {
            if (settled) return;
            if (code !== 0) return fail(new Error(`Audio conversion failed: ${stderr.trim() || `FFmpeg exited ${code}`}`));
            const output = Buffer.concat(chunks);
            if (!output.length) return fail(new Error('Audio conversion produced an empty voice note'));
            settled = true;
            resolve(output);
        });
        ffmpeg.stdin.on('error', error => {
            if (error.code !== 'EPIPE') fail(error);
        });
        ffmpeg.stdin.end(inputBuffer);
    });
}

module.exports = {
    name:      'mention',
    alias:     ['tagme', 'owntag'],
    desc:           'Set action when owner, sudo, or dual is mentioned',
    category:       'Owner',
    privilegedOnly: true,

    execute: async (sock, m, { args, reply, prefix }) => {
        const option = args[0]?.toLowerCase();
        const value  = args.slice(1).join(' ');

        // The filter setting is global. Its effective behavior still follows
        // the current chat's PLOGME state: PLOGME off always disables it.
        if (option === 'filter') {
            const requested = args[1]?.toLowerCase();
            if (!['on', 'off', 'status'].includes(requested)) {
                return reply(`Usage: ${prefix}mention filter on|off|status`);
            }
            const plogme = require('../Core/plogme');
            const plogmeEnabled = plogme.isEnabled(m.chat);
            if (requested === 'status') {
                const setting = getMentionFilterSetting();
                const effective = isMentionFilterEnabled(m.chat, plogmeEnabled);
                return reply(`╭─❍ *MENTION FILTER*\n│\n│ ✦ Effective : ${effective ? '✓ ON' : '✗ OFF'}\n│ 🤖 Plogme   : ${plogmeEnabled ? '✓ ON' : '✗ OFF'}\n│ ⚙️ Setting  : ${setting === null ? 'AUTO' : (setting ? 'ON' : 'OFF')}\n╰──────────────────`);
            }
            const enabled = requested === 'on';
            setMentionFilterSetting(enabled);
            return reply(`╭─❍ *MENTION FILTER*\n│\n│ ✦ Setting  : ${enabled ? '✓ ON' : '✗ OFF'}\n│ 🤖 Plogme   : ${plogmeEnabled ? '✓ ON' : '✗ OFF'}\n│ ⚡ Effective: ${isMentionFilterEnabled(m.chat, plogmeEnabled) ? '✓ ON' : '✗ OFF'}\n╰──────────────────`);
        }

        // OFF
        if (option === 'off') {
            mentionConfig.active = false;
            mentionConfig.action = '';
            saveMentionConfig();
            return reply('╭─❍ *MENTION*\n│\n│ ✦ Status : OFF\n│ 𓄄 Action : disabled\n╰──────────────────');
        }

        // STATUS
        if (option === 'status' || option === '-status') {
            return reply(
                `╭─❍ *MENTION STATUS*\n│\n` +
                `│ ⚉ Active : ${mentionConfig.active ? '✓ ON' : '✗ OFF'}\n` +
                `│ 𓄄 Action : ${mentionConfig.action || 'None'}\n` +
                `│ ✦ Emoji  : ${mentionConfig.emoji  || '-'}\n` +
                `│ ❏ Text   : ${mentionConfig.text   || '-'}\n` +
                `│ 🧩 Sticker: ${mentionConfig.sticker ? 'Configured' : '-'}\n` +
                `│ 🎙️ Voice : ${mentionConfig.voice ? 'Configured' : '-'}\n` +
                `│ 🔊 Saudio : ${mentionConfig.saudioSticker && mentionConfig.saudioAudio ? 'Configured' : '-'}\n` +
                `╰──────────────────`
            );
        }

        // REACT
        if (option === 'react' || option === '-react') {
            if (!value) {
                return reply('╭─❍ *MENTION*\n│\n│ ✘ Provide an emoji\n│ ⚉ Example: .mention -react ❤️‍🔥\n╰──────────────────');
            }
            mentionConfig.active = true;
            mentionConfig.action = 'react';
            mentionConfig.emoji  = value;
            mentionConfig.text   = '';
            saveMentionConfig();
            return reply(`╭─❍ *MENTION*\n│\n│ ✦ Status : ON\n│ 𓄄 Action : REACT\n│ ⚉ Emoji  : ${value}\n╰──────────────────`);
        }

        // STICKER REACTION: use the saved sticker reaction. Reply to a
        // sticker here to replace it for both .sreact and mention-sreact.
        if (option === 'sreact' || option === '-sreact') {
            const repeatCount = args.length <= 2 ? parseReactionCount(args[1]) : null;
            if (!repeatCount) {
                return reply(`Usage: ${prefix}mention sreact [1-${MAX_STICKER_REACTION_ATTEMPTS}].`);
            }
            const quotedSticker = getQuotedStickerMessage(m.quoted);
            if (quotedSticker) {
                try {
                    saveStickerReactionMessage(m.quoted);
                } catch (error) {
                    return reply(`Could not save that sticker reaction: ${error.message}`);
                }
            }
            mentionConfig.active = true;
            mentionConfig.action = 'sreact';
            mentionConfig.sreactCount = repeatCount;
            mentionConfig.emoji = '';
            mentionConfig.text = '';
            saveMentionConfig();
            return reply(`╭─❍ *MENTION*\n│ ✦ Status : ON\n│ 𓄄 Action : STICKER REACTION\n│ Repeat attempts : ${repeatCount}\n╰──────────────────`);
        }

        // STICKER: quote a sticker, or provide a direct sticker URL.
        if (option === 'sticker' || option === '-sticker') {
            const quotedEnvelope = getQuotedStickerEnvelope(m.quoted);
            const quotedSticker = quotedEnvelope?.type === 'stickerMessage' ? quotedEnvelope.value : null;
            if (quotedEnvelope?.type === 'lottieStickerMessage') {
                // Lottie is a distinct WAProto wrapper; plogme intentionally
                // does not expose it as a normal downloadable sticker type.
                // Preserve and relay that wrapper rather than creating the
                // "cannot view sticker" placeholder.
                saveMentionStickerEnvelope(quotedEnvelope);
                mentionConfig.sticker = MENTION_PROTOCOL_FILE;
                mentionConfig.stickerKind = 'lottie';
                mentionConfig.stickerIsAnimated = true;
            } else if (isSpecialStickerMessage(quotedSticker)) {
                // Re-relay the original proto so premium/AI flags and media keys
                // survive; downloading and re-uploading would strip that metadata.
                saveMentionStickerEnvelope(quotedEnvelope);
                mentionConfig.sticker = MENTION_PROTOCOL_FILE;
                mentionConfig.stickerKind = 'protocol';
                mentionConfig.stickerIsAnimated = Boolean(quotedSticker.isAnimated);
            } else if (quotedSticker) {
                const stream = await downloadContentFromMessage(quotedSticker, 'sticker');
                const chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                fs.mkdirSync(path.dirname(MENTION_STICKER_FILE), { recursive: true });
                fs.writeFileSync(MENTION_STICKER_FILE, Buffer.concat(chunks));
                mentionConfig.sticker = MENTION_STICKER_FILE;
                mentionConfig.stickerKind = 'sticker';
                mentionConfig.stickerIsAnimated = Boolean(quotedSticker?.isAnimated);
                if (fs.existsSync(MENTION_PROTOCOL_FILE)) fs.rmSync(MENTION_PROTOCOL_FILE, { force: true });
            } else if (value && /^https?:\/\//i.test(value)) {
                mentionConfig.sticker = value;
                mentionConfig.stickerKind = 'sticker';
                mentionConfig.stickerIsAnimated = false;
            } else if (!mentionConfig.sticker) {
                return reply(`╭─❍ *MENTION*\n│ ✘ Reply to a sticker or provide a sticker URL\n│ ⚉ Example: ${prefix}mention -sticker <url>\n╰──────────────────`);
            }
            mentionConfig.active = true;
            mentionConfig.action = 'sticker';
            mentionConfig.emoji = '';
            mentionConfig.text = '';
            saveMentionConfig();
            return reply(`╭─❍ *MENTION*\n│ ✦ Status : ON\n│ 𓄄 Action : STICKER\n╰──────────────────`);
        }

        // SAUDIO: reply to a sticker with an audio URL and save the resulting
        // sticker-audio payload for automatic mention responses.
        if (option === 'saudio' || option === '-saudio') {
            if (!value || !/^https?:\/\//i.test(value)) {
                return reply(`╭─❍ *MENTION*\n│ ✘ Provide an audio URL\n│ ⚉ Reply to a sticker\n│ ⚉ Example: ${prefix}mention saudio <audio url>\n╰──────────────────`);
            }
            const saudio = require('../Media/sa.js');
            const quoted = m.quoted;
            const qmsg = quoted?.message || {};
            const inner = qmsg.viewOnceMessage?.message || qmsg.viewOnceMessageV2?.message || qmsg.ephemeralMessage?.message || qmsg || {};
            const isSticker = !!inner.stickerMessage || (quoted?.mtype || '').includes('sticker');
            if (!quoted || !isSticker) {
                return reply(`╭─❍ *MENTION*\n│ ✘ Reply to a sticker first\n│ ⚉ Example: ${prefix}mention saudio <audio url>\n╰──────────────────`);
            }
            try {
                const payload = await saudio.createStickerAudioPayload(quoted, value);
                fs.mkdirSync(path.dirname(MENTION_SAUDIO_STICKER_FILE), { recursive: true });
                fs.writeFileSync(MENTION_SAUDIO_STICKER_FILE, payload.stickerBuffer);
                mentionConfig.saudioSticker = MENTION_SAUDIO_STICKER_FILE;
                mentionConfig.saudioAudio = payload.stickerAudio?.url || '';
                mentionConfig.active = true;
                mentionConfig.action = 'saudio';
                mentionConfig.emoji = '';
                mentionConfig.text = '';
                saveMentionConfig();
                return reply('╭─❍ *MENTION*\n│ ✦ Status : ON\n│ 𓄄 Action : STICKER AUDIO\n│ 🔊 Sticker-audio response saved\n╰──────────────────');
            } catch (error) {
                console.error('[MENTION SAUDIO]', error?.message || error);
                return reply(`Could not create sticker-audio response: ${error?.message || 'unknown error'}`);
            }
        }

        // VOICE: reply to an audio message to save it as the mention response.
        if (option === 'voice' || option === '-voice') {
            const quotedAudio = m.quoted?.audioMessage || m.quoted?.message?.audioMessage ||
                (m.quoted?.mtype === 'audioMessage' ? m.quoted : null);
            if (!quotedAudio) {
                return reply(`╭─❍ *MENTION*\n│ ✘ Reply to a voice note/audio message first\n│ ⚉ Example: ${prefix}mention -voice\n╰──────────────────`);
            }
            const stream = await downloadContentFromMessage(quotedAudio, 'audio');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const sourceAudio = Buffer.concat(chunks);
            if (!sourceAudio.length) return reply('Could not read that audio. Please try another voice note.');
            let audio;
            try {
                audio = await convertToVoiceNote(sourceAudio);
            } catch (error) {
                console.error('[MENTION VOICE CONVERSION]', error?.message || error);
                return reply(`Could not convert that audio to a voice note: ${error?.message || 'unknown conversion error'}`);
            }
            fs.mkdirSync(path.dirname(MENTION_VOICE_FILE), { recursive: true });
            fs.writeFileSync(MENTION_VOICE_FILE, audio);
            mentionConfig.voice = MENTION_VOICE_FILE;
            mentionConfig.voiceMime = 'audio/ogg; codecs=opus';
            mentionConfig.voicePtt = true;
            mentionConfig.active = true;
            mentionConfig.action = 'voice';
            mentionConfig.emoji = '';
            mentionConfig.text = '';
            saveMentionConfig();
            return reply('╭─❍ *MENTION*\n│ ✦ Status : ON\n│ 𓄄 Action : VOICE NOTE\n│ 🎙️ Voice response saved\n╰──────────────────');
        }

        // TEXT
        if (option === 'text' || option === '-text') {
            if (!value) {
                return reply('╭─❍ *MENTION*\n│\n│ ✘ Provide text\n│ ⚉ Example: .mention -text Busy, back later\n╰──────────────────');
            }
            mentionConfig.active = true;
            mentionConfig.action = 'text';
            mentionConfig.text   = value;
            mentionConfig.emoji  = '';
            saveMentionConfig();
            return reply(`╭─❍ *MENTION*\n│\n│ ✦ Status : ON\n│ 𓄄 Action : TEXT\n│ ⚉ Text   : ${value.slice(0, 30)}${value.length > 30 ? '...' : ''}\n╰──────────────────`);
        }

        // HELP
        return reply(
            `╭─❍ *MENTION CONFIGURATION*\n│\n` +
            `│ Configure one auto-response for owner, sudo, and dual mentions.\n│\n` +
            `│ ⚉ *Commands:*\n│\n` +
            `│ ➫ ${prefix}mention off\n` +
            `│   Disable mention responses\n│\n` +
            `│ ➫ ${prefix}mention -status\n` +
            `│   Show current configuration\n│\n` +
            `│ ➫ ${prefix}mention filter on/off\n` +
            `│   Suppress privileged responses while Plogme is ON\n│\n` +
            `│ ➫ ${prefix}mention -react <emoji>\n` +
            `│   Auto-react when mentioned\n` +
            `│   Example: ${prefix}mention -react ❤️‍🔥\n│\n` +
            `│ ➫ ${prefix}mention sreact [count]\n` +
            `│   Repeat the built-in sticker reaction on mentions (1-${MAX_STICKER_REACTION_ATTEMPTS}; default 1)\n│\n` +
            `│ ➫ ${prefix}mention -sticker [url]\n` +
            `│   Reply to a sticker or provide a sticker URL\n│\n` +
            `│ ➫ ${prefix}mention -voice\n` +
            `│   Reply to a voice note/audio message to save the response\n│\n` +
            `│ ➫ ${prefix}mention saudio <audio url>\n` +
            `│   Reply to a sticker to save a sticker-audio response\n│\n` +
            `│ ➫ ${prefix}mention -text <message>\n` +
            `│   Auto-reply when mentioned\n` +
            `│   Example: ${prefix}mention -text Busy, back later\n│\n` +
            `╰──────────────────`
        );
    }
};

module.exports.mentionConfig = mentionConfig;
module.exports.loadMentionConfig = loadMentionConfig;
module.exports.getPrivilegedIdentities = getPrivilegedIdentities;
module.exports.isPrivilegedSender = isPrivilegedSender;
module.exports.isPrivilegedBotMention = isPrivilegedBotMention;
module.exports.isPrivilegedMentioned = isPrivilegedMentioned;
module.exports.getExplicitMentionedJids = getExplicitMentionedJids;
module.exports.isExplicitlyMentioned = isExplicitlyMentioned;
module.exports.getMentionFilterSetting = getMentionFilterSetting;
module.exports.setMentionFilterSetting = setMentionFilterSetting;
module.exports.isMentionFilterEnabled = isMentionFilterEnabled;
module.exports.sendMentionSticker = sendMentionSticker;
module.exports.sendMentionVoice = sendMentionVoice;
module.exports.sendMentionSaudio = sendMentionSaudio;
module.exports.convertToVoiceNote = convertToVoiceNote;
module.exports.norm = norm;
