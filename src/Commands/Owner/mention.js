const fs   = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getList } = require('../../Plugin/accessListManager');
const { getContextInfo, identityVariants, normalizeJid } = require('../../Plugin/identityUtils');
const { downloadContentFromMessage } = require('plogme');
const { loadMentionSticker } = require('../../Plugin/mentionSticker');

const MENTION_FILE = path.join(__dirname, '../../../database/mention_config.json');
const MENTION_STICKER_FILE = path.join(__dirname, '../../../database/mention-sticker.webp');
const MENTION_PROTOCOL_FILE = path.join(__dirname, '../../../database/mention-sticker-message.json');
const MENTION_VOICE_FILE = path.join(__dirname, '../../../database/mention-voice.ogg');
const MAX_VOICE_BYTES = 16 * 1024 * 1024;

// IMPORTANT: Never reassign this object — always mutate it with Object.assign
// so that the exported reference in handler stays valid across reloads
const mentionConfig = {
    active: false,
    action: '',
    emoji:  '❤️‍🔥',
    text:   '',
    sticker: '',
    stickerKind: 'sticker',
    stickerIsAnimated: false,
    voice: '',
    voiceMime: 'audio/ogg; codecs=opus',
    voicePtt: true
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

// Helper: normalize JID for comparison
const norm = (j) => normalizeJid(j).toLowerCase().trim();

async function getPrivilegedIdentities(sock) {
    const config = require('../../../settings/config');
    const ownerNumber = (process.env.OWNER_NUMBER || config.owner || '').replace(/\D/g, '');
    const phoneJids = [
        ownerNumber && `${ownerNumber}@s.whatsapp.net`,
        normalizeJid(sock.user?.id || ''),
        ...getList('SUDO_NUMBERS').map(number => `${number}@s.whatsapp.net`),
        ...getList('DUAL_NUMBERS').map(number => `${number}@s.whatsapp.net`),
    ].filter(Boolean);

    const identities = new Set();
    for (const jid of phoneJids) {
        for (const variant of await identityVariants(sock, jid)) identities.add(norm(variant));
    }
    if (sock.user?.lid) identities.add(norm(sock.user.lid));
    return identities;
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

async function sendMentionSticker(sock, jid, options = {}) {
    if (mentionConfig.stickerKind === 'lottie') {
        if (!fs.existsSync(MENTION_PROTOCOL_FILE) || typeof sock.relayMessage !== 'function') {
            throw new Error('Lottie mention stickers require a preserved protocol message');
        }
        const saved = JSON.parse(fs.readFileSync(MENTION_PROTOCOL_FILE, 'utf8'));
        return sock.relayMessage(jid, { [saved.type]: saved.value }, {
            messageId: options.messageId || undefined
        });
    }
    const payload = await loadMentionSticker(mentionConfig.sticker, {
        kind: mentionConfig.stickerKind,
        isAnimated: mentionConfig.stickerIsAnimated
    });
    return sock.sendMessage(jid, { sticker: payload.buffer, isAnimated: payload.isAnimated }, options.quoted ? { quoted: options.quoted } : undefined);
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

        // STICKER: quote a sticker, or provide a direct sticker URL.
        if (option === 'sticker' || option === '-sticker') {
            const quotedSticker = m.quoted?.stickerMessage || m.quoted?.message?.stickerMessage || (m.quoted?.mtype === 'stickerMessage' ? m.quoted : null);
            const quotedLottie = m.quoted?.lottieStickerMessage || m.quoted?.message?.lottieStickerMessage || (m.quoted?.mtype === 'lottieStickerMessage' ? m.quoted : null);
            if (quotedLottie) {
                // Lottie is a distinct WAProto wrapper; plogme intentionally
                // does not expose it as a normal downloadable sticker type.
                // Preserve and relay that wrapper rather than creating the
                // "cannot view sticker" placeholder.
                fs.mkdirSync(path.dirname(MENTION_PROTOCOL_FILE), { recursive: true });
                fs.writeFileSync(MENTION_PROTOCOL_FILE, JSON.stringify({ type: 'lottieStickerMessage', value: quotedLottie }));
                mentionConfig.sticker = MENTION_PROTOCOL_FILE;
                mentionConfig.stickerKind = 'lottie';
                mentionConfig.stickerIsAnimated = true;
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
            return reply(`${prefix}╭─❍ *MENTION*\n│\n│ ✦ Status : ON\n│ 𓄄 Action : TEXT\n│ ⚉ Text   : ${value.slice(0, 30)}${value.length > 30 ? '...' : ''}\n╰──────────────────`);
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
            `│ ➫ ${prefix}mention -react <emoji>\n` +
            `│   Auto-react when mentioned\n` +
            `│   Example: ${prefix}mention -react ❤️‍🔥\n│\n` +
            `│ ➫ ${prefix}mention -sticker [url]\n` +
            `│   Reply to a sticker or provide a sticker URL\n│\n` +
            `│ ➫ ${prefix}mention -voice\n` +
            `│   Reply to a voice note/audio message to save the response\n│\n` +
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
module.exports.isPrivilegedMentioned = isPrivilegedMentioned;
module.exports.sendMentionSticker = sendMentionSticker;
module.exports.sendMentionVoice = sendMentionVoice;
module.exports.convertToVoiceNote = convertToVoiceNote;
module.exports.norm = norm;
