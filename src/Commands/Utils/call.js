module.exports = {
    name: 'call',
    alias: ['phone', 'dial', 'ring'],
    desc: 'Create a WhatsApp call button',
    category: 'Tools',
    usage: `.call <number> | <text>`,
    reactions: { start: '📞', success: '🥏', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const fullText = args.join(' ').trim();
        
        if (!fullText) {
            return reply(
                `╭─❍ *WHATSAPP CALL BUTTON*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}call <number> | <text>\n│\n` +
                `│ ✪ *Example:*\n` +
                `│ ${prefix}call 2348077528901 | Call CRYSNOVA\n│\n` +
                `│ 📞 *Tap button to start WhatsApp call*\n` +
                `╰──────────────────`
            );
        }

        // Parse number and text
        const parts = fullText.split('|').map(p => p.trim());
        let phoneNumber = parts[0] || '';
        const displayText = parts[1] || '( ͡❛ ₃ ͡❛) Call';

        // Clean phone number - remove +, spaces, dashes
        phoneNumber = phoneNumber.replace(/[+\s\-()]/g, '');
        
        if (!phoneNumber || !/^\d{10,15}$/.test(phoneNumber)) {
            return reply('`✘ Invalid phone number. Must be 10-15 digits.`');
        }

        await sock.sendMessage(m.chat, { react: { text: '📞', key: m.key } });

        try {
            // ✅ CORRECT WAY FROM README: Use `call:` in nativeFlow
            await sock.sendMessage(m.chat, {
                text: '```TAP TO CALL🤙```',
                nativeFlow: [{
                    text: ` ${displayText}`,
                    call: phoneNumber  // ✅ This should trigger WhatsApp call!
                }]
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🥏', key: m.key } });

        } catch (error) {
            console.error('[CALL ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            
            // Fallback
            reply(`📞 *WhatsApp Call:* Tap to call ${phoneNumber}\n\n_${displayText}_`);
        }
    }
};
