const { loadDefaults } = require('../Core/✐');
const { translate } = require('../../Plugin/translationService');

module.exports = {
    name: 'trd',
    alias: ['trdefault'],
    category: 'Tools',
    desc: 'Translate to your default language',
    usage: '.trd [text] or reply to a message',
    reactions: { start: '🌐', success: '✨', error: '❔' },

    execute: async (sock, m, { reply, args }) => {
        const defaults = loadDefaults();
        const lang = defaults[m.sender];

        if (!lang) return reply(
            `╭─❍ *DEFAULT TRANSLATE*\n│\n` +
            `│ ✘ No default language set\n│\n` +
            `│ Set one: .settrd <lang>\n` +
            `│ Example: .settrd en\n` +
            `╰──────────────────`
        );

        const text = args.join(' ') || m.quoted?.text || '';
        if (!text) return reply('`✘ No text found. Reply or type after .trd`');

        await sock.sendMessage(m.chat, { react: { text: '🌐', key: m.key } });

        try {
            const { translated, from } = await translate(text, lang);
            
            await sock.sendMessage(m.chat, {
                headerText: `## 🌐 Auto Translation`,
                contentText: '---',
                title: '📝 Result',
                table: [
                    ['📤 From', from],
                    ['📥 To', lang],
                    ['📝 Original', text.length > 200 ? text.slice(0, 197) + '...' : text],
                    ['✅ Translated', translated]
                ],
                footerText: '💡 Change default: .settrd <lang>'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (err) {
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply(`\`✘ Translation failed — ${err.message}\``);
        }
    }
};
