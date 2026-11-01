const { getVar } = require('../../Plugin/configManager');

module.exports = {
    name: 'owner',
    alias: ['creator', 'admin'],
    desc: 'Show bot owner contact',
    category: 'Bot',
    reactions: {
        start: '💬',
        success: '❔'
    },
    
    execute: async (sock, m, { config: cfg }) => {
        try {
            const botName = process.env.BOT_NAME || getVar('BOT_NAME', cfg?.bot?.name) || '𝗰𝗿𝘆𝘀𝗻ᝪ𝘃𝗮メ';
            const ownerName = process.env.OWNER_NAME || getVar('OWNER_NAME', cfg?.ownerName) || 'Cody AI';
            const ownerRaw = process.env.OWNER_NUMBER || getVar('OWNER_NUMBER', cfg?.owner) || cfg?.owner || '2347058836042';
            const ownerNumber = ownerRaw.replace(/[^0-9]/g, '').split('@')[0];

            const vcard = `
BEGIN:VCARD
VERSION:3.0
FN:${ownerName}
ORG:${botName}
TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}
END:VCARD
            `.trim();

            await sock.sendMessage(m.chat, {
                contacts: {
                    displayName: botName,
                    contacts: [{ 
                        displayName: botName, 
                        vcard 
                    }]
                }
            }, { quoted: m });

        } catch (err) {
            console.log('[OWNER COMMAND ERROR]', err.message);
            await sock.sendMessage(m.chat, { text: '✘ Failed to fetch owner contact' }, { quoted: m });
        }
    }
};
