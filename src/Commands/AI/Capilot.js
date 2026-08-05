const axios = require('axios');
const config = require('../../../settings/config');

const GATEWAY_URL = config.api?.gateway || '';
const GATEWAY_TOKEN = config.api?.gatewayToken || '';

module.exports = {
    name: 'copilot',
    alias: ['ghost', 'aihelp'],
    desc: 'Ask GitHub Copilot style AI',
    category: 'AI',
    usage: `.copilot <query>`,

    execute: async (sock, m, { args, reply }) => {
        const query = args.join(' ').trim();
        if (!query) return reply('ಠ_ಠ _*Please provide a query*_');

        try {
            await sock.sendMessage(m.chat, { react: { text: '🤖', key: m.key } });
            
            const res = await axios.get(`${GATEWAY_URL}/ai/copilot?token=${GATEWAY_TOKEN}&text=${encodeURIComponent(query)}`);
            const data = res.data;
            
            // Extract the actual answer from various possible fields
            let answer = data?.result || data?.response || data?.message || data?.reply || data?.text || data;
            
            // If answer is an object, convert to readable string
            if (typeof answer === 'object' && answer !== null) {
                // Sometimes the object has a 'content' or 'output' field
                if (answer.content) answer = answer.content;
                else if (answer.output) answer = answer.output;
                else answer = JSON.stringify(answer, null, 2);
            }
            
            if (!answer || answer === '[object Object]') {
                return reply('✘ Received an empty or invalid response.');
            }
            
            await sock.sendMessage(m.chat, {
                text: `𖣘 *COPILOT AI*\n\n${answer}\n\n_⚉ CRYSNOVA Gateway_`
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        } catch (err) {
            console.error('[COPILOT]', err.message);
            reply('✘ Copilot failed to respond');
        }
    }
};
