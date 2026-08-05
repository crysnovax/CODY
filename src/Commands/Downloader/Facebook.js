const axios = require('axios');
const config = require('../../../settings/config');

// Use Apex gateway from config with token
const GATEWAY_URL = process.env.GATEWAY_URL || config.api?.gateway || 'https://api.crysnovax.link';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || config.api?.gatewayToken || '';

module.exports = {
    name: 'fb',
    alias: ['facebook', 'fbdown'],
    desc: 'Download Facebook video via CRYSNOVA Gateway',
    category: 'downloader',
    usage: `.fb <Facebook URL> (or reply to a message containing URL)`,
    owner: false,

    execute: async (sock, m, { args, reply, quoted }) => {
        let url = args[0]?.trim();

        // Priority 1: Direct URL from args
        // Priority 2: Extract from replied/quoted message
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
                '*Usage:*\n' +
                '`.fb https://facebook.com/...`\n' +
                '`${prefix}fb` (reply to message with URL)\n\n' +
                '*Example:*\n' +
                '`.fb https://facebook.com/watch?v=...`'
            );
        }

        await reply('_*✪ Downloading...*_');

        try {
            const apiUrl = `${GATEWAY_URL}/download/facebookv2?token=${encodeURIComponent(GATEWAY_TOKEN)}&url=${encodeURIComponent(url)}`;
            const res = await axios.get(apiUrl, { timeout: 60000 });
            const data = res.data;

            let videoUrl = null;
            let title = 'Facebook Video';

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
            title = data?.result?.title || data?.title || data?.respon?.title || data?.data?.title || 'Facebook Video';

            if (!videoUrl) {
                return reply('_✘ Failed to extract video URL from gateway response._');
            }

            const caption =
                `📘 *Facebook Downloader*\n\n` +
                `❏◦: ${title}\n` +
                `_*CRYSNOVA Gateway*_`;

            await sock.sendMessage(m.chat, {
                video: { url: videoUrl },
                mimetype: 'video/mp4',
                caption,
                fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp4`
            }, { quoted: m });

        } catch (err) {
            reply(`${prefix}✘ Download failed: ${errmessage || 'Unknown error'}`);
        }
    }
};
