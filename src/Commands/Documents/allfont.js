const axios = require('axios');

module.exports = [{
    name: 'allfonts',
    alias: ['allfont'],
    category: 'Converter',
    desc: 'Generate fancy text styles',
    usage: `.styletext <text>`,
    reactions: { start: '✨', success: '🎨' },
    
    execute: async (sock, m, { args, reply }) => {
        const text = args.join(' ').trim();
        if (!text) return reply('`×͜× Provide text to style ×͜×`');
        
        try {
            await sock.sendMessage(m.chat, { 
                react: { text: '✨', key: m.key } 
            });
            
            const res = await axios.get(`https://apis.prexzyvilla.site/tools/allstyles?text=${encodeURIComponent(text)}`);
            const styles = res.data?.data || res.data?.results || res.data || {};
            
            if (!styles || Object.keys(styles).length === 0) {
                return reply(`\`×͜× No styles generated ×͜×\``);
            }
            
            let output = `✨ *TEXT STYLES FOR: ${text}*\n\n`;
            
            Object.entries(styles).slice(0, 20).forEach(([name, styled]) => {
                output += `*${name}:* ${styled}\n`;
            });
            
            output += `\n_*crysnovax*_`;
            
            await sock.sendMessage(m.chat, { text: output }, { quoted: m });
            await sock.sendMessage(m.chat, { 
                react: { text: '🎨', key: m.key } 
            });
            
        } catch (err) {
            console.error('[STYLETEXT]', err.message);
            reply('`×͜× Style text failed ×͜×`');
        }
    }
}];
