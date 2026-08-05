const axios = require('axios');
const config = require('../../../settings/config');

const GATEWAY_URL = config.api?.gateway || 'https://api.crysnovax.link';
const GATEWAY_TOKEN = config.api?.gatewayToken || '';

// Default thumbnail for models (a generic AI/robot icon)
const DEFAULT_MODEL_THUMB = 'https://cdn-icons-png.flaticon.com/512/4616/4616735.png';

let modelCache = { data: null, expires: 0 };

async function fetchModels() {
    const now = Date.now();
    if (modelCache.data && modelCache.expires > now) return modelCache.data;
    
    try {
        const res = await axios.get(`${GATEWAY_URL}/ai/aiwriter-models?token=${GATEWAY_TOKEN}`, { timeout: 15000 });
        const data = res.data;
        let models = null;
        if (data?.result?.data && Array.isArray(data.result.data)) models = data.result.data;
        else if (Array.isArray(data?.result)) models = data.result;
        else if (data?.data && Array.isArray(data.data)) models = data.data;
        else if (typeof data?.result === 'string') {
            try {
                const parsed = JSON.parse(data.result);
                models = parsed?.data || parsed?.result || parsed;
            } catch { models = null; }
        }
        if (!Array.isArray(models)) throw new Error('Invalid response structure');
        modelCache = { data: models, expires: now + 5 * 60 * 1000 };
        return models;
    } catch (err) {
        console.error('[AIWRITER] fetchModels error:', err.message);
        throw err;
    }
}

module.exports = {
    name: 'aimodels',
    alias: ['aimodel', 'model'],
    desc: 'Browse AI models with carousel and chat with any model',
    category: 'AI',
    usage: '.aiwriter\n.aiwriter <number/code> <prompt>',

    execute: async (sock, m, { args, reply , prefix}) => {
        const input = args.join(' ').trim();
        
        if (!input) {
            try {
                await sock.sendMessage(m.chat, { react: { text: '🤖', key: m.key } });
                const models = await fetchModels();
                if (!Array.isArray(models) || models.length === 0) return reply('✘ No models available.');
                
                const cards = models.slice(0, 15).map((model, i) => {
                    const modelCode = model.code || '';
                    const commandExample = `.aimodel ${modelCode} Your prompt here`;
                    return {
                        image: { url: DEFAULT_MODEL_THUMB },
                        caption: `*${i+1}. ${model.name || 'Unknown'}*\n${model.is_pro ? '🜲 Pro' : '⌘ Free'}${model.is_image ? ' 🖼️' : ''}\n_${(model.description || '').slice(0, 100)}${model.description?.length > 100 ? '…' : ''}_`,
                        footer: `Code: ${modelCode}`,
                        nativeFlow: [{
                            text: '📋 Copy Command',
                            copy: commandExample
                        }, {
                            text: '📝 Copy Code',
                            copy: modelCode
                        }]
                    };
                });
                
                await sock.sendMessage(m.chat, {
                    text: `𓊈𝑽꯭𝑰꯭𝑷ࠡࠡࠡࠡࠢ𓊉 *AI MODEL SHOWCASE*`,
                    footer: `Swipe to browse ${models.length} models`,
                    cards: cards
                }, { quoted: m });
                
                await sock.sendMessage(m.chat, { 
                    text: `_✨ How to use:_\n_Paste the copied command and replace "Your prompt here" with your question._` 
                }, { quoted: m });
                
                await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
            } catch (err) {
                console.error('[AIWRITER] List error:', err.message);
                reply(`${prefix}✘ Failed to load models: ${errmessage}`);
            }
            return;
        }
        
        // === CHAT WITH SELECTED MODEL ===
        const parts = input.split(' ');
        const firstPart = parts[0];
        const isNumber = /^\d+$/.test(firstPart);
        
        let selectedModel = null;
        let prompt = '';
        
        const models = await fetchModels();
        
        if (isNumber) {
            const index = parseInt(firstPart) - 1;
            if (!models || index < 0 || index >= models.length) {
                return reply(`${prefix}✘ Invalid model number Choose 1–${models?.length || 0}.`);
            }
            selectedModel = models[index];
            prompt = parts.slice(1).join(' ').trim();
        } else {
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
        
        try {
            await sock.sendMessage(m.chat, { react: { text: '💬', key: m.key } });
            
            const apiUrl = `${GATEWAY_URL}/ai/chateverywhere?token=${GATEWAY_TOKEN}&text=${encodeURIComponent(prompt)}&model=${encodeURIComponent(selectedModel.code)}`;
            const res = await axios.get(apiUrl);
            const data = res.data;
            
            let response = data?.message || data?.reply || data?.response || data?.result || data?.text;
            if (typeof response === 'object' && response !== null) {
                response = response.content || response.output || JSON.stringify(response, null, 2);
            }
            
            if (!response || response === '[object Object]') {
                return reply('✘ Received an empty response.');
            }
            
            await sock.sendMessage(m.chat, {
                text: `𖣘 *${selectedModel.name}*\n\n${response}\n\n_⚉ CRYSNOVA Gateway_`
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        } catch (err) {
            console.error('[AIWRITER CHAT]', err.message);
            reply(`${prefix}✘ Failed to get response from ${selectedModelname}.`);
        }
    }
};