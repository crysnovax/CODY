'use strict';

const CHANNEL_JID_RE = /^[0-9]+@newsletter$/i;
const CHANNEL_LINK_RE = /https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i;
const MEDIA_TYPES = new Set([
    'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage',
    'stickerMessage'
]);

function resolveTarget(args = []) {
    const tokens = args.map(String);
    const targetIndex = tokens.findIndex(token =>
        CHANNEL_JID_RE.test(token.replace(/[),]+$/, '')) || CHANNEL_LINK_RE.test(token)
    );
    if (targetIndex < 0) return null;

    const rawTarget = tokens[targetIndex].replace(/[),]+$/, '');
    const link = rawTarget.match(CHANNEL_LINK_RE);
    const jid = CHANNEL_JID_RE.test(rawTarget) ? rawTarget : null;
    const text = [...tokens.slice(0, targetIndex), ...tokens.slice(targetIndex + 1)].join(' ').trim();
    return { jid, link: link ? rawTarget : null, inviteCode: link?.[1] || null, text };
}

function hasExplicitNonAdminRole(metadata) {
    const viewer = metadata?.viewer_metadata || metadata?.viewerMetadata || {};
    if (viewer.is_admin === false || viewer.is_owner === false) {
        // A false owner flag alone does not imply a non-admin; only is_admin is authoritative.
        if (viewer.is_admin === false) return true;
    }
    const role = [viewer.role, viewer.admin_role, viewer.viewer_role,
        metadata?.viewer_role, metadata?.role]
        .find(value => typeof value === 'string' && value.trim());
    if (!role) return false;
    const normalized = role.toUpperCase();
    if (normalized.includes('ADMIN') || normalized.includes('OWNER')) return false;
    return /FOLLOWER|SUBSCRIBER|MEMBER|USER|VIEWER/.test(normalized);
}

function getQuotedMessageContent(quoted, extraText = '') {
    if (!quoted) return extraText.trim() ? { text: extraText.trim() } : null;
    const type = quoted.mtype || quoted.type || '';
    const message = quoted.msg || quoted.message || {};
    const mediaType = MEDIA_TYPES.has(type) ? type : MEDIA_TYPES.has(Object.keys(message)[0]) ? Object.keys(message)[0] : null;
    const caption = [extraText, quoted.caption, message[type]?.caption, message[mediaType]?.caption]
        .filter(value => typeof value === 'string' && value.trim()).join('\n').trim();

    if (mediaType) {
        return { mediaType, caption, mimetype: quoted.mimetype || message[mediaType]?.mimetype,
            fileName: quoted.fileName || message[mediaType]?.fileName,
            ptt: quoted.ptt ?? message[mediaType]?.ptt,
            gifPlayback: quoted.gifPlayback ?? message[mediaType]?.gifPlayback };
    }

    const text = extraText || quoted.text || quoted.body || message.conversation ||
        message.extendedTextMessage?.text || message.imageMessage?.caption ||
        message.videoMessage?.caption || message.documentMessage?.caption || '';
    return text.trim() ? { text: text.trim() } : null;
}

function isAdminPublishError(error) {
    const message = `${error?.message || ''} ${error?.data?.message || ''}`.toLowerCase();
    return error?.statusCode === 401 || error?.statusCode === 403 ||
        error?.output?.statusCode === 401 || error?.output?.statusCode === 403 ||
        error?.data?.statusCode === 401 || error?.data?.statusCode === 403 ||
        /not.?admin|admin.?only|not authorized|not allowed|forbidden|not permitted|permission denied|not enough permission|401|403/.test(message) ||
        (/newsletter|channel/.test(message) && /admin|permission|privilege/.test(message));
}

module.exports = {
    name: 'tochannel',
    alias: ['channelpost', 'sendchannel'],
    category: 'Tools',
    desc: 'Post text or replied media to a WhatsApp channel (admins only)',
    usage: '.tochannel <channel JID or invite link> <text> (or reply to text/media)',
    reactions: { start: '📣', success: '✅', error: '❌' },
    execute: async (sock, m, { args = [], reply }) => {
        const target = resolveTarget(args);
        if (!target) {
            return reply('⚉ Usage: .tochannel <channel JID or invite link> <text>\nOr reply to a text, image, video, audio, sticker, or document with .tochannel <channel JID or invite link>.');
        }

        try {
            let metadata;
            let jid = target.jid;
            if (target.inviteCode) {
                const info = typeof sock.newsletterGetInviteInfo === 'function'
                    ? await sock.newsletterGetInviteInfo(target.link)
                    : await sock.newsletterMetadata('invite', target.inviteCode);
                jid = info?.id;
                metadata = info;
            } else {
                metadata = await sock.newsletterMetadata('jid', jid);
            }
            if (!jid || !CHANNEL_JID_RE.test(jid)) {
                return reply('✘ Could not resolve that channel. Check the channel link or JID and try again.');
            }
            if (hasExplicitNonAdminRole(metadata)) {
                return reply('✘ You are not an admin in this channel.');
            }

            const content = getQuotedMessageContent(m.quoted, target.text);
            if (!content) {
                return reply('⚉ Include text after the channel JID/link, or reply to a text or media message to post it.');
            }

            let payload = content;
            if (content.mediaType) {
                if (typeof m.quoted?.download !== 'function') {
                    return reply('✘ I could not access the replied media. Reply directly to the original media and try again.');
                }
                const buffer = await m.quoted.download();
                if (!buffer?.length) return reply('✘ Failed to download the replied media.');
                const mediaKey = content.mediaType.replace('Message', '').toLowerCase();
                payload = {
                    [mediaKey]: buffer,
                    ...(content.mimetype ? { mimetype: content.mimetype } : {}),
                    ...(content.fileName ? { fileName: content.fileName } : {}),
                    ...(content.caption && mediaKey !== 'audio' && mediaKey !== 'sticker' ? { caption: content.caption } : {}),
                    ...(mediaKey === 'audio' ? { ptt: Boolean(content.ptt) } : {}),
                    ...(mediaKey === 'video' && content.gifPlayback ? { gifPlayback: true } : {})
                };
            }

            await sock.sendMessage(jid, payload);
            await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
            return reply(`✅ Posted to channel ${jid}.`);
        } catch (error) {
            console.error('[TOCHANNEL ERROR]', error);
            if (isAdminPublishError(error)) {
                return reply('✘ You are not an admin in this channel.');
            }
            return reply(`✘ Could not post to the channel: ${error?.message || 'unknown error'}`);
        }
    },
    helpers: { resolveTarget, hasExplicitNonAdminRole, getQuotedMessageContent, isAdminPublishError }
};
