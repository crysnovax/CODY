'use strict';

const { getMessageText, messagePayload, unwrapMessage } = require('../../../library/message-content');

const MEDIA_TYPES = {
    imageMessage: 'image',
    videoMessage: 'video',
    audioMessage: 'audio',
    documentMessage: 'document',
    stickerMessage: 'sticker',
};

module.exports = {
    name: 'deleted',
    alias: ['getdeleted', 'retrieve'],
    desc: 'Recover the last deleted message in this chat',
    category: 'Tools',
    usage: `${prefix}deleted`,
    reactions: { start: '🗑️', success: '💬', error: '🙈' },

    execute: async (sock, m, { reply }) => {
        await sock.sendMessage(m.chat, { react: { text: '🗑️', key: m.key } });

        try {
            const { getLastDeleted } = require('../../../library/quoted.js');
            const data = getLastDeleted(m.chat);

            if (!data?.message?.message) {
                await sock.sendMessage(m.chat, { react: { text: '📡', key: m.key } });
                return reply('⊘ *No deleted message found in this chat.*');
            }

            const rawMsg = unwrapMessage(messagePayload(data.message));
            const mediaKey = Object.keys(MEDIA_TYPES).find(key => rawMsg[key]);
            const text = getMessageText(rawMsg);

            if (text && !mediaKey) {
                await sock.sendMessage(m.chat, { text }, { quoted: m });
                await sock.sendMessage(m.chat, { react: { text: '💬', key: m.key } });
                return;
            }

            if (mediaKey) {
                const { downloadContentFromMessage } = require('plogme');
                const mediaMsg = rawMsg[mediaKey];
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

            await sock.sendMessage(m.chat, { react: { text: '📡', key: m.key } });
            return reply('⊘ *Unsupported message type.*');
        } catch (error) {
            console.error('[DELETED ERROR]', error);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            return reply(`⊘ *Error:* ${error?.message || 'Unknown error'}`);
        }
    }
};
