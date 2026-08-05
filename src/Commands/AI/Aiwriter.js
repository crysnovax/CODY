const axios = require('axios');
const config = require('../../../settings/config');

const GATEWAY_URL = config.api?.gateway || '';
const GATEWAY_TOKEN = config.api?.gatewayToken || '';

// Simple in‑memory cache for models (5 minutes)
let modelCache = { data: null, expires: 0 };

async function fetchModels() {
    const now = Date.now();
    if (modelCache.data && modelCache.expires > now) {
        return modelCache.data;
    }
    
    const res = await axios.get(`${GATEWAY_URL}/ai/aiwriter-models?token=${GATEWAY_TOKEN}`);
    const data = res.data;
    
    let models = null;
    if (data?.result?.data && Array.isArray(data.result.data)) {
        models = data.result.data;
    } else if (Array.isArray(data?.result)) {
        models = data.result;
    } else if (typeof data?.result === 'string') {
        try {
            const parsed = JSON.parse(data.result);
            models = parsed?.data || parsed;
        } catch { models = null; }
    }
    
    modelCache = { data: models, expires: now + 5 * 60 * 1000 };
    return models;
}

module.exports = {
    name: 'aiwriter',
    alias: ['aimodel', 'model', 'ai'],
    desc: 'List AI models or chat with a specific model',
    category: 'AI',
    usage: '.aiwriter\n.aiwriter <number> <prompt>\n.aiwriter <model name/code> <prompt>',

    execute: async (sock, m, { args, reply , prefix}) => {
        const input = args.join(' ').trim();
        
        // No args: list models
        if (!input) {
            try {
                await sock.sendMessage(m.chat, { react: { text: '📝', key: m.key } });
                const models = await fetchModels();
                
                if (!Array.isArray(models) || models.length === 0) {
                    return reply('✘ No models available.');
                }
                
                let text = `𖣘 *AI MODELS*\n\n`;
                models.slice(0, 15).forEach((model, i) => {
                    const name = model.name || 'Unknown';
                    const code = model.code || '';
                    const isPro = model.is_pro ? '🜲' : '🆓';
                    const canImage = model.is_image ? ' 🖼️' : '';
                    text += `*${i + 1}.* ${name} ${isPro}${canImage}\n   \`${code}\`\n`;
                });
                if (models.length > 15) {
                    text += `\n_… and ${models.length - 15} more_\n`;
                }
                text += `\n*Usage:*\n.aiwriter 1 <prompt>\n.aiwriter gpt-4o <prompt>`;
                text += `\n\n_⚉ CRYSNOVA Gateway_`;
                
                await sock.sendMessage(m.chat, { text }, { quoted: m });
                await sock.sendMessage(m.chat, { react: { text: '❄️', key: m.key } });
            } catch (err) {
                console.error('[AIWRITER]', err.message);
                reply('✘ Failed to fetch models');
            }
            return;
        }
        
        // With args: parse model selection and prompt
        const parts = input.split(' ');
        const firstPart = parts[0];
        const isNumber = /^\d+$/.test(firstPart);
        
        let selectedModel = null;
        let prompt = '';
        
        if (isNumber) {
            const index = parseInt(firstPart) - 1;
            const models = await fetchModels();
            if (!models || index < 0 || index >= models.length) {
                return reply(`${prefix}✘ Invalid model number Choose 1–${models?.length || 0}.`);
            }
            selectedModel = models[index];
            prompt = parts.slice(1).join(' ').trim();
        } else {
            // Treat as model name/code search
            const models = await fetchModels();
            const searchTerm = firstPart.toLowerCase();
            selectedModel = models?.find(m => 
                m.name?.toLowerCase().includes(searchTerm) || 
                m.code?.toLowerCase().includes(searchTerm)
            );
            if (!selectedModel) {
                return reply(`${prefix}✘ Model "${firstPart}" not found Use .aiwriter to list models.`);
            }
            prompt = parts.slice(1).join(' ').trim();
        }
        
        if (!prompt) {
            return reply(`${prefix}✘ Please provide a prompt\nExample: .aiwriter ${firstPart} Hello world`);
        }
        
        // Send the request to the selected model
        try {
            await sock.sendMessage(m.chat, { react: { text: '🤖', key: m.key } });
            
            const modelCode = selectedModel.code;
            const apiUrl = `${GATEWAY_URL}/ai/chateverywhere?token=${GATEWAY_TOKEN}&text=${encodeURIComponent(prompt)}&model=${encodeURIComponent(modelCode)}`;
            
            const res = await axios.get(apiUrl);
            const data = res.data;
            
            // Extract the actual response text from various possible fields
            let response = data?.message || data?.reply || data?.response || data?.result || data?.text;
            
            // If response is still an object, stringify it nicely
            if (typeof response === 'object' && response !== null) {
                response = JSON.stringify(response, null, 2);
            }
            
            if (!response || response === '[object Object]') {
                return reply('✘ Received an empty or invalid response from the model.');
            }
            
            const modelName = selectedModel.name || modelCode;
            
            await sock.sendMessage(m.chat, {
                text: `𖣘 *${modelName}*\n\n${response}\n\n_⚉ CRYSNOVA Gateway_`
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
        } catch (err) {
            console.error('[AIWRITER CHAT]', err.message);
            reply(`${prefix}✘ Failed to get response from ${selectedModelname}.`);
        }
    }
};
