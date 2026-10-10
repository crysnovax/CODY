const fs = require('fs');
const path = require('path');

const WARN_DB_PATH = path.join(process.cwd(), 'database', 'user_warns.json');

function loadWarns() {
    try { if (fs.existsSync(WARN_DB_PATH)) return JSON.parse(fs.readFileSync(WARN_DB_PATH, 'utf8')); } catch {}
    return {};
}

function saveWarns(data) {
    fs.mkdirSync(path.dirname(WARN_DB_PATH), { recursive: true });
    fs.writeFileSync(WARN_DB_PATH, JSON.stringify(data, null, 2));
}

function getTarget(m) {
    const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentioned.length) {
        return {
            num: mentioned[0].split('@')[0].replace(/[^0-9]/g, ''),
            jid: mentioned[0]
        };
    }
    const quoted = m.quoted;
    if (quoted) {
        const raw = (quoted.sender || quoted.participant || '');
        const jid = raw.replace(/:\d+@/, '@');
        return {
            num: jid.split('@')[0].replace(/[^0-9]/g, ''),
            jid: jid.includes('@') ? jid : jid + '@s.whatsapp.net'
        };
    }
    return null;
}

module.exports = [
    {
        name: 'warn',
        alias: ['warning', 'warnuser'],
        category: 'Admin',
        desc: 'Warn a user (3 warns = kick)',
        usage: '.warn @user <reason>',
        groupOnly: true,
        adminOnly: true,

        execute: async (sock, m, { args, reply }) => {
            if (!m.isGroup) return reply('⚉ Group only');

            const target = getTarget(m);
            if (!target) return reply('`✘ Tag or reply to a user`');

            const reason = args.join(' ').trim() || 'No reason';
            const group = m.chat;

            // When /warn is sent as a reply, remove the offending message first.
            // A tag-only warning has no target message to delete.
            if (m.quoted?.key) {
                await sock.sendMessage(group, { delete: m.quoted.key }).catch(() => {});
            }
            const targetNum = target.num;
            const targetJid = target.jid;

            const warns = loadWarns();
            const key = `${group}_${targetNum}`;

            if (!warns[key]) warns[key] = { count: 0, reasons: [], user: targetNum };
            warns[key].count++;
            warns[key].reasons.push({ reason, time: Date.now() });
            saveWarns(warns);

            const warnCount = warns[key].count;
            const remaining = 3 - warnCount;

            if (warnCount >= 3) {
                delete warns[key];
                saveWarns(warns);

                await sock.sendMessage(group, {
                    text: `ಠ_ಠ @${targetNum} *KICKED*\n3/3 warnings reached.\n\n📝 Reason: ${reason}`,
                    mentions: [targetJid]
                }).catch(() => {});

                await sock.groupParticipantsUpdate(group, [targetJid], 'remove').catch(() => {});
                try { require('../../Plugin/modLog').recordAction(group, { command: 'warn', actor: m.sender, target: targetJid, action: 'warn→kick' }); } catch {}
            } else {
                await sock.sendMessage(group, {
                    text: `⚠︎ @${targetNum} *Warning ${warnCount}/3*\n${remaining} more = kick!\n\n📝 ${reason}`,
                    mentions: [targetJid]
                }).catch(() => {});
                try { require('../../Plugin/modLog').recordAction(group, { command: 'warn', actor: m.sender, target: targetJid, action: 'warn' }); } catch {}
            }
        }
    },
    {
        name: 'resetwarn',
        alias: ['clearwarn', 'rwarn', 'unwarn'],
        category: 'Admin',
        desc: 'Reset warnings for a user',
        usage: '.resetwarn @user',
        groupOnly: true,
        adminOnly: true,

        execute: async (sock, m, { reply }) => {
            if (!m.isGroup) return reply('⚉ Group only');

            const target = getTarget(m);
            if (!target) return reply('`✘ Tag or reply to a user`');

            const group = m.chat;
            const targetNum = target.num;

            const warns = loadWarns();
            const key = `${group}_${targetNum}`;

            if (!warns[key]) return reply('`✘ User has no warnings`');

            delete warns[key];
            saveWarns(warns);

            await sock.sendMessage(group, {
                text: `✓ Warnings reset for @${targetNum}`,
                mentions: [target.jid]
            }).catch(() => {});
        }
    },
    {
        name: 'warns',
        alias: ['warnings'],
        category: 'Admin',
        desc: 'Review manual warnings for a group member',
        usage: '.warns @user',
        groupOnly: true,
        adminOnly: true,
        execute: async (sock, m, { reply }) => {
            if (!m.isGroup) return reply('⚉ Group only');
            const target = getTarget(m);
            if (!target) return reply('Usage: .warns @user (or reply to the user)');
            const record = loadWarns()[`${m.chat}_${target.num}`];
            if (!record?.count) return reply(`@${target.num} has no active manual warnings.`, { mentions: [target.jid] });
            const reasons = (record.reasons || []).slice(-5).map(item => {
                const timestamp = item.time ? new Date(item.time).toLocaleString('en-GB') : 'unknown time';
                return `• ${timestamp}: ${String(item.reason || 'No reason').slice(0, 160)}`;
            });
            return reply(`*Warnings for @${target.num}*\n• Active count: ${record.count}/3\n${reasons.join('\n') || '• No reason history available.'}`, { mentions: [target.jid] });
        }
    }
];
