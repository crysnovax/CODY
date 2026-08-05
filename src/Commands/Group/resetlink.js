const fetch = require('node-fetch');

module.exports = {
    name: 'revoke',
    alias: ['resetlink', 'newlink', 'revokelink'],
    category: 'Admin',
    admin: true,
    group: true,

    execute: async (sock, m, { reply , prefix}) => {
        try {
            if (!m.isGroup) return reply('`⟁⃝GROUP ONLY!℘`');

            const meta = await sock.groupMetadata(m.chat);
            const groupName = meta.subject;

            // ✅ REVOKE CURRENT INVITE CODE
            let newCode;
            try {
                newCode = await sock.groupRevokeInvite(m.chat);
            } catch (err) {
                return reply('`—͟͟͞͞𖣘 Failed to revoke link. Make sure I am admin.`');
            }

            const newLink = `https://chat.whatsapp.com/${newCode}?mode=gi_t`;

            // Thumbnail
            let thumbnail = null;
            try {
                const pp = await sock.profilePictureUrl(m.chat, 'image');
                thumbnail = await fetch(pp).then(r => r.buffer());
            } catch {}

            // Send revocation notice + new link with rich preview
            await sock.sendMessage(m.chat, {
                text: `_*⟁⃝  Group link has been revoked and renewed—͟͟͞͞𖣘*_`
            }, { quoted: m });

            // Send new link with ?mode=gi_t rich preview
            await sock.sendMessage(m.chat, {
                extendedTextMessage: {
                    text: newLink,
                    matchedText: newLink,
                    canonicalUrl: newLink,
                    title: groupName,
                    description: 'WhatsApp Group Invite — Link Renewed',
                    previewType: 1,
                    jpegThumbnail: thumbnail
                },
                raw: true
            });

        } catch (e) {
            console.error('REVOKE ERROR:', e);
            reply(`${prefix}𓆉 Error: ${emessage}`);
        }
    }
};
