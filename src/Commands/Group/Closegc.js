'use strict';

const { requestPollApproval } = require('../../Plugin/pollApproval');

function normalizeJid(value) {
    return String(value || '').replace(/:\d+@/, '@').trim().toLowerCase();
}

function participantAliases(participant) {
    return [participant?.id, participant?.jid, participant?.lid]
        .map(normalizeJid).filter(Boolean);
}

function isGroupAdmin(metadata, identities) {
    const wanted = new Set(identities.map(normalizeJid).filter(Boolean));
    return (metadata?.participants || []).some(participant =>
        (participant.admin === 'admin' || participant.admin === 'superadmin')
        && participantAliases(participant).some(alias => wanted.has(alias))
    );
}

module.exports = {
    name: 'delgc',
    alias: ['deletegc', 'dgc', 'groupdelete', 'kickall'],
    desc: 'Kick everyone and leave the group after majority admin poll approval',
    category: 'Admin',
    usage: '.kickall',
    groupOnly: true,
    adminOnly: true,
    botAdmin: true,
    reactions: { start: '☠️', success: '🗑️', error: '❌' },

    execute: async (sock, m, { reply, isGroupAdmin: callerIsAdmin }) => {
        const chatId = m?.chat || m?.key?.remoteJid;
        if (!String(chatId || '').endsWith('@g.us')) {
            return reply('_This command can only be used in a group._');
        }
        if (!callerIsAdmin) return reply('_Only a current group admin can start this action._');

        const initiatorIds = [
            m?.sender,
            m?.key?.participant,
            m?.key?.participantAlt,
            m?.key?.remoteJidAlt,
        ].filter(Boolean);
        const botIds = [sock.user?.id, sock.user?.lid, sock.user?.jid].filter(Boolean);
        const initialMetadata = await sock.groupMetadata(chatId).catch(() => null);
        if (!initialMetadata) return reply('_Could not read group members; no changes were made._');
        if (!isGroupAdmin(initialMetadata, initiatorIds)) return reply('_Your admin role could not be verified; no changes were made._');
        if (!isGroupAdmin(initialMetadata, botIds)) return reply('_CODY must be a group admin before this action can be approved._');

        await reply('⚠️ *DANGEROUS ACTION:* this will remove every other member and make CODY leave the group. A strict majority of current group admins must vote *Continue*. Any admin may vote *Cancel*. The poll expires in 2 minutes.');

        try {
            await requestPollApproval(sock, {
                chatId,
                title: 'Kick everyone and have CODY leave this group?',
                actionLabel: 'kickall — remove all members and leave the group',
                timeoutMs: 2 * 60 * 1000,
                onApproved: async () => {
                    const current = await sock.groupMetadata(chatId);
                    if (!isGroupAdmin(current, initiatorIds)) throw new Error('The initiating admin is no longer a group admin.');
                    if (!isGroupAdmin(current, botIds)) throw new Error('CODY is no longer a group admin.');
                    const botSet = new Set(botIds.map(normalizeJid));
                    const targets = (current.participants || [])
                        .filter(participant => !participantAliases(participant).some(alias => botSet.has(alias)))
                        .map(participant => participant.id || participant.jid || participant.lid)
                        .filter(Boolean);
                    if (!targets.length) throw new Error('No other group members were found.');

                    await sock.sendMessage(chatId, { text: `Admin approval passed. Removing ${targets.length} member(s); CODY will then leave this group.` });
                    for (let index = 0; index < targets.length; index += 10) {
                        await sock.groupParticipantsUpdate(chatId, targets.slice(index, index + 10), 'remove');
                        if (index + 10 < targets.length) await new Promise(resolve => setTimeout(resolve, 300));
                    }
                    await sock.groupLeave(chatId);
                },
            });
            return reply('_Approval poll started. No group changes occur unless the admin Continue quorum is reached._');
        } catch (error) {
            console.error('[KICKALL POLL]', error?.stack || error);
            return reply(`_Could not start the approval poll; no changes were made._ ${error.message}`);
        }
    },
};

module.exports.isGroupAdmin = isGroupAdmin;
