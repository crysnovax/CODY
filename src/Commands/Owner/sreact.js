'use strict';

const fs = require('fs');
const path = require('path');

// Default animated sticker supplied by the repository owner. It is sent as a
// WhatsApp association reaction to the message targeted by .sreact.
const DEFAULT_STICKER_MESSAGE = Object.freeze({
    url: 'https://mmg.whatsapp.net/o1/v/t24/f2/m232/AQPEoFVa7kEaTxJ5N4kBacoDZ1k0IzHqkfsmUhLxV8C4xB11yCktX6UEHvkJnmgTsnEhoRW27_Pma0f92oVnKzwBB4YUsMbtz2HlS_Oxeg?ccb=9-4&oh=01_Q5Aa5wEK3E2DIH-ZBY_naItwmTshYSHL2bClVxX2UUGd6_gOyw&oe=6B0DB1D3&_nc_sid=e6ed6c&mms3=true',
    fileSha256: 'BsnVlbXyY2a722AugpS5TLIuxPNmaHRU2Hi9vL90USY=',
    fileEncSha256: 'PQcd/lNPjIt/cbpv3UuTrnd5OH7O1GnASu0C3c+PdQg=',
    mediaKey: 'j6kvKJ0k1eha91lF+ruW+5TPGP5inpuCePSrFs0nhuI=',
    mimetype: 'image/webp',
    height: 64,
    width: 64,
    directPath: '/o1/v/t24/f2/m232/AQPEoFVa7kEaTxJ5N4kBacoDZ1k0IzHqkfsmUhLxV8C4xB11yCktX6UEHvkJnmgTsnEhoRW27_Pma0f92oVnKzwBB4YUsMbtz2HlS_Oxeg?ccb=9-4&oh=01_Q5Aa5wEK3E2DIH-ZBY_naItwmTshYSHL2bClVxX2UUGd6_gOyw&oe=6B0DB1D3&_nc_sid=e6ed6c',
    fileLength: '373112',
    mediaKeyTimestamp: '1793438486',
    firstFrameLength: 372742,
    firstFrameSidecar: 'z4sdmAKy5mcQPA==',
    isAnimated: true,
    isLottie: false,
    isAvatar: false,
    isAiSticker: false,
    premium: 0
});

const CUSTOM_STICKER_FILE = path.join(process.cwd(), 'database', 'sreact-sticker-message.json');
const MAX_STICKER_REACTION_ATTEMPTS = 10;
const STICKER_REACTION_DELAY_MS = 250;

function parseReactionCount(value) {
    if (value === undefined) return 1;
    if (!/^[1-9]\d*$/.test(String(value))) return null;
    const count = Number(value);
    return Number.isSafeInteger(count) && count <= MAX_STICKER_REACTION_ATTEMPTS ? count : null;
}

function getQuotedStickerEnvelope(quoted) {
    if (!quoted || typeof quoted !== 'object') return null;
    if (quoted.lottieStickerMessage) {
        return { type: 'lottieStickerMessage', value: quoted.lottieStickerMessage };
    }
    if (quoted.mtype === 'lottieStickerMessage') {
        return { type: 'lottieStickerMessage', value: quoted.message ? { message: quoted.message } : quoted };
    }
    if (quoted.message?.lottieStickerMessage) {
        return { type: 'lottieStickerMessage', value: quoted.message.lottieStickerMessage };
    }
    const stickerMessage = quoted.stickerMessage || quoted.message?.stickerMessage ||
        (quoted.mtype === 'stickerMessage' ? quoted : null);
    return stickerMessage ? { type: 'stickerMessage', value: stickerMessage } : null;
}

function getQuotedStickerMessage(quoted) {
    return getQuotedStickerEnvelope(quoted)?.value || null;
}

function isSpecialStickerMessage(stickerMessage) {
    return Boolean(stickerMessage && (
        stickerMessage.isLottie === true ||
        stickerMessage.isAiSticker === true ||
        Number(stickerMessage.premium) > 0
    ));
}

function preparePremiumStickerForResend(envelope) {
    const resendMessage = (message) => {
        if (!message || typeof message !== 'object') return message;
        if (message.stickerMessage) {
            const stickerMessage = { ...message.stickerMessage, premium: 1 };
            // Forwarding indicators live in StickerMessage.contextInfo. Keep
            // association context on the outer message, but never copy the
            // source sticker's quote/forward metadata into this new send.
            delete stickerMessage.contextInfo;
            return { ...message, stickerMessage };
        }
        if (message.lottieStickerMessage) {
            return { ...message, lottieStickerMessage: resendMessage(message.lottieStickerMessage) };
        }
        if (message.message) {
            return { ...message, message: resendMessage(message.message) };
        }
        const stickerMessage = { ...message, premium: 1 };
        delete stickerMessage.contextInfo;
        return stickerMessage;
    };
    return { type: envelope.type, value: resendMessage(envelope.value) };
}

