'use strict';

const gstatus = require('./⤷.js');

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
    alias: ['gstatusdm'],
    desc: 'Post a group status from a private chat',
    category: 'Group',
    groupOnly: false,
    usage: '.gsdm <group link|group JID> <text or quoted media>',
    execute: async (sock, m, { args = [], text = '', reply }) => {
        const targetInput = args[0];
        if (!targetInput) {
            return reply('`✘ Usage: .gsdm <group link|group JID> <text or quoted media>`');
        }

        try {
            const targetJid = await resolveGroupTarget(sock, targetInput);
            if (!targetJid) return reply('`✘ Provide a valid WhatsApp group link or group JID`');
            if (typeof sock.groupMetadata === 'function') await sock.groupMetadata(targetJid);

            const contentArgs = args.slice(1);
            const contentText = contentArgs.join(' ').trim();
            const originalChat = m.chat;
            const originalKey = m.key;
            const statusMessageApi = new Proxy(sock, {
                get(target, property) {
                    if (property !== 'sendMessage') return target[property];
                    return (chat, content, options) => {
                        // Keep command reactions in the DM; the actual status is
                        // still relayed to the resolved group by gstatus.
                        if (content?.react) return target.sendMessage(originalChat, content, { ...options, quoted: m });
                        return target.sendMessage(chat, content, options);
                    };
                }
            });
            const statusMessage = {
                ...m,
                chat: targetJid,
                key: { ...originalKey, remoteJid: targetJid }
            };
            const statusReply = message => reply(message);
            return gstatus.execute(statusMessageApi, statusMessage, {
                text: contentText,
                args: contentArgs,
                command: 'gstatus',
                reply: statusReply
            });
        } catch (error) {
            console.error('[GSDM ERROR]', error);
            return reply(`\`✘ ${error.message || 'Unable to post group status'}\``);
        }
    }
};

module.exports.resolveGroupTarget = resolveGroupTarget;
module.exports.extractInviteCode = extractInviteCode;
