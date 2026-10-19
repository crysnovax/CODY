'use strict';

const { canRunBroadcast, broadcastAccessMessage } = require('../../Plugin/broadcastAccess');
const { sendNativeGroupStatus } = require('../../Utils/groupStatus');

function extractInviteCode(value = '') {
    const match = String(value).trim().match(/(?:chat\.whatsapp\.com|wa\.me)\/([A-Za-z0-9_-]+)/i);
    return match?.[1] || null;
}

async function resolveGroupTarget(sock, value) {
    const target = String(value || '').trim();
    if (/^\d{8,20}@g\.us$/i.test(target)) return target;

    const inviteCode = extractInviteCode(target);
    if (!inviteCode) return null;
    if (typeof sock.groupGetInviteInfo !== 'function') {
        throw new Error('This Baileys runtime cannot resolve group invite links');
    }
    const info = await sock.groupGetInviteInfo(inviteCode);
    const jid = info?.id || info?.jid;
    return /^\d{8,20}@g\.us$/i.test(String(jid || '')) ? jid : null;
}

module.exports = {
    name: 'gsdm',
    alias: ['gsd', 'gstatusdm'],
    desc: 'Send a native group status from a private chat or group command',
    category: 'Group',
    groupOnly: false,
    usage: '.gsd <group link|group JID> <image URL and caption> (or reply to media/text)',
    execute: async (sock, m, { args = [], reply, isOwner, isDual, isAdmin, isGroupAdmin }) => {
        if (!canRunBroadcast(m, { isOwner, isDual, isAdmin, isGroupAdmin })) {
            return reply(broadcastAccessMessage(m));
        }

        const targetInput = args[0];
        if (!targetInput) {
            return reply('Usage: .gsd <group link|group JID> <image URL and caption> (or reply to media/text)');
        }

        try {
            const targetJid = await resolveGroupTarget(sock, targetInput);
            if (!targetJid) return reply('Provide a valid WhatsApp group link or group JID.');
            if (typeof sock.groupMetadata === 'function') await sock.groupMetadata(targetJid);

            const contentText = args.slice(1).join(' ').trim();
            const source = m.quoted || contentText;
            const caption = m.quoted ? contentText : '';
            await sendNativeGroupStatus(sock, targetJid, source, caption);
            return reply(`Native group status sent to ${targetJid}.`);
        } catch (error) {
            console.error('[GSDM ERROR]', error?.stack || error?.message || error);
            return reply(`${error?.message || 'Unable to post group status'}`);
        }
    }
};

module.exports.resolveGroupTarget = resolveGroupTarget;
module.exports.extractInviteCode = extractInviteCode;
