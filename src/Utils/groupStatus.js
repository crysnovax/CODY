'use strict';

const { downloadContentFromMessage } = require('plogme');

const PRIVATE_AUDIENCE = Object.freeze({ name: 'Cody AI', emoji: '🔥' });
const MEDIA_TYPES = {
    imageMessage: 'image',
    videoMessage: 'video',
    audioMessage: 'audio',
    documentMessage: 'document',
    stickerMessage: 'sticker'
};

function unwrapMessage(message) {
    let current = message || {};
    for (let i = 0; i < 6; i++) {
        const wrapped = current.ephemeralMessage?.message ||
            current.viewOnceMessage?.message ||
            current.viewOnceMessageV2?.message ||
            current.viewOnceMessageV2Extension?.message ||
            current.documentWithCaptionMessage?.message ||
            current.groupStatusMessageV2?.message;
        if (!wrapped) break;
        current = wrapped;
    }
    return current;
}

function payloadFromText(value) {
    const input = String(value || '').trim();
    if (!input) return null;

    const splitAt = input.search(/\s/);
    const url = splitAt === -1 ? input : input.slice(0, splitAt);
    if (/^https?:\/\//i.test(url)) {
        return {
            image: { url },
            caption: splitAt === -1 ? '' : input.slice(splitAt).trim()
        };
    }
    return { text: input };
}

async function readMedia(source, mediaMessage, type) {
    if (typeof source?.download === 'function') {
        return source.download();
    }

    const stream = await downloadContentFromMessage(mediaMessage, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

async function createGroupStatusPayload(source, textOverride = '') {
    const override = String(textOverride || '').trim();

    if (typeof source === 'string') {
        const payload = payloadFromText(source);
        if (!payload) {
            if (override) return payloadFromText(override);
            throw new Error('Provide an image URL, text, or reply to a message.');
        }
        if (override) {
            if (payload.image) payload.caption = override;
            else payload.text = override;
        }
        return { ...payload, private: { ...PRIVATE_AUDIENCE } };
    }

    if (!source) {
        const payload = payloadFromText(override);
        if (!payload) throw new Error('Provide an image URL, text, or reply to a message.');
        return { ...payload, private: { ...PRIVATE_AUDIENCE } };
    }

    const raw = source.fakeObj || source;
    const rawMessage = raw.message?.message || raw.message || raw;
    const message = unwrapMessage(rawMessage);
    const mediaKey = Object.keys(MEDIA_TYPES).find(key => message?.[key]);

    if (mediaKey) {
        const mediaMessage = message[mediaKey];
        const media = await readMedia(source, mediaMessage, MEDIA_TYPES[mediaKey]);
        let payload;

        if (mediaKey === 'imageMessage') {
            payload = { image: media, caption: override || mediaMessage.caption || source.caption || '' };
        } else if (mediaKey === 'videoMessage') {
            payload = {
                video: media,
                caption: override || mediaMessage.caption || source.caption || '',
                gifPlayback: Boolean(mediaMessage.gifPlayback)
            };
        } else if (mediaKey === 'audioMessage') {
            payload = {
                audio: media,
                mimetype: mediaMessage.mimetype || 'audio/mp4',
                ptt: Boolean(mediaMessage.ptt)
            };
        } else if (mediaKey === 'documentMessage') {
            payload = {
                document: media,
                mimetype: mediaMessage.mimetype || 'application/octet-stream',
                fileName: mediaMessage.fileName || 'document',
                caption: override || mediaMessage.caption || source.caption || ''
            };
        } else {
            payload = { sticker: media };
        }

        return { ...payload, private: { ...PRIVATE_AUDIENCE } };
    }

    const messageText = message.conversation ||
        message.extendedTextMessage?.text ||
        source.text ||
        source.caption ||
        '';
    const payload = payloadFromText(override || messageText);
    if (!payload) throw new Error('The quoted message has no supported text or media content.');
    return { ...payload, private: { ...PRIVATE_AUDIENCE } };
}

async function sendNativeGroupStatus(sock, jid, source, textOverride = '') {
    if (typeof sock?.sendGroupStatus !== 'function') {
        throw new Error('sendGroupStatus is unavailable; CODY requires plogme 2.2.0 or newer.');
    }
    const payload = await createGroupStatusPayload(source, textOverride);
    return sock.sendGroupStatus(jid, payload);
}

module.exports = { createGroupStatusPayload, sendNativeGroupStatus };
