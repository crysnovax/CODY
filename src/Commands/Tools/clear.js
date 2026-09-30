module.exports = {
  name: 'clearchat',
  alias: ['clear', 'clr','wipe'],
  category: 'tools',
  desc: 'Wipe chat then start a new thread with status',
   // ⭐ Reaction config
    reactions: {
        start: '🧹',
        success: '✨'
    },
    
  execute: async (sock, m, { reply }) => {
    try {
      if (!m.key.fromMe) return reply('✘ This command is owner-only.');
      const confirmation = await reply('✦ _*Clearing this chat locally…*_');
      const target = { key: m.key, messageTimestamp: m.messageTimestamp };
      await sock.chatModify({ delete: true, lastMessages: [target] }, m.chat);
      return confirmation;
    } catch (err) {
      console.error('[CLEAR ERROR]', err?.message || err);
      return reply(`✘ Clear failed: ${err?.message || 'WhatsApp did not accept the request'}`);
    }
  }};
