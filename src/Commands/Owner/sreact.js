'use strict';

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

async function sendStickerReaction(sock, jid, parentMessageKey) {
    if (!parentMessageKey?.id || typeof sock?.relayMessage !== 'function') return false;

    await sock.relayMessage(jid, {
        messageContextInfo: {
            messageAssociation: {
                associationType: 11,
                parentMessageKey
            }
        },
        stickerMessage: { ...DEFAULT_STICKER_MESSAGE }
    }, {});
    return true;
}

module.exports = {
    name: 'sreact',
    alias: ['stickerreact'],
    category: 'Owner',
    privilegedOnly: true,
    desc: 'Send the default sticker reaction to a replied-to message',
    usage: '.sreact (reply to a message)',
    execute: async (sock, m, { args = [], reply }) => {
        if (args.length) {
            return reply('Usage: reply to a message and use .sreact to send the default sticker reaction.');
        }
        const targetKey = m.quoted?.key;
        if (!targetKey?.id) {
            return reply('Reply to the message you want to react to, then send .sreact.');
        }
        const sent = await sendStickerReaction(sock, m.chat, targetKey);
        if (!sent) return reply('Could not send the sticker reaction in this chat.');
    },
    DEFAULT_STICKER_MESSAGE,
    sendStickerReaction
};
