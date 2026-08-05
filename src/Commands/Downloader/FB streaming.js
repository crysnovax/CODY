const axios = require('axios');
const config = require('../../../settings/config');

const GATEWAY_URL = process.env.GATEWAY_URL || config.api?.gateway || 'https://api.crysnovax.link';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || config.api?.gatewayToken || '';

module.exports = {
    name: 'fbstream',
    alias: ['fbs', 'fbsdown'],
    desc: 'Download Facebook video via CRYSNOVA Gateway it is streaming not buffer best for very large files',
    category: 'downloader',
    usage: `.fb <Facebook URL> (or reply to a message containing URL)`,
    owner: false,

    execute: async (sock, m, { args, reply, quoted }) => {
        let url = args[0]?.trim();

        // Extract from replied message
        if (!url || !url.includes('facebook.com')) {
            const target = m.quoted || quoted;
            if (target) {
                const targetText = target.text || target.body || target.message?.conversation || target.message?.imageMessage?.caption || target.message?.videoMessage?.caption || target.message?.extendedTextMessage?.text || '';
                if (targetText) {
                    const urlMatch = targetText.match(/(https?:\/\/[^\s]+facebook\.com[^\s]*)/i);
                    if (urlMatch) url = urlMatch[0];
                }
            }
        }

        if (!url || !url.includes('facebook.com')) {
            return reply(
                '𓄄 *Provide a valid Facebook URL!*\n\n' +
                '`.fb https://facebook.com/...`\n' +
                '`${prefix}fb` (reply to message with URL)'
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '📘', key: m.key } });

        try {
            const apiUrl = `${GATEWAY_URL}/download/facebookv2?token=${encodeURIComponent(GATEWAY_TOKEN)}&url=${encodeURIComponent(url)}`;

            let videoUrl = null;
            let title = 'Facebook Video';

            try {
                const res = await axios.get(apiUrl, { 
                    timeout: 30000,
                    headers: { 'Accept': 'application/json' }
                });
                const data = res.data;

                console.log('[FB] Gateway raw response:', JSON.stringify(data, null, 2));

                // Extract video URL from download_links array
                if (data?.data?.download_links && Array.isArray(data.data.download_links)) {
                    // Get HD first, fallback to SD
                    const hdLink = data.data.download_links.find(l => l.quality?.includes('HD'));
                    const sdLink = data.data.download_links.find(l => l.quality?.includes('SD'));
                    const anyLink = data.data.download_links[0];
                    videoUrl = hdLink?.url || sdLink?.url || anyLink?.url;
                }

                // Fallback to old extraction method
                if (!videoUrl) {
                    const findVideoUrl = (obj) => {
                        if (!obj || typeof obj !== 'object') return null;
                        const candidates = [
                            obj?.result?.hd, obj?.result?.sd, obj?.hd, obj?.sd,
                            obj?.url, obj?.video, obj?.link, obj?.download_url,
                            obj?.data?.hd, obj?.data?.sd, obj?.data?.url,
                            obj?.respon?.url, obj?.response?.url
                        ];
                        for (const c of candidates) {
                            if (typeof c === 'string' && c.startsWith('http')) return c;
                        }
                        for (const v of Object.values(obj)) {
                            if (typeof v === 'string' && v.startsWith('http') && v.includes('.mp4')) return v;
                            if (v && typeof v === 'object') {
                                const nested = findVideoUrl(v);
                                if (nested) return nested;
                            }
                        }
                        return null;
                    };
                    videoUrl = findVideoUrl(data);
                }

                title = data?.data?.title || data?.result?.title || data?.title || data?.respon?.title || 'Facebook Video';

                console.log('[FB] Extracted videoUrl:', videoUrl);
                console.log('[FB] Extracted title:', title);

            } catch (gatewayErr) {
                console.error('[FB] Gateway error:', gatewayErr.message);
                return reply('_✘ Gateway failed. Try again later._');
            }

            if (!videoUrl) {
                return reply('_✘ Could not extract video. The link may be private or invalid._');
            }

            const caption =
                `📘 *Facebook Downloader*\n\n` +
                `❏◦: ${title}\n` +
                `_*CRYSNOVA Gateway*_`;

            // ✅ FIX: Use document message type for large files to avoid buffering issues
            // OR send as video with stream handling
            try {
                // First try sending as document (more reliable for large files)
                await sock.sendMessage(m.chat, {
                    document: { url: videoUrl },
                    mimetype: 'video/mp4',
                    fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}.mp4`,
                    caption
                }, { quoted: m });

                console.log('[FB] Sent as document successfully');

            } catch (docErr) {
                console.error('[FB] Document send failed:', docErr.message);

                // Fallback: try sending as video
                try {
                    await sock.sendMessage(m.chat, {
                        video: { url: videoUrl },
                        mimetype: 'video/mp4',
                        caption,
                        fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)}.mp4`
                    }, { quoted: m });

                    console.log('[FB] Sent as video successfully');

                } catch (videoErr) {
                    console.error('[FB] Video send failed:', videoErr.message);

                    // Last resort: send as text link
                    await reply(
                        `📘 *Facebook Downloader*\n\n` +
                        `❏◦: ${title}\n\n` +
                        `🔗 *Download Link:*\n${videoUrl}\n\n` +
                        `_Could not send video directly. Click the link to download._`
                    );
                }
            }

        } catch (err) {
            console.error('[FB ERROR]', err.message);
            console.error('[FB ERROR FULL]', err);

            // 
            if (err.code === 'ENOSPC' || err.message.includes('No space left on device')) {
                reply('`✘ Server storage full. Run .cleanup to free space.`');
            } else if (err.message.includes('timeout') || err.code === 'ECONNABORTED') {
                reply('`✘ Request timed out. Video may be too large.`');
            } else if (err.response?.status === 404) {
                reply('`✘ Video not found. Link may be broken or private.`');
            } else {
                reply(`\`✘ ${err.message}\``);
            }
        }
    }
};
