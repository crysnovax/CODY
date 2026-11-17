module.exports = {
    name: 'restart',
    alias: ['reboot'],
    desc: 'Restart the bot',
    category: 'Owner',
    ownerOnly: true,
    reactions: { start: '♻️', success: '💨' },
    execute: async (sock, m, { reply }) => {
        await reply('_*♲ Restarting...*_');
        require('../../Plugin/processControl').requestRestart('manual', 1500);
    }
};
