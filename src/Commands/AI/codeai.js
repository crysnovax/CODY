const { request, pickText } = require('../../Plugin/prexzy');
module.exports = {
  name: 'codeai', alias: ['advancedcode','codegen'], category: 'AI', desc: 'Generate code with Prexzy prompt-to-code', usage: '.codeai <prompt> | <language>',
  execute: async (sock, m, { args, reply }) => {
    const raw = args.join(' ').trim(); if (!raw) return reply('ಠ_ಠ Describe the code you need.');
    const at = raw.lastIndexOf('|'); const prompt = (at < 0 ? raw : raw.slice(0, at)).trim(); const language = (at < 0 ? 'javascript' : raw.slice(at + 1).trim()) || 'javascript';
    try {
      await sock.sendMessage(m.chat, { react: { text: '💻', key: m.key } });
      const res = await request('/ai/prompttocode', { prompt, language }, { timeout: 120000 });
      const data = res.data || {}; if (!data.status || !data.code) throw new Error(data.error || `HTTP ${res.status}`);
      return sock.sendMessage(m.chat, { text: `𖣘 *${data.title || 'CODE GENERATOR'}*\n\n\`\`\`${String(data.language || language).toLowerCase()}\n${data.code}\n\`\`\`` }, { quoted: m });
    } catch (err) { console.error('[CODEAI]', err.message); return reply(`✘ Code generation failed\n${err.message}`); }
  }
};
