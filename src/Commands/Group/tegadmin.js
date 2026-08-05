module.exports = {
    name: 'tagadmin',
    alias: ['admins', 'admin'],
    category: 'group',
    desc: 'Tag all group admins',
    usage: `.tagadmin <message>`,
     // ⭐ Reaction config
    reactions: {
        start: '💫',
        success: '🌟'
    },
    

    execute: async (sock, m, { args, reply }) => {

        if (!m.isGroup) return reply('✘ This command works only in groups');

        const metadata = await sock.groupMetadata(m.chat);
        const admins = metadata.participants
            .filter(p => p.admin !== null)
            .map(p => p.id);

        const text = args.join(' ') || '📢 Calling all admins';

        let message =
            `╭────────────────\n` +
            `│ 🜲 *TAGGING ADMINS*\n` +
            `╰────────────────\n\n` +
            `${text}\n\n`;

        for (let admin of admins) {
            message += `➤ @${admin.split('@')[0]}\n`;
        }

        await sock.sendMessage(
            m.chat,
            {
                text: message,
                mentions: admins
            },
            { quoted: m }
        );
    }
};
