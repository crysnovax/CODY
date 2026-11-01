const toPlainValue = (value, seen = new WeakSet()) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'bigint') return value.toString();
    if (Buffer.isBuffer(value)) return value.toString('base64');
    if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
    if (typeof value !== 'object') return value;
    if (typeof value.toString === 'function' && value.constructor?.name === 'Long') {
        return value.toString();
    }
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    if (Array.isArray(value)) return value.map(item => toPlainValue(item, seen));
    return Object.fromEntries(
        Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .map(([key, item]) => [key, toPlainValue(item, seen)])
    );
};

const getStickerPayload = (quoted) => {
    if (!quoted || quoted.mtype !== 'stickerMessage') return null;
    const media = quoted.message?.stickerMessage || quoted.stickerMessage || quoted;
    return toPlainValue(media);
};

module.exports = {
    name: 'metadata',
    alias: ['stickerinfo', 'sticker-meta'],
    desc: 'Show current sticker/Lottie media fields for a sticker reaction',
    category: 'Tools',
    usage: `${prefix}metadata (reply to a sticker or Lottie)`,
    execute: async (sock, m, { reply }) => {
        const media = getStickerPayload(m.quoted);
        if (!media) {
            return reply(`Reply to a sticker or Lottie with ${prefix}metadata.`);
        }

        const payload = {
            jid: m.chat,
            parentMessageKey: m.quoted.key,
            stickerMessage: media
        };
        const relayCode = `await sock.relayMessage(${JSON.stringify(m.chat)}, ${JSON.stringify({
            messageContextInfo: {
                messageAssociation: {
                    associationType: 11,
                    parentMessageKey: m.quoted.key
                }
            },
            stickerMessage: media
        }, null, 2)}, {})`;

        return reply([
            '*Sticker/Lottie metadata*',
            `mimetype: ${media.mimetype || 'unknown'}`,
            `isLottie: ${Boolean(media.isLottie)}`,
            '',
            '```json',
            JSON.stringify(payload, null, 2),
            '```',
            '',
            '*Ready for eval:*',
            '```js',
            relayCode,
            '```'
        ].join('\n'));
    }
};
