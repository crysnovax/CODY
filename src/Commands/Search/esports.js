/**
 * .esports — Live & upcoming eSports matches in your timezone
 */

const { getUserTimezone, getTimezone } = require('../Core/®-utils');

// Mock eSports schedule (replace with real API: PandaScore, Abios, etc.)
const ESPORTS_SCHEDULE = [
    { game: 'League of Legends', event: 'Worlds 2024', match: 'T1 vs Gen.G', time: '2024-11-02T14:00:00Z', timezone: 'UTC' },
    { game: 'CS2', event: 'BLAST Premier', match: 'FaZe vs NAVI', time: '2024-11-02T18:30:00Z', timezone: 'UTC' },
    { game: 'Dota 2', event: 'The International', match: 'Team Spirit vs Gaimin', time: '2024-11-03T10:00:00Z', timezone: 'UTC' },
    { game: 'Valorant', event: 'Champions', match: 'Sentinels vs PRX', time: '2024-11-03T16:00:00Z', timezone: 'UTC' },
    { game: 'Overwatch 2', event: 'World Cup', match: 'USA vs Korea', time: '2024-11-02T20:00:00Z', timezone: 'UTC' }
];

const formatMatchTime = (matchTime, userTimezone) => {
    const userDate = new Date(matchTime);
    const diffMs = userDate.getTime() - Date.now();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    let status;
    if (diffMs < 0) {
        status = '🔴 LIVE';
    } else if (diffHrs < 1) {
        status = `🟡 ${diffMins}m`;
    } else if (diffHrs < 24) {
        status = `🟢 ${diffHrs}h ${diffMins}m`;
    } else {
        const days = Math.floor(diffHrs / 24);
        status = `⚪ ${days}d`;
    }
    
    const timeStr = userDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: userTimezone
    });
    
    const dateStr = userDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: userTimezone
    });
    
    return { timeStr, dateStr, status, isLive: diffMs < 0 };
};

module.exports = {
    name: 'esports',
    alias: ['esport'],
    desc: 'eSports matches in your timezone',
    category: 'Entertainment',
    usage: '.esports [game] (e.g., .esports, .esports LOL, .esports CS2)',
    
    reactions: { start: '🎮', success: '🏆', live: '🔴' },

    execute: async (sock, m, { args, reply }) => {
        try {
            const userId = m.sender || m.key?.participant || m.key?.remoteJid;
            const userRegion = getUserTimezone(userId);
            const userTimezone = getTimezone(userRegion) || 'Africa/Lagos';
            
            const now = new Date();
            
            const requestedGame = args.join(' ').toLowerCase();
            
            // Filter matches
            let matches = ESPORTS_SCHEDULE;
            if (requestedGame) {
                matches = matches.filter(m => 
                    m.game.toLowerCase().includes(requestedGame) ||
                    m.event.toLowerCase().includes(requestedGame)
                );
            }
            
            if (matches.length === 0) {
                return reply('⚉ No matches found for that game');
            }
            
            // Sort by time
            matches.sort((a, b) => new Date(a.time) - new Date(b.time));
            
            let response = `╭─❍ *ESPORTS* 🎮\n`;
            response += `│ 📍 ${userRegion} Time\n`;
            response += `│ 🕐 ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: userTimezone })}\n`;
            response += `│\n`;
            
            let liveCount = 0;
            
            for (const match of matches.slice(0, 5)) {
                const { timeStr, dateStr, status, isLive } = formatMatchTime(match.time, userTimezone);
                
                if (isLive) liveCount++;
                
                const gameEmoji = {
                    'League of Legends': '⚔️',
                    'CS2': '🔫',
                    'Dota 2': '🐉',
                    'Valorant': '🎯',
                    'Overwatch 2': '🤖'
                }[match.game] || '🎮';
                
                response += `│ ${gameEmoji} ${match.game}\n`;
                response += `│    ${match.match}\n`;
                response += `│    ${dateStr} ${timeStr} | ${status}\n`;
                response += `│\n`;
            }
            
            if (liveCount > 0) {
                response += `│ 🔴 ${liveCount} match(es) LIVE now!\n`;
                response += `│\n`;
            }
            
            response += `│ 💡 Use: .esports <game>\n`;
            response += `│ Games: LOL, CS2, Dota, Valorant\n`;
            response += `╰────────────────`;
            
            await reply(response);
            
        } catch (err) {
            console.error('[ESPORTS ERROR]', err);
            reply('⚉ Failed to fetch matches');
        }
    }
};
