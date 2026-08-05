const { pluginsDB } = require('./plugin.js');

module.exports = {
    name: 'plugins',
    alias: ['listplugins', 'pluginlist'],
    desc: 'List all installed external plugins',
    category: 'owner',
    ownerOnly: true,
    usage: `.plugins`,

    execute: async (sock, m, { reply }) => {
        const entries = Object.entries(pluginsDB);

        if (entries.length === 0) {
            return reply(
                `╭─❍ *PLUGINS*\n│\n│ 𓄇 No external plugins installed\n│\n│ ⚉ Use .plugin <url> to install\n╰──────────────────`
            );
        }

        let msg = `╭─❍ *PLUGINS* (${entries.length})\n│\n`;
        
        entries.forEach(([url, info], i) => {
            const date = new Date(info.installedAt).toLocaleDateString();
            msg += `│ ${i + 1}. *${info.name}*\n`;
            msg += `│ ⎔ ${info.category}*\n`;
            msg += `| 📅 ${date}\n`;
            msg += `│  ⇆  ${url.split('/').pop()?.slice(0, 40)}\n`;
            if (i < entries.length - 1) msg += `│\n`;
        });

        msg += `│\n│ ⚉ .unplugin <name> to remove\n╰──────────────────`;

        return reply(msg);
    }
};
