const os = require('os');
const config = require('../../../settings/config');

module.exports = [{
    name: 'check',
    alias: [],
    category: 'Info',
    desc: 'Display bot statistics as poll result',
    usage: `.check`,
    reactions: { start: '📊', success: '📡' },
    
    execute: async (sock, m, { reply }) => {
        try {
            await sock.sendMessage(m.chat, { react: { text: '📊', key: m.key } });
            
            const botName = config.botname || process.env.BOTNAME || '```B⎔T```';
            
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);
            
            const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
            
            const memoryUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
            const memoryTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
            const cpuUsage = (os.loadavg()[0] * 10).toFixed(1);
            const msgCount = global.crysStats?.messages || 0;
            const cmdCount = global.crysStats?.commands || 0;
            const platform = os.platform();
            const nodeVersion = process.version;
            
            await sock.sendMessage(m.chat, {
                pollResult: {
                    name: `𝌆  ${botName.toUpperCase()} STATs 彡`,
                    votes: [
                        { name: `� Messages: ${msgCount.toLocaleString()}`, voteCount: Math.min(msgCount, 999) },
                        { name: `♧ Commands: ${cmdCount.toLocaleString()}`, voteCount: Math.min(cmdCount, 999) },
                        { name: `⎙ Memory: ${memoryUsed}MB / ${memoryTotal}GB`, voteCount: Math.floor(memoryUsed) },
                        { name: `☁︎  CPU: ${cpuUsage}%`, voteCount: Math.floor(cpuUsage) },
                        { name: `ⓘ Uptime: ${uptimeStr}`, voteCount: Math.floor(uptime / 3600) },
                        { name: `☢︎ Node: ${nodeVersion} | ${platform}`, voteCount: 1 }
                    ],
                    pollType: 0
                }
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { react: { text: '📡', key: m.key } });
            
        } catch (e) {
            console.error('[CHECK]', e.message);
            reply(`\`×͜× Check failed: ${e.message} ×͜×\``);
        }
    }
}];
