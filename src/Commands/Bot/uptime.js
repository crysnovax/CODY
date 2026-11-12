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

            const uptimeStr = `${days}d –${hours}hr –${minutes}m –${seconds}s..`;

            await sock.sendInteractiveContactCard(m.chat, {
                title: `♲ Cody AIㅤㅤㅤ${currentTime}`,
                body: `\`\`\`⚉ ${uptimeStr}\`\`\`\n\`『${timezone}』\``,
                footer: 'Test environment',
                buttonParams: {
                    signup_id: 'test-signup-001',
                    subscription_timestamp: '1793181029',
                    promo_code: 'TEST_ONLY'
                }
            });
        } catch (err) {
            console.error('[UPTIME ERROR]', err);
            reply('⚉ Failed to get uptime');
        }
    }
};
