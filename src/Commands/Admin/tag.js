const { participantJids } = require('../../Plugin/identityUtils');

module.exports = {
    name: 'tag',
    alias: [],
    desc: 'Mention all members in the group',
    category: 'Group',
    admin: false,
    group: true,
    usage: `${prefix}all`,

    execute: async (sock, m, { reply, args, q }) => {
        try {
            const custom = (q || args.join(" ") || "all").trim();
            const text = custom.startsWith("@") ? custom : `@${custom}`;

            const metadata = await sock.groupMetadata(m.chat);
            const participants = [...new Set(metadata.participants.flatMap(participant => {
                const ids = participantJids(participant);
                return ids.find(jid => jid.endsWith('@s.whatsapp.net')) || ids[0] || '';
            }).filter(Boolean))];

            await sock.sendMessage(m.chat, {
                text: text,
                mentions: participants,
                mentionAll: true
            }, { quoted: m });
        } catch (err) {
            reply(`⊘ ${err?.message || err}`);
        }
    }
};
