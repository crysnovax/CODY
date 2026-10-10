const fs = require('fs');
const path = require('path');
const { resolvePhoneJidWithMetadata } = require('../../Plugin/identityUtils');
const { isModerationEnabled } = require('../../Plugin/moderationControl');

const readGroupConfig = name => {
    try {
        const file = path.join(process.cwd(), 'database', name);
        return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    } catch {
        return {};
    }
};

const status = (config, jid) => config?.[jid]?.enabled ? 'ON' : 'OFF';
const action = (config, jid) => config?.[jid]?.action || 'delete';
const promotionGuardStatus = (config, jid, key) => config?.[jid]?.[key] === true ? 'ON' : 'OFF';

module.exports = {
    name: 'settings',
    alias: ['groupsettings', 'modsettings'],
    desc: 'Show group moderators and moderation settings',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '⚙️', success: '📋' },
    execute: async (sock, m, { reply }) => {
        const metadata = await sock.groupMetadata(m.chat).catch(() => null);
        if (!metadata) return reply('Unable to read group settings right now.');

        const moderatorRecords = (metadata.participants || [])
            .filter(participant => participant.admin === 'admin' || participant.admin === 'superadmin');
        const resolvedModerators = await Promise.all(moderatorRecords.map(async participant => {
            const candidates = [participant.phoneNumber, participant.jid, participant.id, participant.lid].filter(Boolean);
            const jid = await resolvePhoneJidWithMetadata(sock, m.chat, candidates)
                || candidates.find(value => String(value).endsWith('@s.whatsapp.net'))
                || candidates[0] || '';
            const role = participant.admin === 'superadmin' ? 'Owner' : 'Moderator';
            return { jid: String(jid), role };
        }));
        const moderators = resolvedModerators.map(({ jid, role }) => `• @${jid.split('@')[0]} — ${role}`);

        const antiLink = readGroupConfig('antilink.json');
        const antiGm = readGroupConfig('antigm.json');
        const antiBot = readGroupConfig('antibot.json');
        const antiForward = readGroupConfig('antiforward.json');
        const antiGroupStatus = readGroupConfig('antigroupstatus.json');
        const antiVideo = readGroupConfig('antivideo.json');
        const antiAudio = readGroupConfig('antiaudio.json');
        const antiVoice = readGroupConfig('antivoice.json');
        const antiDoc = readGroupConfig('antidoc.json');
        const antiPoll = readGroupConfig('antipoll.json');
        const antiEvent = readGroupConfig('antievent.json');
        const antiNewcomer = readGroupConfig('antinewcomer.json');
        const antiRaid = readGroupConfig('antiraid.json');
        const antiLocation = readGroupConfig('antilocation.json');
        const antiContact = readGroupConfig('anticontact.json');
        const slowmode = readGroupConfig('slowmode.json');
        const modlog = readGroupConfig('modlog.json');
        const noSticker = readGroupConfig('nosticker.json');
        const antiWord = readGroupConfig('antiword.json');
        const antiTag = readGroupConfig('antitag.json');
        const antiSpam = readGroupConfig('antispam.json');
        const antiVV = readGroupConfig('antivv.json');
        const antiBug = readGroupConfig('antibug.json');
        const promotionGuard = readGroupConfig('promotion_guard.json');

        const mentions = resolvedModerators.map(({ jid }) => jid).filter(jid => jid.endsWith('@s.whatsapp.net'));

        return reply(
            `⚙️ *Group Settings*\n\n` +
            `*Moderators (${moderators.length})*\n${moderators.length ? moderators.join('\n') : '• None'}\n\n` +
            `*Anti Features* (master moderation: ${isModerationEnabled(m.chat) ? 'ON' : 'OFF'})\n` +
            `• AntiLink: ${status(antiLink, m.chat)} (${action(antiLink, m.chat)})\n` +
            `• AntiGM: ${status(antiGm, m.chat)} (${action(antiGm, m.chat)})\n` +
            `• AntiBot: ${status(antiBot, m.chat)} (${action(antiBot, m.chat)})\n` +
            `• AntiForward: ${status(antiForward, m.chat)} (${action(antiForward, m.chat)})\n` +
            `• AntiGroupStatus: ${status(antiGroupStatus, m.chat)} (${action(antiGroupStatus, m.chat)})\n` +
            `• AntiWord: ${status(antiWord, m.chat)} (${action(antiWord, m.chat)})\n` +
            `• AntiTag: ${status(antiTag, m.chat)} (${action(antiTag, m.chat)})\n` +
            `• AntiSpam: ${status(antiSpam, m.chat)} (${action(antiSpam, m.chat)})\n` +
            `• AntiVV: ${status(antiVV, m.chat)} (${action(antiVV, m.chat)})\n` +
            `• AntiBug: ${status(antiBug.groups || {}, m.chat)} (${action(antiBug.groups || {}, m.chat)})\n` +
            `• AntiVideo: ${status(antiVideo, m.chat)} (${action(antiVideo, m.chat)})\n` +
            `• AntiAudio: ${status(antiAudio, m.chat)} (${action(antiAudio, m.chat)})\n` +
            `• AntiVoice: ${status(antiVoice, m.chat)} (${action(antiVoice, m.chat)})\n` +
            `• AntiDoc: ${status(antiDoc, m.chat)} (${action(antiDoc, m.chat)})\n` +
            `• AntiPoll: ${status(antiPoll, m.chat)} (${action(antiPoll, m.chat)})\n` +
            `• AntiEvent: ${status(antiEvent, m.chat)} (${action(antiEvent, m.chat)})\n` +
            `• AntiNewcomerLinks: ${status(antiNewcomer, m.chat)} (${Math.round((antiNewcomer?.[m.chat]?.windowMs || 600_000) / 60_000)}m)\n` +
            `• AntiRaid: ${status(antiRaid, m.chat)} (${antiRaid?.[m.chat]?.threshold || 5}/${Math.round((antiRaid?.[m.chat]?.windowMs || 600_000) / 60_000)}m)\n` +
            `• AntiLocation: ${status(antiLocation, m.chat)} (${action(antiLocation, m.chat)})\n` +
            `• AntiContact: ${status(antiContact, m.chat)} (${action(antiContact, m.chat)})\n` +
            `• Slowmode: ${status(slowmode, m.chat)} (${Math.round((slowmode?.[m.chat]?.intervalMs || 10_000) / 1000)}s)\n` +
            `• ModLog: ${status(modlog, m.chat)} (${modlog?.[m.chat]?.retentionDays || 30}d retention)\n` +
            `• NoSticker: ${status(noSticker, m.chat)} (${action(noSticker, m.chat)})\n` +
            `• AntiPromote: ${promotionGuardStatus(promotionGuard, m.chat, 'antipromote')}\n` +
            `• AntiDemote: ${promotionGuardStatus(promotionGuard, m.chat, 'antidemote')}`,
            { mentions }
        );
    }
};

module.exports.status = status;
module.exports.action = action;
module.exports.promotionGuardStatus = promotionGuardStatus;
module.exports.readGroupConfig = readGroupConfig;

module.exports;
