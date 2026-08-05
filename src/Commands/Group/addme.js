const fetch = require('node-fetch');

module.exports = {
    name: 'addme',
    alias: [],
    category: 'Group',
    admin: true,
    group: true,

    execute: async (sock, m, { reply , prefix}) => {
        try {
            if (!m.isGroup) return reply('`⟁⃝GROUP ONLY!℘`');

            const meta = await sock.groupMetadata(m.chat);
            const groupName = meta.subject;

            // Get invite code
            let inviteCode;
            try {
                inviteCode = await sock.groupInviteCode(m.chat);
            } catch (err) {
                // If bot is not admin, can't get invite code
                return reply('`—͟͟͞͞𖣘 I need admin rights to generate the group link`');
            }

            const inviteLink = `https://chat.whatsapp.com/${inviteCode}?mode=gi_t`;

            // Thumbnail
            let thumbnail = null;
            try {
                const pp = await sock.profilePictureUrl(m.chat, 'image');
                thumbnail = await fetch(pp).then(r => r.buffer());
            } catch {}

            // Send rich preview link
            await sock.sendMessage(m.chat, {
                extendedTextMessage: {
                    text: inviteLink,
                    matchedText: inviteLink,
                    canonicalUrl: inviteLink,
                    title: groupName,
                    description: 'WhatsApp Group Invite',
                    previewType: 1,
                    jpegThumbnail: thumbnail
                },
                raw: true
            }, { quoted: m });

        } catch (e) {
            console.error('GLINK ERROR:', e);
            reply(`${prefix}𓆉 Error: ${emessage}`);
        }
    }
};
