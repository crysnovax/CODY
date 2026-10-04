const { request, pickText, encodeParams } = require('../../Plugin/prexzy');
module.exports = { name:'aiapk', alias:['apkai'], category:'AI', desc:'AIAPK assistant with optional model and mode', execute: async (sock,m,{args,reply}) => {
  const prompt=args.join(' ').trim(); if(!prompt) return reply('⚉ Provide a prompt.');
  try { const r=await request('/ai/aiapk',encodeParams({prompt,mode:'chat',model:'default'})); const t=pickText(r.data); if(!t) throw Error(r.data?.error || `HTTP ${r.status}`); return sock.sendMessage(m.chat,{text:`✦ *AIAPK*\n\n${t}`},{quoted:m}); } catch(e){ console.error('[AIAPK]',e.message); return reply('✘ AIAPK is temporarily unavailable.'); }
}};
