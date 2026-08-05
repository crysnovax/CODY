const axios = require('axios');

module.exports = {
    name: 'nameinfo',
    alias: ['name', 'meaning', 'namesake'],
    desc: 'Get name meaning and origin',
    category: 'Search',
    usage: `.nameinfo <name>`,
    reactions: { start: '👤', success: '🎭', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const name = args[0]?.trim();
        
        if (!name) {
            return reply(
                `╭─❍ *NAME INFO*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}nameinfo <name>\n│\n` +
                `│ ✪ *Examples:*\n` +
                `│ ${prefix}nameinfo John\n` +
                `│ ${prefix}nameinfo Mary\n` +
                `│ ${prefix}nameinfo Muhammad\n│\n` +
                `│ 👤 *Name meaning & origin*\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '👤', key: m.key } });

        try {
            const res = await axios.get(`https://api.nationalize.io?name=${encodeURIComponent(name)}`, {
                timeout: 10000
            });

            const data = res.data;
            const countries = (data.country || []).sort((a, b) => b.probability - a.probability);

            // Also get gender
            let gender = 'N/A';
            try {
                const genderRes = await axios.get(`https://api.genderize.io?name=${encodeURIComponent(name)}`, { timeout: 8000 });
                gender = genderRes.data?.gender || 'N/A';
            } catch {}

            const tableData = [
                ['👤 Name', name.charAt(0).toUpperCase() + name.slice(1)],
                ['🚻 Gender', gender],
                ['🌍 Top Countries', countries.slice(0, 5).map(c => `${c.country_id} (${(c.probability * 100).toFixed(0)}%)`).join('\n')]
            ];

            await sock.sendMessage(m.chat, {
                headerText: `## 👤 ${name.charAt(0).toUpperCase() + name.slice(1)}`,
                contentText: '---',
                title: '📊 Name Analysis',
                table: tableData,
                footerText: '💡 Name origin & popularity'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (error) {
            await sock.sendMessage(m.chat, { react: { text: '💤', key: m.key } });
            reply('`✘ Failed to analyze name`');
        }
    }
};
