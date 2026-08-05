const { getVar, setVar } = require('../../Plugin/configManager');

module.exports = {
    name: 'channel',
    alias: ['ch', 'newsletter', 'nl', 'createchannel'],
    desc: 'Create a WhatsApp channel/newsletter',
    category: 'Newsletter',
    ownerOnly: true,
    usage: `.channel <name>`,
    examples: ['.channel My Channel', '.nl TEST'],
    reactions: { start: '📢', success: '🎉', error: '🙈' },

    execute: async (sock, m, { args, reply }) => {
        const name = args.join(' ');
        
        if (!name) {
            return reply(
                `📢 *CREATE CHANNEL*\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📋 *Usage:* .channel <name>\n` +
                `📝 *Example:* .channel My Awesome Channel\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '📢', key: m.key } });

        try {
            const result = await sock.newsletterCreate(name);
            
            // Extract JID from result
            let jid = null;
            if (result && typeof result === 'object') {
                jid = result.jid || result.id || result.newsletterId || null;
            }
            
            if (jid) {
                // Get the invite link/code for the channel
                // The link format is: https://whatsapp.com/channel/INVITE_CODE
                // We need to extract the invite code somehow
                let inviteCode = null;
                let inviteLink = null;
                
                // Try to get invite code from result
                if (result.inviteCode || result.code) {
                    inviteCode = result.inviteCode || result.code;
                    inviteLink = `https://whatsapp.com/channel/${inviteCode}`;
                } else if (jid) {
                    // If we have JID but no invite code, we need to fetch it
                    // For now, show just the JID and let user know
                    inviteLink = null;
                }
                
                if (inviteLink) {
                    await sock.sendMessage(m.chat, {
                        headerText: `## 📢 Channel Created`,
                        contentText: '---',
                        title: '✓ Success',
                        table: [
                            ['🐾 Name', name],
                            ['🔗 Invite Link', inviteLink],
                            ['🆔 JID', jid]
                        ],
                        footerText: 'ⓘ Share the invite link to let others join'
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(m.chat, {
                        headerText: `## 📢 Channel Created`,
                        contentText: '---',
                        title: '🌱 Success',
                        table: [
                            ['🐾 Name', name],
                            ['🆔 JID', jid],
                            ['💡 Tip', 'Get invite link from channel settings in WhatsApp']
                        ],
                        footerText: 'ⓘ Open WhatsApp to manage your channel'
                    }, { quoted: m });
                }
            } else {
                await sock.sendMessage(m.chat, {
                    headerText: `## 📢 Channel Created`,
                    contentText: '---',
                    title: '💫 Success',
                    table: [
                        ['📛 Name', name],
                        ['ⓘ Status', 'Channel created successfully']
                    ],
                    footerText: 'ⓘ Check your WhatsApp to find and manage your channel'
                }, { quoted: m });
            }
            
            await sock.sendMessage(m.chat, { react: { text: '✓', key: m.key } });

        } catch (error) {
            console.error('[CHANNEL ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '⊘', key: m.key } });
            
            // Check if channel was actually created despite error
            if (error.message.includes('GraphQL') || error.message.includes('Bad Request')) {
                await sock.sendMessage(m.chat, {
                    headerText: `## ⚠️ Channel Status`,
                    contentText: '---',
                    title: '⊘ GraphQL Error',
                    table: [
                        ['📛 Name', name],
                        ['ⓘ Status', 'Channel may have been created anyway'],
                        ['💡 Tip', 'Check your WhatsApp to verify']
                    ],
                    footerText: 'The channel might still exist despite the error'
                }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, {
                    headerText: `## ❌ Channel Creation Failed`,
                    contentText: '---',
                    title: '⊘ Error',
                    table: [
                        ['📛 Name', name],
                        ['⚠️ Error', error.message]
                    ]
                }, { quoted: m });
            }
        }
    }
};
