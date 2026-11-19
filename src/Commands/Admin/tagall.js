const { participantJids } = require('../../Plugin/identityUtils');

module.exports = {
    name: 'tagall',
    alias: [],
    desc: 'Mention all group members',
    category: 'Admin',
    groupOnly: true,
    adminOnly: false,
     // ⭐ Reaction config
    reactions: {
        start: '💬',
        success: '📢'
    },
    
    execute: async (sock, m, { text, groupMeta }) => {
        const members = [...new Set(groupMeta.participants.flatMap(participant => {
            const ids = participantJids(participant);
            return ids.find(jid => jid.endsWith('@s.whatsapp.net')) || ids[0] || '';
        }).filter(Boolean))];
        const msg = text || '`ⓘ EVERYONE!!`';
        const tags = members.map(p => `⊘ @${p.split('@')[0]}`).join('\n');
        await sock.sendMessage(m.chat, { text: `${msg}\n\n${tags}`, mentions: members }, { quoted: m });
    }
};
