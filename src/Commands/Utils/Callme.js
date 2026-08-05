module.exports = {
    name: 'callme',
    alias: ['myphone', 'ringme'],
    desc: 'Share a call button with your WhatsApp number',
    category: 'Utils',
    usage: `.callme <text>`,
    reactions: { start: '📞', success: '✨', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const displayText = args.join(' ').trim() || '⁩⁩Call Me ✦';
        
        // Get sender's phone number from JID
        const senderJid = m.sender;
        const phoneNumber = senderJid.split('@')[0].replace(/[^0-9]/g, '');

      //  await sock.sendMessage(m.chat, { react: { text: '📞', key: m.key } });

        try {
            await sock.sendMessage(m.chat, {
                text: `⁠☞⁠ ͡⁠°⁠ ͜⁠ʖ⁠ ͡⁠°⁠)⁠☞@${m.sender.split('@')[0]}\nஃ𖠃 Call my line`,
                mentions: [m.sender],
                nativeFlow: [{
                    text: `${displayText}`,
                    call: phoneNumber
                }]
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🥏', key: m.key } });

        } catch (error) {
            console.error('[CALLME ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            
       //     reply(`${prefix}📞 *Call me:* https://wame/${phoneNumber}`);
        }
    }
};
