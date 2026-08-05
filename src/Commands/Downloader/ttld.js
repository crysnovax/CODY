const axios = require('axios');

module.exports = {
    name: 'ttld',
    alias: [],
    desc: 'Download TikTok videos without watermark no audio sent',
    category: 'Downloader',
    usage: `.ttld <TikTok URL>`,
    reactions: { start: '🎵', success: '✨', error: '❔' },

    execute: async (sock, m, { args, reply, prefix, quoted }) => {
        let url = args[0]?.trim();

        // Check if replying to a message with TikTok URL
        if (!url || (!url.includes('tiktok.com') && !url.includes('vm.tiktok') && !url.includes('vt.tiktok'))) {
            const target = m.quoted || quoted;
            if (target && target.text) {
                const urlMatch = target.text.match(/(https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s]+)/);
                if (urlMatch) url = urlMatch[0];
            }
        }

        if (!url) {
            return reply(
                `╭─❍ *TIKTOK DOWNLOADER*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}ttld <TikTok URL>\n│\n` +
                `│ ✪ *Example:*\n` +
                `│ ${prefix}ttld https://vt.tiktok.com/ZS96rB5qN/\n│\n` +
                `│ 📱 *Or reply to a TikTok link*\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '🎵', key: m.key } });

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

        try {
            await updateProgress(20, 'Resolving TikTok URL...');

            // ✅ Try TikTok API with proper headers
            const apiUrl = 'https://www.tikwm.com/api/';
            const response = await axios.post(apiUrl,
                new URLSearchParams({ url: url, hd: 1 }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Accept': 'application/json',
                        'User-Agent': 'TikTok 26.2.0 rcx-standalone-tiktok (Android)',
                        'Referer': 'https://www.tikwm.com/'
                    },
                    timeout: 30000
                }
            );

            const data = response.data;

            if (data.code !== 0 || !data.data) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                await sock.sendMessage(m.chat, { text: '💤 Failed to fetch TikTok video', edit: progressMsg.key });
                return;
            }

            const videoData = data.data;
            
            // ✅ Try multiple URL options — wmplay works best for WhatsApp
            const downloadUrl = videoData.play || videoData.wmplay || videoData.hdplay || videoData.download;
            const title = (videoData.title || 'TikTok Video').slice(0, 200);
            const author = videoData.author?.nickname || videoData.author?.unique_id || 'Unknown';

            if (!downloadUrl) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                await sock.sendMessage(m.chat, { text: '🏗️No video URL found', edit: progressMsg.key });
                return;
            }

            console.log('[TTLD] Download URL:', downloadUrl);

            await updateProgress(50, 'Downloading video...');

            // ✅ Download with proper headers for video
            const videoResponse = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'video/mp4,video/webm,video/*',
                    'Referer': 'https://www.tiktok.com/'
                }
            });

            const buffer = Buffer.from(videoResponse.data);
            
            // ✅ Check if we actually got video data (MP4 header starts with specific bytes)
            const header = buffer.slice(0, 4).toString('hex');
            console.log('[TTLD] File header:', header);
            console.log('[TTLD] File size:', buffer.length);

            // If the downloaded file is HTML or too small, it's not a valid video
            const isHtml = buffer.slice(0, 100).toString().includes('<!DOCTYPE') || 
                          buffer.slice(0, 100).toString().includes('<html');
            
            if (isHtml || buffer.length < 5000) {
                // Try fallback URL
                const fallbackUrl = videoData.wmplay || videoData.play || videoData.hdplay;
                if (fallbackUrl && fallbackUrl !== downloadUrl) {
                    console.log('[TTLD] Trying fallback URL:', fallbackUrl);
                    const fallbackRes = await axios.get(fallbackUrl, {
                        responseType: 'arraybuffer',
                        timeout: 60000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'video/*',
                            'Referer': 'https://www.tiktok.com/'
                        }
                    });
                    
                    const fallbackBuffer = Buffer.from(fallbackRes.data);
                    const fallbackHeader = fallbackBuffer.slice(0, 4).toString('hex');
                    console.log('[TTLD] Fallback header:', fallbackHeader);
                    
                    if (fallbackBuffer.length > 5000) {
                        await updateProgress(90, 'Processing fallback...');
                        
                        await updateProgress(100, 'Done!');
                        await new Promise(r => setTimeout(r, 400));
                        await sock.sendMessage(m.chat, { delete: progressMsg.key });

                        await sock.sendMessage(m.chat, {
                            video: fallbackBuffer,
                            mimetype: 'video/mp4',
                            caption: `🎵 *${title}*\n👤 ${author}\n\n_⚡ CRYSNOVA_`
                        }, );

                        await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
                        return;
                    }
                }
                
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                await sock.sendMessage(m.chat, { text: '🏗️ Downloaded file is not a video. Try another link.', edit: progressMsg.key });
                return;
            }

            await updateProgress(90, 'Processing...');
            await updateProgress(100, 'Done!');
            await new Promise(r => setTimeout(r, 400));
            await sock.sendMessage(m.chat, { delete: progressMsg.key });

            // Send the video
            await sock.sendMessage(m.chat, {
                video: buffer,
                mimetype: 'video/mp4',
                caption: `🎵 *${title}*\n👤 ${author}\n\n_⚡ CRYSNOVA_`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (err) {
            console.error('[TTLD ERROR]', err.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });

            let errorMsg = '🏗️ *Failed*\n\n';
            if (err.code === 'ECONNABORTED') errorMsg += '⏰ Timeout\n';
            else errorMsg += `🏗️ ${err.message}`;

            await sock.sendMessage(m.chat, { text: errorMsg, edit: progressMsg.key });
        }
    }
};
