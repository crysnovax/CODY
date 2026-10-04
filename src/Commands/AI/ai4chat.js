const { request, pickText, encodeParams } = require('../../Plugin/prexzy');
module.exports = { name:'ai4chat', alias:['aichat4'], category:'AI', desc:'AI4Chat assistant', execute: async (sock,m,{args,reply}) => {
  const prompt=args.join(' ').trim(); if(!prompt) return reply('⚉ Ask AI4Chat something.');
  try { const r=await request('/ai/ai4chat',encodeParams({prompt})); const t=pickText(r.data); if(!t || /invalid request/i.test(t)) throw Error('Invalid or empty response'); return sock.sendMessage(m.chat,{text:`✦ *AI4CHAT*\n\n${t}`},{quoted:m}); } catch(e){ console.error('[AI4CHAT]',e.message); return reply('✘ AI4Chat could not answer that request.'); }
}};
