// ── tagall.js ────────────────────────────────────────────────────
module.exports = {
    name: 'all',
    alias: [],
    desc: 'Mention all members in the group',
    category: 'Group',
    admin: false,
    group: true,
    usage: `.all`,

    execute: async (sock, m, { reply }) => {
        try {
            await sock.sendMessage(m.chat, {
                text: '@all',
                mentionAll: true
            }, { quoted: m });
        } catch (err) {
            reply(`${prefix}⊘ ${errmessage}`);
        }
    }
};
