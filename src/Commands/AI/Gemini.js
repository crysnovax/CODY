const { request, pickText, errorText, encodeParams } = require('../../Plugin/prexzy');
const sessions = new Map();
module.exports = {
  name: 'gemini', alias: ['gchat','gemgpt'], category: 'AI', desc: 'Gemini AI assistant with session memory',
  execute: async (sock, m, { args, reply }) => {
    const prompt = args.join(' ').trim();
    if (!prompt) return reply('⚉ Ask Gemini something.');
    try {
      await sock.sendMessage(m.chat, { react: { text: '🤖', key: m.key } });
      const response = await request('/ai/gemini', encodeParams({ prompt, session_id: sessions.get(m.chat) }));
      let text = pickText(response.data);
      if (response.data?.session_id) sessions.set(m.chat, response.data.session_id);
      if (!text || /invalid request/i.test(text)) {
        const fallback = await request('/ai/askgpt5', encodeParams({ prompt, state: sessions.get(m.chat) }));
        text = pickText(fallback.data);
        if (fallback.data?.state) sessions.set(m.chat, fallback.data.state);
      }
      if (!text) throw new Error(errorText(response));
      return sock.sendMessage(m.chat, { text: `✦ *GEMINI*\n\n${text}` }, { quoted: m });
    } catch (err) { console.error('[GEMINI]', err.message); return reply('✘ Gemini is temporarily unavailable.'); }
  }
};
