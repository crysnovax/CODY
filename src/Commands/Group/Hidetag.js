module.exports = {
    name: 'hidetag',
    alias: ['htag', 'silenttag'],
    category: 'group',
    desc: 'Tag everyone silently',
    usage: `.hidetag <message>`,
     // ⭐ Reaction config
    reactions: {
        start: '💬',
        success: '👀'
    },
    

    execute: async (sock, m, { args, reply }) => {

        if (!m.isGroup) return reply('✘ This command works only in groups');

        const metadata = await sock.groupMetadata(m.chat);
        const participants = metadata.participants.map(p => p.id);

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