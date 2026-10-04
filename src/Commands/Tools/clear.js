const { isMissingAppStateKeyError, withAppStateRecovery } = require('../../Utils/app-state');

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
      if (isMissingAppStateKeyError(err)) {
        return sock.sendMessage(m.chat, {
          text: '✘ WhatsApp app-state key is unavailable. The bot must reconnect and receive a fresh key; run .clear again after the connection is stable.'
        });
      }
      await sock.sendMessage(m.chat, { text: `✘ Clear failed: ${err?.message || 'WhatsApp rejected the chat clear request'}` });
    }
  }
};
