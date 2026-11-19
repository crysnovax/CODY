const fs = require('fs');
const fetch = require('node-fetch');

// ── CONFIG ────────────────────────────
const GITHUB_TOKEN = 'ghp_nx5xxxxxxxxxxxxxxxxxxxxxxxx'; // Replace with your actual token
const sessions = new Map();

// ── PLUGIN ───────────────────────────
module.exports = {
    name: 'gist',
    alias: ['github', 'paste', 'code'],
    desc: 'Create GitHub Gists from code snippets',
    category: 'tools',
    usage: '.gist start [filename] | .gist code=<snippet> | .gist push [description] | .gist cancel | .gist status',
    owner: true,

    execute: async (sock, m, { args, reply, prefix }) => {
        const chatId = m.chat;
        const userId = m.sender;
        const sessionKey = `${chatId}_${userId}`;
        const sub = args[0]?.toLowerCase();

        if (!GITHUB_TOKEN || GITHUB_TOKEN.includes('your_actual_token_here')) {
            return reply('⚠️ GitHub token not set! Edit plugin and add your token.');
        }

        // ── HELP ──
        if (!sub || sub === 'help') {
            return reply(`📝 *GIST PLUGIN HELP*

Commands:
• ${prefix}gist start [filename] - Start a new session
• ${prefix}gist code=<snippet> - Add code to session
• ${prefix}gist push [description] - Commit all snippets to GitHub
• ${prefix}gist status - Check session info
• ${prefix}gist cancel - Abort session

Workflow:
1 ${prefix}gist start myscript.js
2. ${prefix}gist code=console.log("Hello")
3. Repeat step 2 for multiple snippets
4. ${prefix}gist push My description`);
        }

        // ── START SESSION ──
        if (sub === 'start') {
            if (sessions.has(sessionKey)) return reply(`⚠️ Session already active! Use \`${prefix}gist push\` or \`${prefix}gist cancel\``);
            const filename = args[1] || `snippet_${Date.now()}.txt`;
            sessions.set(sessionKey, { filename, code: [], startedAt: Date.now() });
            return reply(`✅ Session started with file: ${filename}\n➡️ Add snippets with \`${prefix}gist code=<your code>\``);
        }

        // ── ADD CODE ──
        if (args[0]?.startsWith('code=')) {
            const session = sessions.get(sessionKey);
            if (!session) return reply(`❌ No active session. Start one with \`${prefix}gist start\``);

            const snippet = args.join(' ').replace(/^code=/i, '').trim();
            if (!snippet) return reply('⚠️ No code detected after `code=`');

            session.code.push(snippet);
            sessions.set(sessionKey, session);

            return reply(`➕ Snippet added! Total snippets: ${sessioncode.length}`);
        }

        // ── STATUS ──
        if (sub === 'status') {
            const session = sessions.get(sessionKey);
            if (!session) return reply('ℹ️ No active session');

            return reply(
                `📊 *Gist Session Status*\n` +
                `📁 File: ${session.filename}\n` +
                `🧩 Snippets: ${session.code.length}\n` +
                `⏱️ Active: ${Math.floor((Date.now() - session.startedAt)/1000/60)} min`
            );
        }

        // ── CANCEL ──
        if (sub === 'cancel') {
            if (!sessions.has(sessionKey)) return reply('ℹ️ No session to cancel');
            sessions.delete(sessionKey);
            return reply('🗑️ Session cancelled — all snippets discarded');
        }

        // ── PUSH TO GITHUB ──
        if (sub === 'push') {
            const session = sessions.get(sessionKey);
            if (!session) return reply('❌ No active session to push');
            if (!session.code.length) return reply('❌ Nothing to push. Add snippets first using `.gist code=<snippet>`');

            await reply('🚀 Creating GitHub Gist...');

            const fullCode = session.code.join('\n\n// ── Next Snippet ──\n\n');
            const description = args.slice(1).join(' ') || `Code shared via CRYSNOVA AI - ${session.filename}`;
            const filename = session.filename.includes('.') ? session.filename : `${session.filename}.txt`;

            const gistData = {
                description,
                public: false,
                files: { [filename]: { content: fullCode } }
            };

            try {
                const res = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'CRYSNOVA-AI'
                    },
                    body: JSON.stringify(gistData)
                });

                if (!res.ok) {
                    const errJson = await res.json();
                    throw new Error(errJson.message || `GitHub error ${res.status}`);
                }

                const gist = await res.json();
                sessions.delete(sessionKey);

                return reply(
                    `✅ *Gist Created!*\n\n` +
                    `📁 File: ${filename}\n` +
                    `📝 Description: ${description}\n` +
                    `🔗 URL: ${gist.html_url}\n` +
                    `📄 Raw: ${gist.files[filename].raw_url}`
                );
            } catch (err) {
                console.error('[GIST PUSH ERROR]', err);
                return reply(`❌ Failed to create Gist: ${err?.message || err}`);
            }
        }

        return reply(`⚠️ Unknown subcommand. Use \`${prefix}gist help\``);
    }
};
