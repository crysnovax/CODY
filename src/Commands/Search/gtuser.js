const axios = require('axios');

module.exports = {
    name: 'githubinfo',
    alias: ['gituser', 'dev'],
    desc: 'Get GitHub user profile information',
    category: 'Search',
    usage: `.githubinfo <username>`,
    reactions: { start: '🐙', success: '🎭', error: '🏗️' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const username = args[0]?.trim();
        
        if (!username) {
            return reply(
                `╭─❍ *GITHUB INFO*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}githubinfo <username>\n│\n` +
                `│ ✪ *Examples:*\n` +
                `│ ${prefix}githubinfo crysnovax\n` +
                `│ ${prefix}githubinfo itsliaaa\n` +
                `│ ${prefix}githubinfo torvalds\n│\n` +
                `│ 🐙 *GitHub Profile Stats*\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '🐙', key: m.key } });
        await reply(`\`🐙 Fetching: ${username}...\``);

        try {
            const [userRes, reposRes] = await Promise.all([
                axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, {
                    timeout: 10000,
                    headers: { 'Accept': 'application/json', 'User-Agent': 'CRYSNOVA-Bot' }
                }),
                axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100`, {
                    timeout: 10000,
                    headers: { 'Accept': 'application/json', 'User-Agent': 'CRYSNOVA-Bot' }
                })
            ]);

            const user = userRes.data;
            const repos = reposRes.data;

            // Calculate total stars
            const totalStars = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
            const topLang = repos.map(r => r.language).filter(Boolean);
            const mostUsedLang = topLang.sort((a, b) => 
                topLang.filter(v => v === b).length - topLang.filter(v => v === a).length
            )[0] || 'N/A';

            const tableData = [
                ['👤 Name', user.name || username],
                ['🐙 Username', `@${user.login}`],
                ['📝 Bio', (user.bio || 'No bio').length > 60 ? user.bio.slice(0, 57) + '...' : (user.bio || 'No bio')],
                ['📊 Public Repos', user.public_repos],
                ['⭐ Total Stars', totalStars],
                ['👥 Followers', user.followers],
                ['👤 Following', user.following],
                ['💻 Top Language', mostUsedLang],
                ['🏢 Company', user.company || 'N/A'],
                ['📍 Location', user.location || 'N/A'],
                ['🐦 Twitter', user.twitter_username || 'N/A'],
                ['📅 Joined', new Date(user.created_at).toLocaleDateString()],
                ['🌐 Profile', user.html_url]
            ];

            await sock.sendMessage(m.chat, {
                headerText: `## 🐙 ${user.login}`,
                contentText: '---',
                title: '📊 GitHub Profile',
                table: tableData,
                footerText: '💡 Powered by GitHub API'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🎭', key: m.key } });

        } catch (error) {
            console.error('[GITHUB ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } });
            
            if (error.response?.status === 404) {
                reply(`\`✘ User not found: "${username}"\``);
            } else if (error.response?.status === 403) {
                reply('`✘ GitHub API rate limited. Try again later.`');
            } else {
                reply('`✘ Failed to fetch GitHub info`');
            }
        }
    }
};
