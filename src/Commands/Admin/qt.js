'use strict';

const {
    getContextInfo,
    getMessageText,
    getMessageType,
    messagePayload,
    unwrapMessage,
} = require('../../../library/message-content');

const MEDIA_TYPES = {
    imageMessage: 'image',
    videoMessage: 'video',
    audioMessage: 'audio',
    documentMessage: 'document',
    stickerMessage: 'sticker',
};

function rawQuotedMessage(value) {
    if (!value || typeof value !== 'object') return null;
    if (value.fakeObj?.message) return value.fakeObj;
    if (value.message?.key && value.message.message) return value.message;
    if (value.key && value.message) return value;
    return null;
}

function storeEnvelope(value) {
    if (value?.message?.key && value.message.message) return value.message;
    if (value?.key && value.message) return value;
    return null;
}

async function findRepliedMessage(m, store, sock) {
    const quoted = m?.quoted;
    const direct = rawQuotedMessage(quoted);
    if (direct?.message) return direct;

    const id = quoted?.id || quoted?.key?.id || quoted?.fakeObj?.key?.id;
    if (!id) return null;
    const jids = [...new Set([
        quoted?.chat,
        quoted?.key?.remoteJid,
        quoted?.fakeObj?.key?.remoteJid,
        m?.chat,
    ].filter(Boolean))];

    for (const jid of jids) {
        if (typeof store?.loadMessage === 'function') {
            try {
                const loaded = storeEnvelope(await store.loadMessage(jid, id, sock));
                if (loaded?.message) return loaded;
            } catch {}
        }
        if (typeof store?.messages?.get === 'function') {
            try {
                const loaded = storeEnvelope(store.messages.get(`${jid}:${id}`));
                if (loaded?.message) return loaded;
            } catch {}
        }
    }
    return null;
}

module.exports = {
    name: 'quoted',
    alias: ['getquoted', 'showquoted'],
    desc: 'Get the exact quoted message content',
    category: 'Tools',
    usage: `${prefix}quoted (reply to a message; unwraps its quote when present)`,
    reactions: { start: '📝', success: '💬', error: '📡' },
    adminOnly: false,
    ownerOnly: true,
    groupOnly: false,

    execute: async (sock, m, { reply, store, prefix = '.' }) => {
        await sock.sendMessage(m.chat, { react: { text: '📝', key: m.key } });

        if (!m.quoted) {
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            return reply('⊘ *Reply to a message to use this command!*');
        }

        try {
            const stored = await findRepliedMessage(m, store, sock);
            const target = stored?.message || messagePayload(m.quoted);
            if (!target || typeof target !== 'object' || !Object.keys(target).length) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply('⊘ *Could not load the replied message. Reply to the message again and retry.*');
            }

            const targetPayload = messagePayload(target);
            const contextInfo = getContextInfo(targetPayload);
            // Prefer the nested quote when the replied-to message contains one;
            // otherwise return the replied-to message itself instead of failing.
            const message = unwrapMessage(contextInfo?.quotedMessage || targetPayload);
            const type = getMessageType(message);
            const mediaKey = Object.keys(MEDIA_TYPES).find(key => message[key]);
            const text = getMessageText(message);

            if (text && !mediaKey) {
                await sock.sendMessage(m.chat, { text }, { quoted: m });
                await sock.sendMessage(m.chat, { react: { text: '💬', key: m.key } });
                return;
            }

            if (mediaKey) {
                const { downloadContentFromMessage } = require('plogme');
                const mediaMsg = message[mediaKey];
                const stream = await downloadContentFromMessage(mediaMsg, MEDIA_TYPES[mediaKey]);
                const chunks = [];
                for await (const chunk of stream) chunks.push(Buffer.from(chunk));
                const buffer = Buffer.concat(chunks);
                const caption = mediaMsg.caption || '';
                const sendOptions = { quoted: m };

                if (mediaKey === 'imageMessage') {
                    await sock.sendMessage(m.chat, { image: buffer, caption }, sendOptions);
                } else if (mediaKey === 'videoMessage') {
                    await sock.sendMessage(m.chat, { video: buffer, caption, gifPlayback: Boolean(mediaMsg.gifPlayback) }, sendOptions);
                } else if (mediaKey === 'audioMessage') {
                    await sock.sendMessage(m.chat, { audio: buffer, mimetype: mediaMsg.mimetype || 'audio/mp4', ptt: Boolean(mediaMsg.ptt) }, sendOptions);
                } else if (mediaKey === 'documentMessage') {
                    await sock.sendMessage(m.chat, { document: buffer, mimetype: mediaMsg.mimetype || 'application/octet-stream', fileName: mediaMsg.fileName || 'file', caption }, sendOptions);
                } else if (mediaKey === 'stickerMessage') {
                    await sock.sendMessage(m.chat, { sticker: buffer }, sendOptions);
                }

                await sock.sendMessage(m.chat, { react: { text: '💬', key: m.key } });
                return;
            }

            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            return reply(`⊘ *Unsupported message type${type ? `: ${type}` : ''}.*`);
        } catch (error) {
            console.error('[QUOTED ERROR]', error);
            await sock.sendMessage(m.chat, { react: { text: '🙈', key: m.key } });
            return reply(`${prefix}⊘ *Error:* ${error?.message || 'Unknown error'}`);
        }
    },
    findRepliedMessage,
};
