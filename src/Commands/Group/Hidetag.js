const { participantJids } = require('../../Plugin/identityUtils');

module.exports = {
    name: 'hidetag',
    alias: ['htag', 'silenttag'],
    category: 'group',
    desc: 'Tag everyone silently',
    usage: `${prefix}hidetag <message>`,
     // ⭐ Reaction config
    reactions: {
        start: '💬',
        success: '👀'
    },
    

    execute: async (sock, m, { args, reply }) => {

        if (!m.isGroup) return reply('✘ This command works only in groups');

        const metadata = await sock.groupMetadata(m.chat);
        const participants = [...new Set(metadata.participants.flatMap(participant => {
            const ids = participantJids(participant);
            return ids.find(jid => jid.endsWith('@s.whatsapp.net')) || ids[0] || '';
        }).filter(Boolean))];

        const text = args.join(' ') || '📢 Attention everyone';

        await sock.sendMessage(
            m.chat,
            {
                text: text,
                mentions: participants
            },
            { quoted: m }
        );
    }
};
