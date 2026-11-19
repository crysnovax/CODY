// ── quickreply.js ────────────────────────────────────────────────
const config = require('../../../settings/config');
const fs = require('fs');
const path = require('path');

const BOT_NAME = config.botname || process.env.BOTNAME || 'CRYSNOVA';
const STORE_PATH = path.join(__dirname, '../../../data/quickreplies.json');

// ── Local store helpers ────────────────────────────────────────────
const loadStore = () => {
    try {
        if (fs.existsSync(STORE_PATH)) return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    } catch {}
    return {};
};

const saveStore = (data) => {
    try {
        fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
        fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch {}
};

// ── Format one quick reply entry ───────────────────────────────────
const formatEntry = (shortcut, entry) =>
`❒ - *Short* ⇆ ${shortcut}
✆ - *Reply* ⇆ ${entry.message}
ⓘ - *ID* ⇆ ${entry.timestamp}`;

const USAGE = `\`\`\`✐ QUICK REPLY\`\`\`

ⓘ  *.quickreply* — show this guide
❒ • *.quickreply add [shortcut] [message]*
❒ • *.quickreply delete [id]*
❒ • *.quickreply list*`;

module.exports = {
    name: 'quickreply',
    alias: ['qr', 'quickr'],
    desc: 'Manage business quick replies',
    category: 'Business',
    owner: true,
    usage: '.quickreply [add|delete|list]',

    execute: async (sock, m, { args, reply }) => {
        const action = args[0]?.toLowerCase();
        if (!action) return reply(USAGE);

        try {
            await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });

            // ── list ───────────────────────────────────────────────
            if (action === 'list') {
                const store = loadStore();
                const entries = Object.entries(store);

                if (entries.length === 0) {
                    return reply('✘ No quick replies saved yet.\n_Use *.quickreply add [shortcut] [message]*_');
                }

                const lines = entries.map(([shortcut, entry]) => formatEntry(shortcut, entry)).join('\n\n');

                return await sock.sendMessage(m.chat, {
                    text: `\`\`\`✐ QUICK REPLY\`\`\`\n\n${lines}`,
                    footer: `⚉ ${BOT_NAME} • ${entries.length} saved`
                }, { quoted: m });
            }

            // ── add ────────────────────────────────────────────────
            if (action === 'add') {
                const shortcut = args[1];
                const message = args.slice(2).join(' ');

                if (!shortcut || !message) {
                    return reply('✘ Usage: *.quickreply add [shortcut] [message]*');
                }

                const timestamp = String(Math.floor(Date.now() / 1000));

                await sock.addOrEditQuickReply({ shortcut, message, timestamp });

                // Save to local store
                const store = loadStore();
                store[shortcut] = { message, timestamp };
                saveStore(store);

                return await sock.sendMessage(m.chat, {
                    text: `\`\`\`✐ QUICK REPLY\`\`\`\n\n${formatEntry(shortcut, { message, timestamp })}`,
                    footer: `⚉ ${BOT_NAME} • Added`
                }, { quoted: m });
            }

            // ── delete ─────────────────────────────────────────────
            if (action === 'delete') {
                const timestamp = args[1];
                if (!timestamp) return reply('✘ Usage: *.quickreply delete [id]*\n_Get the ID from *.quickreply list*_');

                await sock.removeQuickReply(timestamp);

                // Remove from local store
                const store = loadStore();
                const shortcut = Object.keys(store).find(k => store[k].timestamp === timestamp);
                if (shortcut) delete store[shortcut];
                saveStore(store);

                return await sock.sendMessage(m.chat, {
                    text: `𓃵 *Quick Reply Deleted*\n\nⓘ - *ID* ⇆ ${timestamp}${shortcut ? `\n❒ - *Short* ⇆ ${shortcut}` : ''}`,
                    footer: `⚉ ${BOT_NAME} Business`
                }, { quoted: m });
            }

            return reply(USAGE);

        } catch (err) {
            console.error('[QUICKREPLY]', err.message);
            reply(`✘ ${err?.message || err}`);
        }
    }
};
