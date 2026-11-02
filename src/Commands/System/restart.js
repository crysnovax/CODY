module.exports = {
    name: 'restart',
    alias: ['reboot'],
    desc: 'Restart the bot',
    category: 'Owner',
    ownerOnly: true,
    reactions: { start: '♻️', success: '💨' },
    execute: async (sock, m, { reply }) => {
        await reply('_*♲ Restarting...*_');
        setTimeout(() => process.exit(0), 1500);
    }
};
