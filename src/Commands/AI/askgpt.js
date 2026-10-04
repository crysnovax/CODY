const { request, pickText, encodeParams } = require('../../Plugin/prexzy');
const states = new Map();
module.exports = { name:'askgpt', alias:['gpt5','ask'], category:'AI', desc:'AskGPT5 assistant', execute: async (sock,m,{args,reply}) => {
  const prompt=args.join(' ').trim(); if(!prompt) return reply('⚉ Ask me something.');
  try { const r=await request('/ai/askgpt5',encodeParams({prompt,state:states.get(m.chat)})); const t=pickText(r.data); if(r.data?.state) states.set(m.chat,r.data.state); if(!t) throw Error(`HTTP ${r.status}`); return sock.sendMessage(m.chat,{text:`✦ *ASKGPT5*\n\n${t}`},{quoted:m}); } catch(e){ console.error('[ASKGPT5]',e.message); return reply('✘ AskGPT5 is temporarily unavailable.'); }
}};
