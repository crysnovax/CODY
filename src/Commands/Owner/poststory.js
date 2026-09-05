const { downloadContentFromMessage } = require('plogme');
const { normalizeJid } = require('../../Plugin/identityUtils');

function contactValues(contacts) {
    if (!contacts) return [];
    return contacts instanceof Map ? [...contacts.values()] : Object.values(contacts);
}

async function buildStatusAudience(sock, store) {
    const audience = new Set();
    const contacts = contactValues(store?.contacts || sock.store?.contacts);
    const mapper = sock?.signalRepository?.lidMapping;

    for (const contact of contacts) {
        const candidates = [contact?.phoneNumber, contact?.id, contact?.jid].filter(Boolean).map(normalizeJid);
        let phoneJid = candidates.find(jid => jid.endsWith('@s.whatsapp.net'));
        if (!phoneJid && mapper?.getPNForLID) {
            const lid = candidates.find(jid => jid.endsWith('@lid'));
            if (lid) phoneJid = normalizeJid(await mapper.getPNForLID(lid).catch(() => null));
        }
        if (phoneJid?.endsWith('@s.whatsapp.net')) audience.add(phoneJid);
    }

    const self = normalizeJid(sock.user?.id || '');
    if (self.endsWith('@s.whatsapp.net') || self.endsWith('@lid')) audience.add(self);
    return [...audience];
}

function unwrapMessage(message = {}) {
    let current = message;
    for (let depth = 0; depth < 8; depth += 1) {
        const wrapper = current.ephemeralMessage || current.viewOnceMessage || current.viewOnceMessageV2 || current.viewOnceMessageV2Extension || current.documentWithCaptionMessage;
        if (!wrapper?.message) break;
        current = wrapper.message;
    }
    return current;
}

async function downloadQuotedMedia(m) {
    const quotedMessage = unwrapMessage(
        m.quoted?.message || m.message?.extendedTextMessage?.contextInfo?.quotedMessage || {}
    );
    const type = ['imageMessage', 'videoMessage', 'audioMessage'].find(key => quotedMessage[key]);
    if (!type) return null;
    const media = quotedMessage[type];
    const stream = await downloadContentFromMessage(media, type.replace('Message', ''));
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return { type: type.replace('Message', ''), media, buffer: Buffer.concat(chunks) };
}

module.exports = {
    name: 'poststory',
    alias: ['story', 'statuspost'],
    category: 'Owner',
    ownerOnly: true,
    desc: 'Post text or replied media to WhatsApp Status',
    execute: async (sock, m, { args, reply, store, prefix }) => {
        try {
            const statusJidList = await buildStatusAudience(sock, store);
            if (!statusJidList.length) return reply('No valid WhatsApp contacts are available for the status audience.');

            const backgroundToken = args.find(value => /^--bg=/i.test(value));
            const backgroundColor = backgroundToken ? backgroundToken.slice(backgroundToken.indexOf('=') + 1).trim() : undefined;
            const text = args.filter(value => !/^--bg=/i.test(value)).join(' ').trim();
            const quoted = await downloadQuotedMedia(m);
            let content;

            if (!quoted) {
                if (!text) return reply('Usage: .poststory <text>, or reply to an image, video, or audio message.');
                content = { status: true, text, ...(backgroundColor ? { backgroundColor } : {}), font: 0, statusJidList };
            } else if (quoted.type === 'audio') {
                content = {
                    status: true,
                    audio: quoted.buffer,
                    mimetype: quoted.media.mimetype || 'audio/ogg; codecs=opus',
                    ptt: Boolean(quoted.media.ptt),
                    statusJidList,
                };
            } else {
                content = {
                    status: true,
                    [quoted.type]: quoted.buffer,
                    ...(text ? { caption: text } : {}),
                    statusJidList,
                };
            }

            if (typeof sock.sendStatus === 'function') {
                await sock.sendStatus(content);
            } else {
                await sock.sendMessage('status@broadcast', content);
            }
            return reply(`${prefix}Status posted successfully to ${statusJidList.length} contact${statusJidList.length === 1 ? '' : 's'}.`);
        } catch (error) {
            console.error('[POSTSTORY ERROR]', error?.stack || error);
            return reply(`${prefix}Failed to post the status: ${error?.message || 'unknown WhatsApp error'}`);
        }
    },
    buildStatusAudience,
    downloadQuotedMedia,
};
