const axios = require('axios');
const FormData = require('form-data');
const config = require('../../../settings/config');

// Use Apex gateway from config
const GATEWAY_URL = process.env.GATEWAY_URL || config.api?.gateway || 'https://api.crysnovax.link';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || config.api?.gatewayToken || '';

module.exports = {
    name: 'rembg',
    alias: ['removebg', 'nobg', 'bgremove'],
    desc: 'Remove background from replied image',
    category: 'AI',
    usage: `.rembg (reply to an image)`,
    owner: false,

    execute: async (sock, m, { reply }) => {
        if (!m.quoted) {
            return reply('╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ Reply to an image.\n╰──────────────────');
        }

        const quoted = m.quoted;
        const mtype = quoted.mtype || quoted.type || '';
        if (!mtype.includes('image')) {
            return reply('╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ Please reply to an image only.\n╰──────────────────');
        }

        try {
            await reply('_*✪ Removing background...*_');

            const buffer = await quoted.download();
            if (!buffer || buffer.length < 100) {
                return reply('╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ Failed to download image.\n╰──────────────────');
            }

            const form = new FormData();
            form.append('image_file', buffer, {
                filename: 'image.jpg',
                contentType: 'image/jpeg'
            });
            form.append('size', 'auto');

            // Call Apex gateway /rembg endpoint
            const response = await axios.post(
                `${GATEWAY_URL}/rembg?token=${encodeURIComponent(GATEWAY_TOKEN)}`,
                form,
                {
                    headers: form.getHeaders(),
                    responseType: 'arraybuffer',
                    timeout: 30000
                }
            );

            await sock.sendMessage(m.chat, {
                image: Buffer.from(response.data),
                mimetype: 'image/png',
                caption: `╭─❍ *CRYSNOVA AI V2.0*\n│ _*✦ Background removed successfully.*_\n╰──────────────────`
            }, { quoted: m });

        } catch (err) {
            let msg = '╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ Failed to remove background.';

            if (err.response?.status === 402) {
                msg += '\n│ ✦ API credits exhausted.';
            } else if (err.response?.status === 401) {
                msg += '\n│ ✦ Invalid API token.';
            } else if (err.code === 'ECONNABORTED') {
                msg += '\n│ ✦ Request timed out.';
            }

            msg += '\n╰──────────────────';
            await reply(msg);
        }
    }
};
