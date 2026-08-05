const axios = require('axios');
const FormData = require('form-data');
const config = require('../../../settings/config');

// Use gateway from config with token
const GATEWAY_URL = process.env.GATEWAY_URL || config.api?.gateway || 'https://api.crysnovax.link';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || config.api?.gatewayToken || '';

module.exports = {
    name: 'caption',
    alias: ['describe', 'seethis'],
    category: 'AI',
    desc: 'AI describes any image using CRYSNOVA Vision',
    usage: '.caption (reply to image) | .caption <question> (reply to image)',

    execute: async (sock, m, { reply, args , prefix}) => {
        if (!m.quoted) {
            return reply(
                `𝌆☇ *AI IMAGE CAPTION*\n\n` +
                `ⓘ Usage:\n` +
                `› Reply to an image with *.caption*\n` +
                `› Ask something: *.caption what brand is this?*\n\n` +
                `Aliases: .describe .imgai .aicap .seethis`
            );
        }

        const mtype = m.quoted?.mtype || '';
        const isImage = mtype.includes('image') || mtype.includes('sticker');

        if (!isImage) {
            return reply('✘ Reply to an image or sticker');
        }

        const customPrompt = args.join(' ').trim();
        const prompt = customPrompt || 'Describe this image in detail. Include what you see, any visible text, colors, objects, people, setting, mood, and anything notable.';

        await sock.sendMessage(m.chat, { react: { text: '🔍', key: m.key } });
        await reply('`—͟͟͞͞𖣘 Analyzing image...`');

        try {
            // Download image
            const buffer = await m.quoted.download();
            if (!buffer?.length) {
                return reply('✘ Failed to download image');
            }

            // Send to gateway /vision endpoint with token
            const form = new FormData();
            form.append('file', buffer, { filename: 'image.jpg' });
            form.append('prompt', prompt);

            const response = await axios.post(
                `${GATEWAY_URL}/vision?token=${encodeURIComponent(GATEWAY_TOKEN)}`,
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 60000,
                }
            );

            const description = response.data?.description;
            if (!description) {
                return reply('✘ No description returned');
            }

            await sock.sendMessage(m.chat, {
                text: `⎙ *AI CAPTION*\n\n${description}\n\n_⚉ CRYSNOVA Vision_`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✓', key: m.key } });

        } catch (err) {
            console.error('[CAPTION ERROR]', err.message);
            await sock.sendMessage(m.chat, { react: { text: '✘', key: m.key } });
            reply(`${prefix}✘ ${errmessage || 'Analysis failed'}`);
        }
    }
};
