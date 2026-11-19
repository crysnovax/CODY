'use strict';

const { helpers } = require('./tochannel');
const { resolveTarget, getQuotedMessageContent, isAdminPublishError } = helpers;

const CHANNEL_JID_RE = /^[0-9]+@newsletter$/i;

module.exports = {
    name: 'chstatus',
    alias: ['channelstatus'],
    category: 'Tools',
    ownerOnly: true,
    desc: 'Publish text or replied image/video as a WhatsApp Channel Status',
    usage: '.chstatus <channel JID or invite link> <text> (or reply to text/image/video)',
    reactions: { start: '📣', success: '✅', error: '❌' },

    execute: async (sock, m, { args = [], reply, prefix = '.' } = {}) => {
        const target = resolveTarget(args);
        if (!target) {
            return reply(`Usage: ${prefix}chstatus <channel JID or invite link> <text>\nOr reply to text, an image, or a video with ${prefix}chstatus <channel JID or invite link>.`);
        }
        if (typeof sock.sendNewsletterStatus !== 'function') {
            return reply('This WhatsApp connection does not support Channel Status publishing.');
        }

        try {
            let jid = target.jid;
            if (target.inviteCode) {
                const info = typeof sock.newsletterGetInviteInfo === 'function'
                    ? await sock.newsletterGetInviteInfo(target.link)
                    : await sock.newsletterMetadata('invite', target.inviteCode);
                jid = info?.id;
            }
            if (!jid || !CHANNEL_JID_RE.test(jid)) {
                return reply('Could not resolve that channel. Check the invite link or newsletter JID and try again.');
            }

            const source = getQuotedMessageContent(m.quoted, target.text);
            if (!source) {
                return reply('Include status text, or reply to a text, image, or video message.');
            }

            let content;
            if (source.mediaType) {
                if (!['imageMessage', 'videoMessage'].includes(source.mediaType)) {
                    return reply('Channel Status supports text, images, and videos only.');
                }
                if (typeof m.quoted?.download !== 'function') {
                    return reply('I could not access the replied media. Reply to the original image/video and try again.');
                }
                const buffer = await m.quoted.download();
                if (!buffer?.length) return reply('Failed to download the replied image/video.');
                const mediaKey = source.mediaType === 'imageMessage' ? 'image' : 'video';
                content = {
                    [mediaKey]: buffer,
                    ...(source.mimetype ? { mimetype: source.mimetype } : {}),
                    ...(source.caption ? { caption: source.caption } : {})
                };
            } else {
                content = { text: source.text };
            }

            await sock.sendNewsletterStatus(jid, content);
            return reply(`Channel Status posted successfully to ${jid}.`);
        } catch (error) {
            console.error('[CHSTATUS ERROR]', error?.stack || error);
            if (isAdminPublishError(error)) {
                return reply('The connected account is not authorized to publish Channel Status in this channel.');
            }
            return reply(`Could not publish Channel Status: ${error?.message || 'unknown error'}`);
        }
    },

    helpers: { resolveTarget, getQuotedMessageContent }
};
