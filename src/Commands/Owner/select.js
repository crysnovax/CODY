// File: src/Commands/Interactive/select.js

module.exports = {
    name: 'select',
    alias: ['list', 'listmsg', 'listmessage'],
    desc: 'Send a selectable list message',
    category: 'Interactive',
    groupOnly: false,
    adminOnly: false,

    execute: async (sock, m, { text, reply , prefix}) => {
        try {
            const chat = m.chat;
            
            // Select only works in private chat
            if (!chat.endsWith('@s.whatsapp.net') && !chat.endsWith('@lid')) {
                return reply(`⊘ *Select only works in private chat*\n\nThis feature is only available for direct messages, not groups.`);
            }

            // Parse: title | description | buttonText | sectionTitle | option1 | id1 | option2 | id2 | option3 | id3 ...
            const parts = text.split('|').map(p => p.trim());
            
            if (!text || parts.length < 6) {
                return reply(
                    `ⓘ *Usage:*\n` +
                    `.select | Title | Description | Button Text | Section Title | Option1 | ID1 | Option2 | ID2 | Option3 | ID3 ...\n\n` +
                    `*Example:*\n` +
                    `.select | 👋🏻 Menu | Choose an option | 📋 Tap here | 🚀 Main Menu | ✨ AI Tools | #AI | 🔍 Search | #search | 🎮 Games | #games | 📊 Poll | #poll`
                );
            }

            const title = parts[0];
            const description = parts[1];
            const buttonText = parts[2];
            const sectionTitle = parts[3];
            
            // Build rows array - unlimited options
            const rows = [];
            for (let i = 4; i < parts.length; i += 2) {
                if (parts[i] && parts[i + 1]) {
                    rows.push({
                        title: parts[i],
                        description: '',
                        rowId: parts[i + 1]
                    });
                }
            }

            if (rows.length === 0) {
                return reply(`⊘ Please provide at least one option with an ID.`);
            }

            await sock.sendMessage(chat, {
                text: description,
                footer: '@crysnovax/baileys',
                buttonText: buttonText,
                title: title,
                sections: [{
                    title: sectionTitle,
                    rows: rows
                }]
            });

            reply(`${prefix}✓ Select list sent with ${rowslength} options!`);

        } catch (err) {
            console.error('[SELECT ERROR]', err);
            
            if (err.message?.includes('rows')) {
                reply(`⊘ WhatsApp may have a limit on number of rows. Try with fewer options.`);
            } else {
                reply(`${prefix}𓃵 Failed: ${errmessage}`);
            }
        }
    }
};
