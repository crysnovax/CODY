const fetch = require('node-fetch');

module.exports = {
    name: 'ginfo',
    alias: ['groupinfo', 'gi'],
    desc: 'Get the group full details — name, link, and description',
    category: 'Group',
    usage: '_⎔ .ginfo_',
    admin: false,
    group: true,

    execute: async (sock, m, { reply , prefix}) => {
        if (!m.isGroup) {
            return reply('`⟁⃝GROUP ONLY! ℘`');
        }

        try {
            // Fetch group metadata
            let metadata;
            try {
                metadata = await sock.groupMetadata(m.chat);
            } catch (e) {
                console.error('[GINFO METADATA]', e?.message || e);
                return reply('`𓉤 Failed to fetch group info`');
            }

            const groupName = metadata?.subject || 'Unknown Group';
            const desc = metadata?.desc || '_No description set_';
            const participants = metadata?.participants?.length || 0;
            const ownerJid = metadata?.owner || null;
            const ownerNumber = ownerJid ? ownerJid.split('@')[0] : null;

            // Try to get invite code
            let inviteLink = null;
            let linkStatus = '_✘ Bot is not admin — cannot fetch invite link_';

            try {
                const code = await sock.groupInviteCode(m.chat);
                if (code) {
                    inviteLink = `https://chat.whatsapp.com/${code}?mode=gi_t`;
                    linkStatus = null;
                }
            } catch (err) {
                console.error('[GINFO INVITE]', err?.message || err);
            }

            // Thumbnail
            let thumbnail = null;
            try {
                const pp = await sock.profilePictureUrl(m.chat, 'image');
                thumbnail = await fetch(pp).then(r => r.buffer());
            } catch {}

            // Build caption text with owner tagged
            const captionText = `*⟁⃝GROUP INFORMATION —͟͟͞͞𖣘*\n\n` +
                              `㋛ *Name:* ${groupName}\n` +
                              `㋛ *Members:* ${participants}\n` +
                              `㋛ *Owner:* @${ownerNumber || 'unknown'}\n` +
                              `㋛ *Description:* ${desc}\n` +
                              `𓂃✍︎ 𝓬𝓻𝔂𝓼𝓷𝓸𝓿𝓪𝔁 𝓿𝓮𝓻𝓲𝓯𝓲𝓮𝓭 ☠︎︎`;

            if (!inviteLink) {
                // No link available — send text only with mention
                return await sock.sendMessage(m.chat, {
                    text: captionText + `\n\n${linkStatus}`,
                    mentions: ownerJid ? [ownerJid] : []
                }, { quoted: m });
            }

            // ✅ ONE MESSAGE — body text + URL + owner mention
            await sock.sendMessage(m.chat, {
                extendedTextMessage: {
                    text: `${captionText}\n\n${inviteLink}`,
                    matchedText: inviteLink,
                    canonicalUrl: inviteLink,
                    title: groupName,
                    description: `${participants} members • ${desc.substring(0, 50)}`,
                    previewType: 1,
                    jpegThumbnail: thumbnail,
                    // Include contextInfo with mention for the owner
                    contextInfo: {
                        mentionedJid: ownerJid ? [ownerJid] : []
                    }
                },
                raw: true
            }, { quoted: m });

        } catch (e) {
            console.error('[GINFO ERROR]', e);
            reply(`${prefix}𓆉 Error: ${emessage}`);
        }
    }
};
                    
