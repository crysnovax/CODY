const { request, pickText } = require('../../Plugin/prexzy');
module.exports = {
  name: 'code', alias: ['aicode','coder','dev'], category: 'AI', desc: 'Generate runnable code or a CODY command',
  execute: async (sock, m, { text, reply }) => {
    if (!text?.trim()) return reply('✘ Provide a coding prompt.');
    try {
      await sock.sendMessage(m.chat, { react: { text: '💻', key: m.key } });
      const prompt = `Return a complete, correct answer for this coding request. If a WhatsApp/CODY command is requested, return a CommonJS module.exports command compatible with sock, m, and reply. Otherwise return the requested code. Include a short explanation only when useful. Request: ${text}`;
      const res = await request('/ai/askgpt5', { prompt }, { timeout: 120000 });
      const answer = pickText(res.data); if (!answer) throw new Error(`HTTP ${res.status}`);
      return sock.sendMessage(m.chat, { text: answer }, { quoted: m });
    } catch (err) { console.error('[CODE]', err.message); return reply(`✘ Error generating code\n${err.message}`); }
  }
};
