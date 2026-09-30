const { withAppStateRecovery } = require('../../Utils/app-state');

module.exports = {
  name: 'clearchat',
  alias: ['clear', 'clr', 'wipe'],
  category: 'tools',
  desc: 'Wipe chat then start a new thread with status',
  reactions: {
    start: '🧹',
    success: '✨'
  },

  execute: async (sock, m) => {
    try {
      await withAppStateRecovery(sock, () => sock.chatModify({
        clear: true,
        lastMessages: [{
          key: m.key,
          messageTimestamp: m.messageTimestamp
        }]
      }, m.chat));

      await sock.sendMessage(m.chat, {
        text: '✦ _*clean*_'
      });
    } catch (err) {
      console.error('Wipe Logic Error:', err);
    }
  }
};
