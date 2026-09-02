const { getVar, setVar } = require('../../Plugin/configManager');

module.exports = {
    name: 'autoread',
    alias: ['setread'],
    desc: 'Toggle auto read messages',
    category: 'Owner',
    sudoOnly: true,
    reactions: { start: '🐾', success: '💬' },

    execute: async (sock, m, { args, reply }) => {
        const current = getVar('AUTO_READ', true);
        const groupCurrent = getVar('AUTO_READ_GROUP', false);

        if (!args[0]) {
            return reply(
                `👁️ *Auto Read*\n\n` +
                `Private: ${current !== false ? '💬 ON' : '✘ OFF'}\n` +
                `Groups: ${groupCurrent ? '💬 ON' : '✘ OFF'}\n\n` +
                `Usage:\n• .autoread on\n• .autoread off\n• .autoread group on\n• .autoread group off`
            );
        }

        if (args[0].toLowerCase() === 'group') {
            const mode = String(args[1] || '').toLowerCase();
            if (!['on', 'off'].includes(mode)) return reply('Usage: .autoread group on | .autoread group off');
            setVar('AUTO_READ_GROUP', mode === 'on');
            return reply(`🥏 Group auto read: *${mode.toUpperCase()}*`);
        }

        if (args[0].toLowerCase() === 'on') {
            setVar('AUTO_READ', true);
            return reply('🥏 Auto read: *ON*\n_Bot will mark all messages as read_');
        }

        if (args[0].toLowerCase() === 'off') {
            setVar('AUTO_READ', false);
            return reply('😩 Auto read: *OFF*');
        }

        reply('Usage: .autoread on | .autoread off');
    }
};
