'use strict';

function canTag({ config, getVar, isAdmin, isOwner, isSudo, isDual } = {}) {
    const configuredMode = config?.status?.public ?? getVar?.('PUBLIC_MODE', true);
    const mode = String(configuredMode ?? true).trim().toLowerCase();
    const isPublic = configuredMode === true || mode === 'true' || mode === 'public' || mode === '1';

    if (isPublic) return true;
    return Boolean(isAdmin || isOwner || isSudo || isDual);
}

function quotedText(m) {
    const quoted = m?.quoted;
    if (!quoted) return '';

    const message = quoted.message || quoted.fakeObj?.message || {};
    const candidates = [
        quoted.msg,
        quoted.text,
        quoted.body,
        message.conversation,
        message.extendedTextMessage?.text,
        message.imageMessage?.caption,
        message.videoMessage?.caption,
        quoted.caption
    ];

    const value = candidates.find(candidate => typeof candidate === 'string' && candidate.trim());
    return value ? value.trim() : '';
}

async function participantIds(sock, jid, groupMeta) {
    const metadata = groupMeta || await sock.groupMetadata(jid);
    const ids = [...new Set((metadata?.participants || [])
        .map(participant => {
            const value = participant?.id || participant?.jid || participant?.phoneNumber || participant?.lid;
            if (!value) return '';
            const raw = String(value).trim();
            if (raw.includes('@')) return raw;
            const phone = raw.replace(/\D/g, '');
            return phone ? `${phone}@s.whatsapp.net` : '';
        })
        .filter(Boolean)
    )];

    return { metadata, ids };
}

async function sendGroupTag(sock, m, groupMeta, subject) {
    const { ids } = await participantIds(sock, m.chat, groupMeta);
    return sock.sendMessage(m.chat, {
        text: `@${m.chat}`,
        contextInfo: {
            mentionedJid: ids,
            groupMentions: [{ groupJid: m.chat, groupSubject: subject }]
        }
    }, { quoted: m });
}

module.exports = { canTag, quotedText, participantIds, sendGroupTag };
