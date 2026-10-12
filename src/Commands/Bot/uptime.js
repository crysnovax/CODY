const { formatBotTime, getBotTimezone } = require('../../Utils/timezone');

module.exports = {
    name: 'uptime',
    alias: ['up'],
    desc: 'Show bot uptime with your local time',
    category: 'Info',
    reactions: { start: '📡', success: '🐾' },

    execute: async (sock, m, { reply }) => {
        try {
            const timezone = getBotTimezone();
            const currentTime = formatBotTime(new Date(), 'en-US', {
                hour: 'numeric', minute: '2-digit', hour12: true,
            });

            // Calculate uptime using process.uptime() in seconds
            const uptimeSeconds = Math.floor(process.uptime());
            const days = Math.floor(uptimeSeconds / 86400);
            const hours = Math.floor((uptimeSeconds % 86400) / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const seconds = uptimeSeconds % 60;
            
            const uptimeStr = `${days}d-${hours}h-${minutes}m-${seconds}s`;
            
            const message = 
                `╭─❍📡 *UPTIME!*\n` +
                `│ ❏ \`${uptimeStr}\`\n` +
                `│ ⚉   _online_\n` +
                `╰─ 𓄄 \`${currentTime}[${timezone}]\``;
            
            await reply(message);
        } catch (err) {
            console.error('[UPTIME ERROR]', err);
            reply('⚉ Failed to get uptime');
        }
    }
};
