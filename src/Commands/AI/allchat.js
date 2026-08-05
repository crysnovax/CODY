const axios = require('axios');
const config = require('../../../settings/config');

const GATEWAY_URL = config.api?.gateway || 'https://api.crysnovax.link';
const GATEWAY_TOKEN = config.api?.gatewayToken || '';

module.exports = {
    name: 'chateverywhere',
    alias: ['ce', 'freechat'],
    desc: 'Chat with free AI (no limits)',
    category: 'AI',
    usage: `.ce <message>`,

    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ').trim();
        if (!text) return reply('ಠ_ಠ _*Say something*_');

        try {
            await sock.sendMessage(m.chat, { react: { text: '💬', key: m.key } });
            
            const res = await axios.get(`${GATEWAY_URL}/ai/chateverywhere?token=${GATEWAY_TOKEN}&text=${encodeURIComponent(text)}`);
            const data = res.data;
            
            // Extract the response from the API's nested structure
            let response = data?.message || data?.reply || data?.response || data?.result || data?.text;
            
            if (typeof response === 'object' && response !== null) {
                response = response.content || response.output || JSON.stringify(response, null, 2);
            }
            
            if (!response || response === '[object Object]') {
                return reply('✘ Received an empty response.');
            }
            
            await sock.sendMessage(m.chat, {
                text: `𖣘 *CHAT EVERYWHERE*\n\n${response}\n\n_⚉ CRYSNOVA Gateway_`
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        } catch (err) {
            console.error('[CHATEVERYWHERE]', err.message);
            reply('✘ Chat failed');
        }
    }
};