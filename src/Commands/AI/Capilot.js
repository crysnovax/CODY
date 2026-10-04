const { request, pickText, encodeParams } = require('../../Plugin/prexzy');
const states = new Map();
module.exports = {
  name: 'copilot', alias: ['ghost','aihelp'], category: 'AI', desc: 'Copilot-style coding and developer assistant',
  execute: async (sock, m, { args, reply }) => {
    const query = args.join(' ').trim();
    if (!query) return reply('ಠ_ಠ Provide a coding question or task.');
    const prompt = `You are GitHub Copilot-style assistant inside a WhatsApp bot. Help with code, debugging, architecture, and concise explanations. Prefer complete runnable code when requested. Use markdown code fences when useful. Do not claim to run code. User request: ${query}`;
    try {
      await sock.sendMessage(m.chat, { react: { text: '🤖', key: m.key } });
      const res = await request('/ai/askgpt5', encodeParams({ prompt, state: states.get(m.chat), model: 'qwen3.5-397b-a17b' }));
      const answer = pickText(res.data);
      if (res.data?.state) states.set(m.chat, res.data.state);
      if (!answer) throw new Error('empty response');
      return sock.sendMessage(m.chat, { text: `𖣘 *COPILOT AI*\n\n${answer}` }, { quoted: m });
    } catch (err) { console.error('[COPILOT]', err.message); return reply('✘ Copilot is temporarily unavailable.'); }
  }
};
