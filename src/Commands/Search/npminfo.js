'use strict';

const axios = require('axios');

function metadataValue(value) {
    if (value === undefined || value === null || value === '') return 'N/A';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    try { return JSON.stringify(value); } catch { return String(value); }
}

function labelFor(key) {
    return String(key)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function buildPackageInfoContent(requestedName, data = {}, latestVersion, downloads = 'N/A') {
    const versions = data.versions || {};
    latestVersion = latestVersion || data['dist-tags']?.latest || Object.keys(versions).at(-1) || '';
    const latest = versions[latestVersion] || {};
    const name = latest.name || data.name || requestedName;
    const description = latest.description || data.description || 'No description provided.';
    const time = data.time || {};
    const publishedVersions = Object.keys(versions);
    const rows = [
        ['Package', name],
        ['Latest version', latestVersion || 'N/A'],
        ['Weekly downloads', metadataValue(downloads)],
        ['Latest published', metadataValue(time[latestVersion])],
        ['Created', metadataValue(time.created)],
        ['Last modified', metadataValue(time.modified)],
        ['Published version count', String(publishedVersions.length)],
    ];

    for (const [key, value] of Object.entries(data)) {
        if (['versions', 'time', 'readme', 'description', 'name'].includes(key)) continue;
        rows.push([`Registry ${labelFor(key)}`, metadataValue(value)]);
    }

    for (const [key, value] of Object.entries(latest)) {
        if (['name', 'version', 'description', 'readme', 'readmeFilename'].includes(key)) continue;
        rows.push([labelFor(key), metadataValue(value)]);
    }

    const installTarget = latestVersion ? `${name}@${latestVersion}` : name;
    return {
        sections: [
            {
                type: 'list',
                title: 'Description',
                items: [description],
            },
            {
                type: 'table',
                title: 'Complete package metadata',
                headers: ['Field', 'Value'],
                rows,
            },
            {
                type: 'codeBlock',
                title: 'Installation options',
                language: 'bash',
                code: [
                    `npm install ${installTarget}`,
                    `npm install --save-dev ${installTarget}`,
                    `yarn add ${installTarget}`,
                    `pnpm add ${installTarget}`,
                ].join('\n'),
            },
        ],
    };
}

function contentAsListItems(content) {
    const items = [];
    for (const section of content.sections || []) {
        if (section.type === 'list') {
            items.push(`${section.title || 'Description'}\n${(section.items || []).join('\n')}`);
        } else if (section.type === 'table') {
            for (const row of section.rows || []) items.push(`${row[0]}\n${row[1]}`);
        } else if (section.type === 'codeBlock') {
            items.push(`${section.title || 'Code'}\n${section.code || ''}`);
        }
    }
    return items;
}

async function sendPackageInfo(sock, m, name, content) {
    if (typeof sock.sendRichAIResponse === 'function') {
        await sock.sendRichAIResponse(m.chat, content, m);
        return;
    }
    const items = contentAsListItems(content);
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
    desc: 'Get complete NPM package metadata',
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
            const latestVersion = data['dist-tags']?.latest || Object.keys(data.versions || {}).at(-1);
            const name = data.name || data._id || pkg;
            let downloads = 'N/A';
            try {
                const dlRes = await axios.get(`https://api.npmjs.org/downloads/point/last-week/${encodedPkg}`, { timeout: 8000 });
                downloads = Number(dlRes.data?.downloads || 0).toLocaleString();
            } catch {}
            const content = buildPackageInfoContent(name, data, latestVersion, downloads);
            await sendPackageInfo(sock, m, name, content);
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

module.exports._test = { metadataValue, buildPackageInfoContent, contentAsListItems, sendPackageInfo };
