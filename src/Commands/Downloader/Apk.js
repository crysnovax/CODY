// Apk.js — stable APK downloader.
// Primary: Kord APK API (scrapes Aptoide) — verified live.
// Fallback: Aptoide official API v7 — verified live.
// @crysnovax—FIX09-08-26
const axios = require('axios');

const MAX_SIZE = 250 * 1024 * 1024; // 250 MB WhatsApp document cap

function pick(result) {
    if (!result) return null;
    return (
        result.download_url ||
        result.file?.path ||
        result.file?.url ||
        result.link ||
        null
    );
}

async function searchKord(query) {
    const res = await axios.get(
        `https://api.kord.live/api/apk?q=${encodeURIComponent(query)}`,
        { timeout: 20000 }
    );
    const data = res.data;
    if (!data || data.error) return null;
    return {
        name: data.app_name || query,
        packageName: data.package_name || '',
        version: data.version || '',
        size: data.size || 0,
        icon: data.icon || null,
        download: pick(data)
    };
}

async function searchAptoide(query) {
    const res = await axios.get(
        `https://ws75.aptoide.com/api/7/apps/search?query=${encodeURIComponent(query)}&limit=1`,
        { timeout: 20000 }
    );
    const app = res.data?.datalist?.list?.[0];
    if (!app) return null;
    return {
        name: app.name || query,
        packageName: app.package || '',
        version: app.file?.version_name || '',
        size: app.size || app.file?.filesize || 0,
        icon: app.icon || null,
        download: pick(app)
    };
}

module.exports = {
    name: 'apk',
    alias: ['apkdl'],
    desc: 'Stable APK downloader',
    category: 'tools',
    usage: `${prefix}apk <app name>`,

    execute: async (sock, m, { args, reply, prefix }) => {
        try {
            const query = args.join(' ').trim();

            if (!query) {
                return reply(
                    `✘ *Provide app name*\n_*Example: ${prefix}apk whatsapp*_`
                );
            }

            await reply('✦ _*Searching APK...*_');

            // Primary → Kord, fallback → Aptoide
            let found = null;
            try {
                found = await searchKord(query);
            } catch (e) {
                console.log('[APK] Kord failed:', e.message);
            }
            if (!found) {
                try {
                    found = await searchAptoide(query);
                } catch (e) {
                    console.log('[APK] Aptoide failed:', e.message);
                }
            }

            if (!found || !found.download) {
                return reply('✘ _*Apk not found — try a more exact app name*_');
            }

            const appName = found.name || query;
            const downloadLink = String(found.download).trim();
            if (!/^https?:\/\//.test(downloadLink)) {
                return reply('✘ _*Download link not found*_');
            }

            await reply(
                `✓ *${appName}*${found.version ? ` v${found.version}` : ''}\n` +
                `✦ Downloading APK...\n` +
                (found.size ? `𖣘 Size: ${(found.size / 1048576).toFixed(1)} MB\n` : '') +
                `⏳ _This can take up to 2 minutes_`
            );

            // Download APK (axios follows redirects automatically)
            const fileRes = await axios.get(downloadLink, {
                responseType: 'arraybuffer',
                timeout: 120000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36'
                }
            });

            const buffer = Buffer.from(fileRes.data);

            if (!buffer.length) {
                return reply('✘ _*Failed to download APK (empty response)*_');
            }

            if (buffer.length > MAX_SIZE) {
                return reply('✘ APK too large (Max 250MB)');
            }

            await sock.sendMessage(m.chat, {
                document: buffer,
                mimetype: 'application/vnd.android.package-archive',
                fileName: `${appName.replace(/[^\w\- ]+/g, '').trim() || 'app'}.apk`,
                caption:
                    `╭─❍ APK DOWNLOADER\n` +
                    `│ ✦ ${appName}${found.version ? ` v${found.version}` : ''}\n` +
                    `│ 𓄄 ${(buffer.length / 1048576).toFixed(1)} MB\n` +
                    `╰────────────────`
            }, { quoted: m });

        } catch (err) {
            console.log('[APK ERROR]', err.message);
            reply(`✘ APK download failed\nReason: ${err?.message || err}`);
        }
    }
};
