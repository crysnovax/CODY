'use strict';

const { getVar } = require('../../Plugin/configManager');
const { requestPollApproval } = require('../../Plugin/pollApproval');

const UNIT_MS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

function parseDuration(value = '30d') {
    const match = String(value).trim().toLowerCase().match(/^(\d{1,4})(s|m|h|d|w)$/);
    if (!match) return null;
    const amount = Number(match[1]);
    return amount > 0 ? amount * UNIT_MS[match[2]] : null;
}

function normalized(jid = '') { return String(jid).replace(/:\d+(?=@)/, '').toLowerCase(); }
function isAdmin(participant) { return participant?.admin === 'admin' || participant?.admin === 'superadmin'; }
function numberOf(jid = '') { return normalized(jid).split('@')[0].replace(/\D/g, ''); }

function currentAdmin(metadata, identities) {
    const wantedJids = new Set(identities.map(normalized).filter(Boolean));
    const wantedNumbers = new Set(identities.map(numberOf).filter(Boolean));
    return (metadata?.participants || []).some(participant => isAdmin(participant)
        && [participant.id, participant.jid, participant.lid].filter(Boolean).some(id =>
            wantedJids.has(normalized(id)) || wantedNumbers.has(numberOf(id))));
}

function findCandidates(metadata, ageMs, botIds, protectedNumbers, now = Date.now()) {
    return (metadata?.participants || []).filter(participant => {
        if (!participant?.id || isAdmin(participant)) return false;
        const ids = [participant.id, participant.jid, participant.lid].filter(Boolean).map(normalized);
        if (ids.some(id => botIds.includes(id) || protectedNumbers.has(numberOf(id)))) return false;
        const lastSeen = Number(participant.lastSeen || participant.last_seen || 0);
        return Number.isFinite(lastSeen) && lastSeen > 0 && now - lastSeen >= ageMs;
    });
}

const command = {
    name: 'kickinactive',
    alias: ['inactivekick', 'kickidle'],
    desc: 'Remove inactive group members after majority admin poll approval',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    botAdmin: true,
    reactions: { start: '🕒', success: '✅', error: '❌' },
    usage: '.kickinactive <30d>',
    execute: async (sock, m, { args, reply, isAdmin: callerIsAdmin }) => {
        const durationText = args[0] || '30d';
        const ageMs = parseDuration(durationText);
        if (!ageMs || args.length > 1) return reply('Usage: .kickinactive <number><s|m|h|d|w>');
        if (!callerIsAdmin) return reply('Only a current group admin can start this action.');

        const chatId = m?.chat || m?.key?.remoteJid;
        const metadata = await sock.groupMetadata(chatId).catch(() => null);
        if (!metadata?.participants?.length) return reply('Unable to read group membership safely. No changes were made.');

        const initiatorIds = [m?.sender, m?.key?.participant, m?.key?.participantAlt, m?.key?.remoteJidAlt].filter(Boolean);
        if (!currentAdmin(metadata, initiatorIds)) return reply('Your admin role could not be verified. No changes were made.');
        const botIds = [sock.user?.id, sock.user?.lid].filter(Boolean).map(normalized);
        if (!currentAdmin(metadata, botIds)) return reply('I must be a group admin before inactive members can be removed. No changes were made.');
        const ownerNumber = numberOf(process.env.OWNER_NUMBER || getVar('OWNER_NUMBER', ''));
        const protectedNumbers = new Set(
            String(process.env.PROTECTED_NUMBERS || getVar('PROTECTED_NUMBERS', '') || '')
                .split(',').map(numberOf).filter(Boolean)
        );
        if (ownerNumber) protectedNumbers.add(ownerNumber);

        const candidates = findCandidates(metadata, ageMs, botIds, protectedNumbers);

        if (!candidates.length) {
            const hasTimestamps = metadata.participants.some(p => Number(p.lastSeen || p.last_seen || 0) > 0);
            return reply(hasTimestamps ? `No members inactive for ${durationText}.` : 'WhatsApp did not provide reliable last-seen timestamps for this group. No changes were made.');
        }
        if (candidates.length > 10) return reply(`Safety limit: ${candidates.length} candidates exceeds the maximum of 10 per run. Narrow the inactivity threshold and retry.`);

        const preview = candidates.map(p => `@${numberOf(p.id)}`).join(', ');
        const mentions = candidates.map(p => p.id);
        const targetSnapshot = candidates.map(p => normalized(p.id)).sort();
        await reply(`Dry run for inactivity threshold ${durationText}: ${candidates.length} candidate(s): ${preview}\n\nA poll will ask group admins to Continue or Cancel. A strict majority must Continue; any admin may Cancel. The poll expires in 2 minutes.`, { mentions });

        try {
            await requestPollApproval(sock, {
                chatId,
                title: `Approve removing ${candidates.length} inactive member(s) at ${durationText}?`,
                actionLabel: `kickinactive ${durationText} — remove ${candidates.length} inactive member(s)`,
                timeoutMs: 2 * 60 * 1000,
                onApproved: async () => {
                    const current = await sock.groupMetadata(chatId);
                    if (!currentAdmin(current, initiatorIds)) throw new Error('The initiating admin is no longer a group admin.');
                    if (!currentAdmin(current, botIds)) throw new Error('CODY is no longer a group admin.');
                    const latestCandidates = findCandidates(current, ageMs, botIds, protectedNumbers);
                    if (JSON.stringify(latestCandidates.map(p => normalized(p.id)).sort()) !== JSON.stringify(targetSnapshot)) {
                        throw new Error('The inactive-member target list changed after the dry run. No one was removed; rerun kickinactive to review a fresh list.');
                    }
                    if (!latestCandidates.length) throw new Error('No eligible inactive members remain. No changes were made.');
                    if (latestCandidates.length > 10) throw new Error('The current candidate count exceeds the 10-member safety limit. No changes were made.');
                    const targets = latestCandidates.slice(0, 10).map(p => p.id);
                    await sock.groupParticipantsUpdate(chatId, targets, 'remove');
                    return reply(`Removed ${targets.length} inactive member(s) after majority admin poll approval.`, { mentions: targets });
                },
            });
            return reply('Inactive-member approval poll started. No one will be removed unless the Continue quorum is reached.');
        } catch (error) {
            console.error('[KICKINACTIVE POLL]', error?.stack || error);
            return reply(`Could not start the approval poll; no changes were made. ${error.message}`);
        }
    }
};

module.exports = command;
module.exports.parseDuration = parseDuration;
module.exports.isAdmin = isAdmin;
module.exports.numberOf = numberOf;
module.exports.findCandidates = findCandidates;
