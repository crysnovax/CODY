const fs = require('fs');
const path = require('path');
const { normalizeJid, resolvePhoneJid } = require('./identityUtils');
const { stripBotMarkerDeep } = require('./antiText');

function readJson(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return {}; }
}

function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function sameUser(first = '', second = '') {
    return normalizeJid(first) === normalizeJid(second);
}

function participantJids(participant) {
    return [participant?.id, participant?.jid, participant?.lid, participant?.phoneNumber]
        .filter(Boolean)
        .map(normalizeJid);
}

function createAntiMessageModeration({
    command, label, description, databaseName, warningDatabaseName,
    detector, violationLabel, aliases = [], deleteMessage
}) {
    const dbPath = path.join(process.cwd(), 'database', databaseName);
    const warningDbPath = path.join(process.cwd(), 'database', warningDatabaseName);

    function ensureConfig(db, group) {
        if (!db[group]) db[group] = { enabled: false, action: 'delete' };
        if (typeof db[group].enabled !== 'boolean') db[group].enabled = false;
        if (!['delete', 'warn', 'kick'].includes(db[group].action)) db[group].action = 'delete';
        return db[group];
    }

    const plugin = {
        name: command,
        alias: aliases,
        desc: description,
        category: 'Admin',
        groupOnly: true,
        adminOnly: true,
        reactions: { start: '🐾', success: '😡' },
        execute: async (sock, m, { args, reply }) => {
            const db = readJson(dbPath);
            const config = ensureConfig(db, m.chat);
            const subcommand = args[0]?.toLowerCase();

            if (!subcommand || subcommand === 'status') {
                const action = config.action === 'warn' ? 'WARN (3x → KICK)' : config.action.toUpperCase();
                return reply(`*${label} Settings*\n\n• Status : ${config.enabled ? 'ON' : 'OFF'}\n• Action : ${action}\n\nCommands:\n• .${command} on / off\n• .${command} delete / warn / kick\n• .${command} resetwarn @user`);
            }
            if (subcommand === 'on' || subcommand === 'off') {
                config.enabled = subcommand === 'on';
                writeJson(dbPath, db);
                return reply(`*${label}* ${config.enabled ? 'enabled' : 'disabled'}.`);
            }
            if (['delete', 'warn', 'kick'].includes(subcommand)) {
                config.action = subcommand;
                writeJson(dbPath, db);
                const detail = subcommand === 'warn' ? '3 warnings = automatic kick' : `${subcommand} violating messages`;
                return reply(`*${label} action:* ${subcommand.toUpperCase()} (${detail}).`);
            }
            if (subcommand === 'resetwarn') {
                const target = await resolvePhoneJid(sock, [m.mentionedJid?.[0], m.quoted?.sender, m.msg?.contextInfo?.participantAlt]);
                if (!target) return reply(`Usage: .${command} resetwarn @user or reply to the user`);
                const warnings = readJson(warningDbPath);
                const warningKey = `${m.chat}_${normalizeJid(target)}`;
                if (!warnings[warningKey]) return reply('User has no warnings.');
                delete warnings[warningKey];
                writeJson(warningDbPath, warnings);
                return reply(`Warnings reset for @${target.split('@')[0]}`, { mentions: [target] });
            }
            return reply(`Usage: .${command} on | off | delete | warn | kick | resetwarn @user`);
        }
    };

    plugin.handleModeration = async function handleModeration(sock, m, mek) {
        try {
            const detectionPayload = {
                raw: stripBotMarkerDeep(mek?.__rawMessage || mek?.message || {}),
                message: stripBotMarkerDeep(m.message || {}),
                msg: stripBotMarkerDeep(m.msg || {}),
                serialized: stripBotMarkerDeep(m)
            };
            if (!m.isGroup || m.key?.fromMe || !detector(detectionPayload)) return false;
            const config = readJson(dbPath)[m.chat];
            if (!config?.enabled) return false;

            const metadata = await sock.groupMetadata(m.chat).catch(() => null);
            if (!metadata?.participants) return false;

            const senderCandidates = [m.key?.participantAlt, mek?.key?.participantAlt, m.sender, m.key?.participant];
            const senderJid = await resolvePhoneJid(sock, senderCandidates);
            const senderIdentity = normalizeJid(m.sender || m.key?.participant || senderJid || '');
            if (!senderJid || !senderIdentity) return false;

            const senderRecord = metadata.participants.find(participant =>
                participantJids(participant).some(jid => senderCandidates.some(candidate => sameUser(jid, candidate)))
            );
            if (senderRecord?.admin === 'admin' || senderRecord?.admin === 'superadmin') return false;

            const botCandidates = [sock.user?.id, sock.user?.lid].filter(Boolean);
            const botRecord = metadata.participants.find(participant =>
                participantJids(participant).some(jid => botCandidates.some(bot => sameUser(jid, bot)))
            );
            const botIsAdmin = botRecord?.admin === 'admin' || botRecord?.admin === 'superadmin';
            if (!botIsAdmin) {
                await sock.sendMessage(m.chat, { text: `${label} cannot remove this content because the bot is not a group admin.` }, { quoted: mek }).catch(() => {});
                return false;
            }

            const removalContext = {
                metadata,
                senderCandidates,
                senderJid,
                senderIdentity,
                senderRecord,
            };
            const removeMessage = deleteMessage
                ? () => deleteMessage(sock, m, mek, removalContext)
                : () => sock.sendMessage(m.chat, { delete: mek?.key || m.key });
            try {
                await removeMessage();
            } catch (error) {
                await sock.sendMessage(m.chat, { text: `${label} detected prohibited content, but WhatsApp rejected the delete request. The bot is already recognized as an admin; check the server log for the protocol error.` }, { quoted: mek }).catch(() => {});
                console.error(`[${command.toUpperCase()} DELETE ERROR]`, error?.stack || error?.message || error);
                return false;
            }

            const action = ['delete', 'warn', 'kick'].includes(config.action) ? config.action : 'delete';
            const mention = `@${senderJid.split('@')[0]}`;
            const sendNotice = text => sock.sendMessage(m.chat, { text, mentions: [senderJid] }, { quoted: mek }).catch(() => {});

            if (action === 'delete') {
                await sendNotice(`${mention} ${violationLabel} are not allowed here. The content was deleted.`);
                return true;
            }
            if (action === 'kick') {
                await sendNotice(`${mention} was removed for ${violationLabel}.`);
                await sock.groupParticipantsUpdate(m.chat, [senderJid], 'remove');
                return true;
            }

            const warnings = readJson(warningDbPath);
            const warningKey = `${m.chat}_${normalizeJid(senderJid)}`;
            const count = (warnings[warningKey]?.count || 0) + 1;
            if (count >= 3) {
                delete warnings[warningKey];
                writeJson(warningDbPath, warnings);
                await sendNotice(`${mention} was removed after 3/3 warnings for ${violationLabel}.`);
                await sock.groupParticipantsUpdate(m.chat, [senderJid], 'remove');
            } else {
                warnings[warningKey] = { count, user: normalizeJid(senderJid) };
                writeJson(warningDbPath, warnings);
                await sendNotice(`${mention} warning ${count}/3: ${violationLabel} are not allowed.`);
            }
            return true;
        } catch (error) {
            console.error(`[${command.toUpperCase()} ERROR]`, error.message);
            return false;
        }
    };

    return plugin;
}

module.exports = { createAntiMessageModeration, normalizeJid };