function loadStickerReactionEnvelope() {
    try {
        if (!fs.existsSync(CUSTOM_STICKER_FILE)) {
            return { type: 'stickerMessage', value: DEFAULT_STICKER_MESSAGE };
        }
        const saved = JSON.parse(fs.readFileSync(CUSTOM_STICKER_FILE, 'utf8'));
        if (saved && typeof saved === 'object' && saved.__codyStickerEnvelope === 1 &&
            ['stickerMessage', 'lottieStickerMessage'].includes(saved.type) && saved.value && typeof saved.value === 'object') {
            return { type: saved.type, value: saved.value };
        }
        if (saved && typeof saved === 'object' && saved.lottieStickerMessage) {
            return { type: 'lottieStickerMessage', value: saved.lottieStickerMessage };
        }
        if (saved && typeof saved === 'object' && saved.stickerMessage) {
            return { type: 'stickerMessage', value: saved.stickerMessage };
        }
        // Older Lottie saves contain the FutureProofMessage value, sometimes
        // with command-only mtype fields and sometimes without them.
        if (saved?.mtype === 'lottieStickerMessage') {
            return {
                type: 'lottieStickerMessage',
                value: saved?.message ? { message: saved.message } : saved
            };
        }
        if (saved?.message?.lottieStickerMessage) {
            return { type: 'lottieStickerMessage', value: saved.message.lottieStickerMessage };
        }
        if (saved?.message?.stickerMessage) {
            return { type: 'lottieStickerMessage', value: { message: saved.message } };
        }
        return saved && typeof saved === 'object'
            ? { type: 'stickerMessage', value: saved }
            : { type: 'stickerMessage', value: DEFAULT_STICKER_MESSAGE };
    } catch (error) {
        console.error('[SREACT] Could not load saved sticker:', error.message);
        return { type: 'stickerMessage', value: DEFAULT_STICKER_MESSAGE };
    }
}

function loadStickerReactionMessage() {
    return loadStickerReactionEnvelope().value;
}

function saveStickerEnvelope(envelope) {
    fs.mkdirSync(path.dirname(CUSTOM_STICKER_FILE), { recursive: true });
    const saved = envelope.type === 'lottieStickerMessage'
        ? { __codyStickerEnvelope: 1, type: envelope.type, value: envelope.value }
        : envelope.value;
    fs.writeFileSync(CUSTOM_STICKER_FILE, JSON.stringify(saved, null, 2));
    return true;
}

function saveStickerReactionMessage(quoted) {
    const envelope = getQuotedStickerEnvelope(quoted);
    if (!envelope) return false;
    return saveStickerEnvelope(envelope);
}

async function sendStickerReaction(sock, jid, parentMessageKey, count = 1) {
    const attempts = parseReactionCount(count);
    if (!attempts || !parentMessageKey?.id || typeof sock?.relayMessage !== 'function') return false;

    const sticker = preparePremiumStickerForResend(loadStickerReactionEnvelope());
    for (let attempt = 0; attempt < attempts; attempt += 1) {
        await sock.relayMessage(jid, {
            messageContextInfo: {
                messageAssociation: {
                    associationType: 11,
                    parentMessageKey
                }
            },
            [sticker.type]: { ...sticker.value }
        }, {});

        if (attempt + 1 < attempts) {
            await new Promise(resolve => setTimeout(resolve, STICKER_REACTION_DELAY_MS));
        }
    }
    return true;
}

module.exports = {
    name: 'sreact',
    alias: ['stickerreact'],
    category: 'Owner',
    privilegedOnly: true,
    desc: 'Send the saved sticker reaction to a replied-to message, optionally repeating it',
    usage: '.sreact add (reply to a sticker) | .sreact [count] (reply to a message)',
    execute: async (sock, m, { args = [], reply }) => {
        if (String(args[0] || '').toLowerCase() === 'add') {
            if (args.length !== 1) {
                return reply('Usage: reply to a sticker and send .sreact add.');
            }
            const quotedSticker = getQuotedStickerMessage(m.quoted);
            if (!quotedSticker) {
                return reply('Reply to a sticker and send .sreact add to save it as the new sreact sticker.');
            }
            try {
                saveStickerReactionMessage(m.quoted);
                return reply('New sreact sticker saved.');
            } catch (error) {
                return reply(`Could not save that sticker reaction: ${error.message}`);
            }
        }

        const count = args.length <= 1 ? parseReactionCount(args[0]) : null;
        if (!count) {
            return reply(`Usage: reply to a message and use .sreact [1-${MAX_STICKER_REACTION_ATTEMPTS}].`);
        }
        const targetKey = m.quoted?.key;
        if (!targetKey?.id) {
            return reply('Reply to the message you want to react to, then send .sreact [count].');
        }

        // Replying to a sticker replaces the saved reaction sticker. The same
        // command still reacts immediately to that sticker/message.
        const quotedSticker = getQuotedStickerMessage(m.quoted);
        if (quotedSticker) {
            try {
                saveStickerReactionMessage(m.quoted);
            } catch (error) {
                return reply(`Could not save that sticker reaction: ${error.message}`);
            }
        }

        const sent = await sendStickerReaction(sock, m.chat, targetKey, count);
        if (!sent) return reply('Could not send the sticker reaction in this chat.');
    },
    DEFAULT_STICKER_MESSAGE,
    CUSTOM_STICKER_FILE,
    MAX_STICKER_REACTION_ATTEMPTS,
    parseReactionCount,
    getQuotedStickerEnvelope,
    getQuotedStickerMessage,
    isSpecialStickerMessage,
    preparePremiumStickerForResend,
    loadStickerReactionEnvelope,
    loadStickerReactionMessage,
    saveStickerReactionMessage,
    sendStickerReaction
};
