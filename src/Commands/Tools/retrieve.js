module.exports = {
    name: 'deleted',
    alias: ['getdeleted', 'retrieve'],
    desc: 'Recover the last deleted message in this chat',
    category: 'Tools',
    usage: `.deleted`,
    reactions: { start: '🗑️', success: '💬', error: '🙈' },

    execute: async (sock, m, { reply }) => {
        await sock.sendMessage(m.chat, { react: { text: '🗑️', key: m.key } });

        try {
            const { getLastDeleted } = require('../../../library/quoted.js');
            const { getContentType, downloadContentFromMessage } = require('@crysnovax/baileys');

            const data = getLastDeleted(m.chat);

            if (!data?.message?.message) {
                await sock.sendMessage(m.chat, { react: { text: '📡', key: m.key } });
                return reply('⊘ *No deleted message found in this chat.*');
            }

            const mek = data.message;
            const rawMsg = mek.message;
            const msgType = getContentType(rawMsg);
            const innerMsg = rawMsg[msgType] || {};

            const mediaTypes = {
                imageMessage:    'image',
                videoMessage:    'video',
                audioMessage:    'audio',
                documentMessage: 'document',
                stickerMessage:  'sticker',
            };

            const mediaKey = Object.keys(mediaTypes).find(k => rawMsg[k]);

            // Text message
            const text = rawMsg.conversation ||
                         innerMsg.text ||
                         innerMsg.caption ||
                         innerMsg.conversation || '';

            if (text && !mediaKey) {
                await sock.sendMessage(m.chat, { text }, { quoted: m });
                await sock.sendMessage(m.chat, { react: { text: '💬', key: m.key } });
                return;
            }

            // Media message
            if (mediaKey) {
                const mediaMsg = rawMsg[mediaKey];
                const mediaType = mediaTypes[mediaKey];

                const stream = await downloadContentFromMessage(mediaMsg, mediaType);
                let buffer = Buffer.alloc(0);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                const caption = mediaMsg.caption || '';
                const sendOptions = { quoted: m };

                if (mediaKey === 'imageMessage') {
                    await sock.sendMessage(m.chat, { image: buffer, caption }, sendOptions);
                } else if (mediaKey === 'videoMessage') {
                    await sock.sendMessage(m.chat, { video: buffer, caption, gifPlayback: mediaMsg.gifPlayback || false }, sendOptions);
                } else if (mediaKey === 'audioMessage') {
                    await sock.sendMessage(m.chat, { audio: buffer, mimetype: mediaMsg.mimetype || 'audio/mp4', ptt: mediaMsg.ptt || false }, sendOptions);
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
            reply(`${prefix}⊘ *Error:* ${errormessage}`);
        }
    }
};
