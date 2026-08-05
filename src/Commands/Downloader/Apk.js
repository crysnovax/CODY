const axios = require('axios');

module.exports = {
    name: 'apk',
    alias: ['apkdl'],
    desc: 'Stable APK downloader',
    category: 'tools',
    usage: `.apk <app name>`,

    execute: async (sock, m, { args, reply, prefix }) => {

        try {

            const query = args.join(' ').trim();

            if (!query)
                return reply(
                    `✘ *Provide app name*\n_*Example: ${prefix}apk whatsapp*_`
                );

            await reply('✦ _*Searching APK...*_');

            // Kord APK Search API
            const searchApi =
                `https://api.kord.live/api/apk?q=${encodeURIComponent(query)}`;

            const searchRes = await axios.get(searchApi, {
                timeout: 30000
            });

            const data = searchRes.data;

            if (!data || data.error)
                return reply('✘ _*Apk not found*_');

            const appName = data.app_name || query;
            const downloadLink = data.download_url;

            if (!downloadLink)
                return reply('✘ _*Download link not found*_');

            await reply(`✓ Found ${appName}\n✦ Downloading APK...`);

            // Download APK file
            const fileRes = await axios.get(downloadLink, {
                responseType: 'arraybuffer',
                timeout: 120000
            });

            const buffer = Buffer.from(fileRes.data);

            if (!buffer.length)
                return reply('✘ Failed to download APK');

            // ⭐ 250MB Limit
            const maxSize = 250 * 1024 * 1024;

            if (buffer.length > maxSize)
                return reply('✘ APK too large (Max 250MB)');

            await sock.sendMessage(m.chat, {
                document: buffer,
                mimetype: 'application/vnd.android.package-archive',
                fileName: `${appName}.apk`,
                caption:
                    `╭─❍ APK DOWNLOADER\n` +
                    `│ ✦ ${appName}\n` +
                    `╰────────────────`
            }, { quoted: m });

        } catch (err) {

            console.log('[APK ERROR]', err.message);

            reply(`${prefix}✘ APK download failed\nReason: ${errmessage}`);
        }
    }
};