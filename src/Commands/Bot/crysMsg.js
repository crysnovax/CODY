const { getCommand } = require('../../Plugin/crysCmd')
const { getVar } = require('../../Plugin/configManager');
const chalk = require('chalk');

const cooldowns = new Map();

const handleMessage = async (sock, m, store) => {

    try {

        if (!m || !m.message) return;
        if (m.key?.remoteJid === 'status@broadcast') return;

        /* ⭐ Runtime prefix (READ PER MESSAGE) */
        const prefix = getVar('PREFIX', '.');
        // CMD_REACT — command reactions (was AUTO_REACT). @crysnovax—FIX06-08-26
        const cmdReact = getVar('CMD_REACT', getVar('AUTO_REACT', true));
        const cooldown = getVar('COOLDOWN', 3);

        const config = () => require('../../settings/config');

        const ownerNum = getVar('OWNER_NUMBER', config().owner);

        const isOwner = m.sender?.startsWith(ownerNum) || false;

        const body = m.text || '';

        if (!body.startsWith(prefix)) return;

        const cmdName = body
            .slice(prefix.length)
            .trim()
            .split(/ +/)[0]
            .toLowerCase();

        const args = body.trim().split(/ +/).slice(1);
        const text = args.join(' ');

        const cmd = getCommand(cmdName);

        if (!cmd) return;

        /* Group info */
        let groupMeta, isAdmin, isBotAdmin;

        if (m.isGroup) {
            groupMeta = await sock.groupMetadata(m.chat).catch(() => null);

            const admins = (groupMeta?.participants || [])
                .filter(p => p.admin)
                .map(p => p.id);

            isAdmin = admins.includes(m.sender);
            isBotAdmin = admins.includes(sock.user?.id);
            // bot + owner are the SAME account — if the owner is an admin
            // here, the bot is an admin here too (@crysnovax—FIX09-08-26)
            if (!isBotAdmin && ownerNum) {
                const ownerPhone = String(ownerNum).split('@')[0].replace(/[^0-9]/g, '');
                isBotAdmin = admins.some(a => String(a || '').split('@')[0].replace(/[^0-9]/g, '') === ownerPhone);
            }
        }

        const reply = (text) =>
            sock.sendMessage(m.chat, { text }, { quoted: m });

        /* Permission checks */
        if (!config().status.public && !isOwner) {
            if (cmdReact)
                sock.sendMessage(m.chat, {
                    react: { text: '⚉', key: m.key }
                }).catch(() => {});
            return;
        }

        if (cmd.ownerOnly && !isOwner)
            return reply(config().message.owner);

        if (cmd.groupOnly && !m.isGroup)
            return reply(config().message.group);

        if (cmd.adminOnly && !isAdmin && !isOwner)
            return reply(config().message.admin);

        if (cmd.botAdmin && !isBotAdmin)
            return reply('𓉤 Make me an admin first!');

        /* Cooldown */
        if (!isOwner && cooldown > 0) {

            const key = `${m.sender}:${cmdName}`;
            const now = Date.now();
            const exp = cooldowns.get(key);

            if (exp && now < exp) {
                return reply(`⏳ Wait ${((exp - now) / 1000).toFixed(1)}s`);
            }

            cooldowns.set(key, now + cooldown * 1000);
        }

        /* Reaction Start */
        if (cmdReact) {
            sock.sendMessage(m.chat, {
                react: { text: cmd.reactions?.start || '✨', key: m.key }
            }).catch(() => {});
        }

        console.log(chalk.cyan(`[CMD] .${cmdName} | ${m.sender?.split('@')[0]}`));

        /* Execute Command */
        try {
            await cmd.execute(sock, m, {
                args,
                text,
                prefix,
                isOwner,
                isAdmin,
                isBotAdmin,
                isGroup: m.isGroup,
                groupMeta,
                reply,
                config: config(),
                store,
                getVar
            });

            /* success → remove the reaction again (@crysnovax—FIX06-08-26) */
            if (cmdReact) {
                sock.sendMessage(m.chat, {
                    react: { text: '', key: m.key }
                }).catch(() => {});
            }
        } catch (err) {
            /* failed → keep a failed reaction + report to owner DM */
            console.log(chalk.red('[CMD ERROR]'), err.message);
            if (cmdReact) {
                sock.sendMessage(m.chat, {
                    react: { text: cmd.reactions?.error || '🙈', key: m.key }
                }).catch(() => {});
            }
            try {
                const ownerJid = ownerNum ? `${ownerNum}@s.whatsapp.net` : null;
                if (ownerJid && ownerJid !== m.chat) {
                    sock.sendMessage(ownerJid, {
                        text: `❌ *Command Error*\n\nCommand : ${prefix}${cmdName}\nError   : ${err.message || err}`
                    }).catch(() => {});
                }
            } catch (e) {}
        }

    } catch (err) {

        console.log(chalk.red('[MSG ERROR]'), err.message);

        if (cmdReact) {
            sock.sendMessage(m.chat, {
                react: { text: '🙈', key: m.key }
            }).catch(() => {});
        }
    }
};

module.exports = { handleMessage };
