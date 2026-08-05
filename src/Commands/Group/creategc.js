const fetch = require('node-fetch');
const axios = require('axios');

module.exports = {
    name: 'creategc',
    alias: ['creategroup', 'newgc', 'newgroup'],
    desc: 'Create a new WhatsApp group with auto icon & invite link',
    category: 'Group',
    admin: false,

    execute: async (sock, m, { args, reply , prefix}) => {
        try {
            const groupName = args.join(' ').trim();
            if (!groupName) {
                return reply('`✐ Provide a group name.`\n\n_Example: .creategc CRYSNOVA Support_');
            }

            // Create the group
            const result = await sock.groupCreate(groupName, []);
            const groupJid = result.id || result.gid;

            // Set group profile picture from CDN
            const iconUrl = 'https://cdn.crysnovax.link/files/1778488189665-4f9a1653-8ebb-47d5-bb79-429c0182e260.jpeg';
            
            try {
                const iconBuffer = await axios.get(iconUrl, { responseType: 'arraybuffer' });
                await sock.updateProfilePicture(groupJid, Buffer.from(iconBuffer.data));
                console.log('[CREATEGC] Group icon set successfully');
            } catch (iconErr) {
                console.error('[CREATEGC] Failed to set icon:', iconErr.message);
            }

            // Get invite link
            let inviteLink = null;
            try {
                const inviteCode = await sock.groupInviteCode(groupJid);
                inviteLink = `https://chat.whatsapp.com/${inviteCode}?mode=gi_t`;
            } catch (inviteErr) {
                console.error('[CREATEGC] Failed to get invite:', inviteErr.message);
            }

            // Get group thumbnail for rich preview
            let thumbnail = null;
            try {
                thumbnail = await axios.get(iconUrl, { responseType: 'arraybuffer' });
                thumbnail = Buffer.from(thumbnail.data);
            } catch {}

            // Send success message
            if (inviteLink && thumbnail) {
                await sock.sendMessage(m.chat, {
                    extendedTextMessage: {
                        text: `Group "${result.subject}" created successfully!\n\n${inviteLink}`,
                        matchedText: inviteLink,
                        canonicalUrl: inviteLink,
                        title: result.subject,
                        description: 'WhatsApp Group Invite',
                        previewType: 1,
                        jpegThumbnail: thumbnail
                    },
                    raw: true
                }, { quoted: m });
            } else {
                await reply(`${prefix}_Group "${resultsubject}" created successfully!_${inviteLink ? '\n\n🔗 ' + inviteLink : ''}`);
            }

        } catch (error) {
            console.error('[CREATEGC ERROR]', error);
            reply('`✘ Failed to create group.`');
        }
    }
};
