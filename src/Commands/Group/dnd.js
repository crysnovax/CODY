// dnd.js — Do Not Disturb. When on, any message that tags the bot in a group
// gets deleted and the bot replies with a custom (or default) message.
// @crysnovax—FIX06-08-26
const { getVar, setVar } = require('../../Plugin/configManager');

const DEFAULT_DND_MSG = '_*Do Not Disturb*_ — I am busy right now, please don\'t tag me. 🙏';

module.exports = {
    name: 'dnd',
    alias: ['donotdisturb'],
    desc: 'Do Not Disturb — auto-deletes messages that tag the bot in groups',
    category: 'Group',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🔕', success: '🤫' },

    execute: async (sock, m, { args, reply }) => {
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'off' || sub === 'false' || sub === '0') {
            setVar('DND', false);
            return reply('_✘ DND off_');
        }
        if (sub === 'on' || sub === 'true' || sub === '1') {
            setVar('DND', DEFAULT_DND_MSG);
            return reply('_✓ DND on — tags get deleted and the default message is sent_');
        }
        if (sub) {
            const custom = args.join(' ').trim();
            setVar('DND', custom);
            return reply(`_✓ DND message set:_\n${custom}`);
        }

        const current = getVar('DND', false);
        if (current) {
            return reply(`_DND is ON ✓_\nMessage: ${current}\n\n.dnd off → disable`);
        }
        return reply('_DND is OFF ✘_\n\n.dnd on → enable (default message)\n.dnd <message> → enable with a custom message\n.dnd off → disable');
    }
};

module.exports.handleDndTag = async (sock, m) => {
    try {
        if (!m.isGroup || m.key?.fromMe) return;
        if (m.__privilegedMentionSuppressed) return;

        const dnd = getVar('DND', false);
        if (!dnd) return;

        if (!m.mentionedJid?.length) return;

        // 1) bot itself tagged — compare ALL identity variants (phone JID and
        //    LID) so a tag by lid still triggers DND (@crysnovax—FIX08-07-26)
        let botTagged = false;
        try {
            const { identityVariants } = require('../../Plugin/identityUtils');
            const variants = new Set();
            for (const jid of [sock.user?.id, sock.user?.lid].filter(Boolean)) {
                variants.add(String(jid).toLowerCase());
                for (const v of await identityVariants(sock, String(jid))) variants.add(v.toLowerCase());
            }
            botTagged = m.mentionedJid.some(j =>
                [...variants].some(v =>
                    String(j).replace(/:\d+@/, '@').toLowerCase() === v.replace(/:\d+@/, '@').toLowerCase()
                )
            );
        } catch {
            const botJid = (sock.user?.id || '').replace(/:\d+@/, '@');
            botTagged = m.mentionedJid.some(j => j.replace(/:\d+@/, '@') === botJid);
        }

        // 2) owner / sudo / dual tagged — same privileged-identity logic as the
        //    mention handler (.mention -react / -text) — @crysnovax—FIX08-07-26
        let privilegedTagged = false;
        try {
            const mention = require('../Owner/mention.js');
            if (mention?.isPrivilegedMentioned) {
                privilegedTagged = await mention.isPrivilegedMentioned(sock, m);
            }
        } catch {}

        if (!botTagged && !privilegedTagged) return;

        // delete the tag message (needs bot admin; best effort)
        await sock.sendMessage(m.chat, { delete: m.key }).catch(() => {});

        const msg = typeof dnd === 'string' && dnd.trim() ? dnd : DEFAULT_DND_MSG;
        await sock.sendMessage(m.chat, { text: msg }, { quoted: m }).catch(() => {});
    } catch (err) {
        console.error('[DND]', err.message);
    }
};
