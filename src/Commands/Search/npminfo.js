'use strict';

const axios = require('axios');

function shorten(value, length = 100) {
    const text = String(value || 'N/A');
    return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

async function sendPackageInfo(sock, m, name, rows) {
    const items = rows.map(([label, value]) => `${label}\n${value}`);
    if (typeof sock.sendList === 'function') {
        await sock.sendList(m.chat, `📦 ${name} • npm info`, items, m);
        return;
    }
    await sock.sendMessage(m.chat, {
        text: `📦 *${name} • npm info*\n\n${items.join('\n\n')}`,
    }, { quoted: m });
}

module.exports = {
    name: 'npminfo',
    alias: ['package', 'npmjs'],
    desc: 'Get NPM package information',
    category: 'Search',
    usage: '.npminfo <package-name>',
    reactions: { start: '📦', success: '🔖', error: '🏗️' },
    execute: async (sock, m, { args, reply, prefix }) => {
        const pkg = args[0]?.trim();
        if (!pkg) {
            return reply(
                `╭─❍ *NPM INFO*\n│\n` +
                `│ ⓘ *Usage:* ${prefix}npminfo <package>\n│\n` +
                `│ ✪ *Examples:*\n│ ${prefix}npminfo axios\n│ ${prefix}npminfo react\n│ ${prefix}npminfo plogme\n│\n` +
                `│ 📦 *NPM Registry Info*\n╰──────────────────`
            );
        }
        await sock.sendMessage(m.chat, { react: { text: '📦', key: m.key } }).catch(() => {});
        await reply('`⟁⃝📦 HOLD ON...℘`');
        try {
            const encodedPkg = encodeURIComponent(pkg);
            const res = await axios.get(`https://registry.npmjs.org/${encodedPkg}`, {
                timeout: 10000,
                headers: { Accept: 'application/json' },
            });
            const data = res.data || {};
            const latestVersion = data['dist-tags']?.latest || Object.keys(data.versions || {}).pop();
            const latest = data.versions?.[latestVersion] || {};
            const name = data._id || data.name || pkg;
            let downloads = 'N/A';
            try {
                const dlRes = await axios.get(`https://api.npmjs.org/downloads/point/last-week/${encodedPkg}`, { timeout: 8000 });
                downloads = Number(dlRes.data?.downloads || 0).toLocaleString();
            } catch {}
            const rows = [
                ['📦 Package', name],
                ['📝 Description', shorten(data.description || latest.description || 'No description')],
                ['🏷️ Version', latestVersion ? `v${latestVersion}` : 'N/A'],
                ['📥 Weekly downloads', downloads],
                ['📄 License', latest.license || data.license || 'N/A'],
                ['👤 Author', data.author?.name || latest.author?.name || 'N/A'],
                ['🔑 Keywords', (latest.keywords || data.keywords || []).slice(0, 5).join(', ') || 'None'],
                ['🌐 Homepage', shorten(data.homepage || latest.homepage || 'N/A', 60)],
                ['📂 Repository', shorten(data.repository?.url || latest.repository?.url || 'N/A', 60)],
            ];
            await sendPackageInfo(sock, m, name, rows);
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } }).catch(() => {});
        } catch (error) {
            console.error('[NPM INFO ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } }).catch(() => {});
            return reply(error.response?.status === 404
                ? `\`✘ Package not found: "${pkg}"\``
                : '`✘ Failed to fetch package info. Try again.`');
        }
    },
};

module.exports._test = { shorten, sendPackageInfo };
