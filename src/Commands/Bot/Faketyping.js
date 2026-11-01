const { getVar, setVar } = require('../../Plugin/configManager');

module.exports = {
    name: 'faketyping',
    alias: ['typing'],
    desc: 'Control fake typing behavior',
    category: 'Owner',
    sudoOnly: true,
    reactions: { start: '⌨️', success: '📝' },

    execute: async (sock, m, { args, reply }) => {
        const current = getVar('FAKE_TYPING', 'cmd');
        const currentMode = current === true || ['all', 'true', 'on'].includes(String(current).toLowerCase())
            ? 'all'
            : ['cmd', 'command', 'commands'].includes(String(current).toLowerCase()) ? 'cmd' : 'off';

        if (!args[0]) {
            const status =
                currentMode === 'all' ? '_*❏◦ ON (all messages)✓*_' :
                currentMode === 'cmd' ? '_*■⋆⁩⁩ ON (commands only)✓*_' :
                                    '_*ಠ_ಠ OFF*_';
            return reply(
                `⌨️ *Fake Typing*\n\n` +
                `Status: ${status}\n\n` +
                `Usage:\n` +
                `• .typing on — fire on all messages\n` +
                `• .typing cmd — fire on commands only\n` +
                `• .typing off — disabled`
            );
        }

        const input = args.join(' ').toLowerCase().trim();

        if (['on', 'all', 'true'].includes(input)) {
            setVar('FAKE_TYPING', 'all');
            return reply('_*❏◦ Fake typing*_: *ON* _(all messages)_');
        }

        if (['cmd', 'command', 'commands', 'on cmd', 'on command', 'on commands'].includes(input)) {
            setVar('FAKE_TYPING', 'cmd');
            return reply('_*■⋆⁩⁩ Fake typing*_: *ON* _(commands only)_');
        }

        if (input === 'off' || input === 'false') {
            setVar('FAKE_TYPING', false);
            return reply('_*ಠ_ಠ Fake typing*_: *OFF*');
        }

        return reply('ಥ⁠‿⁠ಥ _*Usage: .typing on | .typing cmd | .typing off*_');
    }
};
