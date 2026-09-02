'use strict';

const { getVar } = require('../../Plugin/configManager');

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

const command = {
    name: 'kickinactive',
    alias: ['inactivekick', 'kickidle'],
    desc: 'Safely remove inactive group members after an explicit dry-run confirmation',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🕒', success: '✅', error: '❌' },
    usage: '.kickinactive <30d> [confirm]',
    execute: async (sock, m, { args, reply, isOwner }) => {
        const durationText = args[0] || '30d';
        const ageMs = parseDuration(durationText);
        if (!ageMs) return reply('Usage: .kickinactive <number><s|m|h|d|w> [confirm]');

        const metadata = await sock.groupMetadata(m.chat).catch(() => null);
        if (!metadata?.participants?.length) return reply('Unable to read group membership safely. No changes were made.');

        const botIds = [sock.user?.id, sock.user?.lid].filter(Boolean).map(normalized);
        const ownerNumber = numberOf(process.env.OWNER_NUMBER || getVar('OWNER_NUMBER', ''));
        const protectedNumbers = new Set(
            String(process.env.PROTECTED_NUMBERS || getVar('PROTECTED_NUMBERS', '') || '')
                .split(',').map(numberOf).filter(Boolean)
        );
        if (ownerNumber) protectedNumbers.add(ownerNumber);

        const bot = metadata.participants.find(p => [p.id, p.jid, p.lid].filter(Boolean).some(id => botIds.includes(normalized(id))));
        if (!isAdmin(bot)) return reply('I must be a group admin before inactive members can be removed. No changes were made.');

        const now = Date.now();
        const candidates = metadata.participants.filter(participant => {
            if (!participant?.id || isAdmin(participant)) return false;
            const ids = [participant.id, participant.jid, participant.lid].filter(Boolean).map(normalized);
            if (ids.some(id => botIds.includes(id) || protectedNumbers.has(numberOf(id)))) return false;
            const lastSeen = Number(participant.lastSeen || participant.last_seen || 0);
            return Number.isFinite(lastSeen) && lastSeen > 0 && now - lastSeen >= ageMs;
        });

        if (!candidates.length) {
            const hasTimestamps = metadata.participants.some(p => Number(p.lastSeen || p.last_seen || 0) > 0);
            return reply(hasTimestamps ? `No members inactive for ${durationText}.` : 'WhatsApp did not provide reliable last-seen timestamps for this group. No changes were made.');
        }
        if (candidates.length > 10 && args[1]?.toLowerCase() === 'confirm') return reply(`Safety limit: ${candidates.length} candidates exceeds the maximum of 10 per run. Narrow the duration and retry.`);

        const preview = candidates.slice(0, 10).map(p => `@${numberOf(p.id)}`).join(', ');
        if (args[1]?.toLowerCase() !== 'confirm') {
            return reply(`Dry run for inactivity threshold ${durationText}: ${candidates.length} candidate(s): ${preview}\n\nReply with .kickinactive ${durationText} confirm to remove at most 10 non-admin, non-protected members.` , { mentions: candidates.slice(0, 10).map(p => p.id) });
        }

        const targets = candidates.slice(0, 10).map(p => p.id);
        await sock.groupParticipantsUpdate(m.chat, targets, 'remove');
        return reply(`Removed ${targets.length} inactive member(s) after confirmation.`, { mentions: targets });
    }
};

module.exports = command;
module.exports.parseDuration = parseDuration;
module.exports.isAdmin = isAdmin;
module.exports.numberOf = numberOf;
