const axios = require('axios');

module.exports = {
    name: 'tiktok',
    alias: ['tt', 'tiktokdl', 'ttdl'],
    desc: 'Download TikTok video without watermark',
    category: 'downloader',
    usage: '.tt <TikTok URL>',
    owner: false,
    reactions: { start: '🎵', success: '🔖', error: '❔' },

    execute: async (sock, m, { args, reply, quoted }) => {
        let url = args[0]?.trim();

        // ✅ Check if replying to a message with TikTok URL
        if (!url || !url.includes('tiktok.com')) {
            const target = m.quoted || quoted;
            if (target && target.text) {
                const urlMatch = target.text.match(/(https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s]+)/);
                if (urlMatch) url = urlMatch[0];
            }
        }

        if (!url || !url.includes('tiktok.com')) {
            return reply(
                '𓄄 *Provide a valid TikTok URL!*\n\n' +
                'Example:\n' +
                '`.tt https://www.tiktok.com/@user/video/123456789`\n' +
                '`.tt https://vt.tiktok.com/ZSxxxxxx/`\n\n' +
                '📱 _Or reply to a message with a TikTok link_'
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '🎵', key: m.key } });

        // ✅ Progress message
        const progressMsg = await sock.sendMessage(m.chat, {
            text: `🎵 *Fetching TikTok...*\n\n▰▱▱▱▱▱▱▱▱▱ 0%\n\n🔍 Resolving URL...`
        });

        const updateProgress = async (percent, phase) => {
            const filled = Math.round(percent / 10);
            const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
            await sock.sendMessage(m.chat, {
                text: `🎵 *Fetching TikTok...*\n\n${bar} ${percent}%\n\n🔍 ${phase}`,
                edit: progressMsg.key
            });
        };

        await updateProgress(15, 'Connecting to API...');

        const apis = [
            async () => {
                const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
                    timeout: 45000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const data = res.data?.data;
                return {
                    video: data?.play,
                    music: data?.music,
                    title: data?.title,
                    author: data?.author?.unique_id,
                    likes: data?.digg_count
                };
            },

            async () => {
                const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, {
                    timeout: 45000
                });
                const data = res.data;
                return {
                    video: data?.video?.noWatermark,
                    music: data?.music?.play,
                    title: data?.title,
                    author: data?.author?.unique_id,
                    likes: data?.stats?.likeCount
                };
            },

            async () => {
                const res = await axios.get(`https://tiktokdownload.online/api/tiktok?url=${encodeURIComponent(url)}`, {
                    timeout: 45000
                });
                return {
                    video: res.data?.data?.play
                };
            }
        ];

        let result = null;
        let apiIndex = 0;

        for (const api of apis) {
            apiIndex++;
            try {
                await updateProgress(20 + (apiIndex * 20), `Trying API ${apiIndex}...`);
                const data = await api();
                if (data?.video) {
                    result = data;
                    break;
                }
            } catch (err) {
                console.log('[TIKTOK API FAILED]', err.response?.status || err.message);
            }
        }

        if (!result || !result.video) {
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            await sock.sendMessage(m.chat, { text: '🏗️ All APIs failed. Try again later.', edit: progressMsg.key });
            return;
        }

        await updateProgress(75, 'Downloading video...');

        const caption =
            `🎵 *TikTok Downloader*\n\n` +
            `Title: ${result.title || 'Untitled'}\n` +
            `Author: @${result.author || 'Unknown'}\n` +
            `Likes: ${result.likes || 'N/A'}\n` +
            `Downloaded by Crysnova AI`;

        await updateProgress(90, 'Processing...');
        await updateProgress(100, 'Done!');
        await new Promise(r => setTimeout(r, 400));
        await sock.sendMessage(m.chat, { delete: progressMsg.key });

        await sock.sendMessage(m.chat, {
            video: { url: result.video },
            mimetype: 'video/mp4',
            caption,
            fileName: 'tiktok-video.mp4'
        }, { quoted: m });

        if (result.music) {
            await sock.sendMessage(m.chat, {
                audio: { url: result.music },
                mimetype: 'audio/mp4'
            }, { quoted: m });
        }

        await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
    }
};
