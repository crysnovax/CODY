// gtuser.js — GitHub user profile lookup. Uses the official GitHub REST API
// (verified live — no auth needed for public user data, 60 req/hr limit).
// @crysnovax—FIX14-08-26
const axios = require('axios');
const { formatBotDate } = require('../../Utils/timezone');

const API = 'https://api.github.com';
const HEADERS = { Accept: 'application/json', 'User-Agent': 'CRYSNOVA-Bot' };

// Picks the most common language across the user's repos.
function topLanguage(repos) {
    const counts = {};
    for (const r of repos) {
        if (!r.language) continue;
        counts[r.language] = (counts[r.language] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted.length ? sorted[0][0] : 'N/A';
}

function fmtCount(n) {
    const v = Number(n) || 0;
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return String(v);
}

module.exports = {
    name: 'githubinfo',
    alias: ['gituser', 'githubuser', 'dev'],
    desc: 'Get GitHub user profile information',
    category: 'Search',
    usage: `${prefix}githubinfo <username>`,
    reactions: { start: '🐙', success: '🎭', error: '🏗️' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const username = (args[0] || '').trim();

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
                axios.get(`${API}/users/${encodeURIComponent(username)}`, { timeout: 10000, headers: HEADERS }),
                axios.get(`${API}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, { timeout: 10000, headers: HEADERS })
            ]);

            const user = userRes.data;
            const repos = reposRes.data;

            const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
            const topRepos = repos
                .filter(r => (r.stargazers_count || 0) > 0)
                .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
                .slice(0, 3);

            const joined = formatBotDate(user.created_at, 'en-GB', {
                day: '2-digit', month: 'short', year: 'numeric'
            });

            const topReposLine = topRepos.length
                ? topRepos.map(r => `        ⭐ ${r.stargazers_count} — ${r.name}`).join('\n')
                : '        — none yet';

            await reply(
                `╭─❍ *GITHUB PROFILE*\n` +
                `│\n` +
                `│ 👤 *${user.name || user.login}* ${user.type === 'Organization' ? '(org)' : ''}\n` +
                `│ 🐙 @${user.login}\n` +
                (user.bio ? `│ 📝 ${user.bio.length > 70 ? user.bio.slice(0, 67) + '...' : user.bio}\n` : '') +
                `│\n` +
                `│ 📊 *Stats*\n` +
                `│    📦 Repos      : ${user.public_repos}\n` +
                `│    ⭐ Stars      : ${fmtCount(totalStars)}\n` +
                `│    👥 Followers  : ${fmtCount(user.followers)}\n` +
                `│    👣 Following  : ${fmtCount(user.following)}\n` +
                `│    💻 Top lang   : ${topLanguage(repos)}\n` +
                (user.location ? `│    📍 Location  : ${user.location}\n` : '') +
                (user.company ? `│    🏢 Company   : ${user.company}\n` : '') +
                (user.blog ? `│    🔗 Blog      : ${user.blog}\n` : '') +
                `│    🕐 Joined    : ${joined}\n` +
                `│\n` +
                `│ ✨ *Top repos*\n` +
                topReposLine + '\n' +
                `│\n` +
                `│ 🔗 ${user.html_url}\n` +
                `╰──────────────────`
            );

            await sock.sendMessage(m.chat, { react: { text: '🎭', key: m.key } });
        } catch (error) {
            console.error('[GITHUB ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } });

            const status = error.response?.status;
            if (status === 404) {
                reply(`\`✘ User not found: "${username}"\``);
            } else if (status === 403) {
                reply('`✘ GitHub API rate limited. Try again later.`');
            } else {
                reply('`✘ Failed to fetch GitHub info — is the username correct?`');
            }
        }
    }
};
