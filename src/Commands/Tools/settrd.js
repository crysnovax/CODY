const { loadDefaults, saveDefaults, langName } = require('../Core/✐');

module.exports = {
    name: 'settrd',
    alias: ['settr', 'setdefaultlang'],
    category: 'Tools',
    desc: 'Set your default translation language',
    usage: `.settrd <lang>`,
    reactions: { start: '⚙️', success: '🔖', error: '💤' },

    execute: async (sock, m, { reply, args }) => {
        const lang = args[0]?.toLowerCase();

        if (!lang) return reply(
            `╭─❍ *SET DEFAULT LANG*\n│\n` +
            `│ ✘ Specify a language\n│\n` +
            `│ ✪ *Example:*\n` +
            `│ • .settrd en\n` +
            `│ • .settrd yo\n` +
            `│ • .settrd fr\n` +
            `╰──────────────────`
        );

        const defaults = loadDefaults();
        defaults[m.sender] = lang;
        saveDefaults(defaults);

        await sock.sendMessage(m.chat, { react: { text: '⚙️', key: m.key } });

        await sock.sendMessage(m.chat, {
            headerText: `## ⚙️ Default Language Set`,
            contentText: '---',
            title: '✅ Settings Saved',
            table: [
                ['🌐 Language', langName(lang)],
                ['🔤 Code', lang],
                ['📝 Usage', 'Use .trd while replying to any message']
            ],
            footerText: '💡 Your translations now default to this language'
        }, { quoted: m });

        await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
    }
};
