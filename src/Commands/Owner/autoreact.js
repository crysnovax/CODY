const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../../database/autoreact.json');

// Default emoji pool (fixed syntax)
const DEFAULT_EMOJIS = [
    '😂', '🔥', '👍', '❤️', '😍', '🎉', '👏', '🤔', '😎', '🥳', '✨', '💯', '🙏', '🐾', '⚠️', '💘', '🎲', '📰', '🗞️', '💌', '🤯', '🎊', '👌', '🛑', '😤', '📝', '😁', '🥰', '🥳', '😶‍🌫️', '😱', '🥱', '🤭', '😮‍💨', '😫', '😩', '🤢', '🤮', '😵‍💫', '🥴', '🙊', '💫', '💥', '❤️‍🔥', '👀', '🫂', '🗣️', '🙆', '🤳', '🖕'
];

// Load config
function loadConfig() {
    try {
        if (fs.existsSync(DB_PATH))
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch {}
    return { enabled: false, emojis: DEFAULT_EMOJIS };
}

function saveConfig(config) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(config, null, 2));
}

module.exports = {
    name: 'autoreact',
    alias: ['randomreact'],
    category: 'tools',
    desc: 'Auto‑react to every message with a random emoji',
    usage: `
.autoreact on/off
.autoreact list
.autoreact add <emoji>
.autoreact remove <emoji>
.autoreact reset`,

    execute: async (sock, m, { args, reply , prefix}) => {
        const config = loadConfig();
        const cmd = args[0]?.toLowerCase();

        // Toggle ON/OFF
        if (cmd === 'on') {
            config.enabled = true;
            saveConfig(config);
            return reply('_✓ Auto‑react enabled (random emoji on every message)._');
        }
        if (cmd === 'off') {
            config.enabled = false;
            saveConfig(config);
            return reply('_✓ Auto‑react disabled._');
        }

        // List current emojis
        if (cmd === 'list') {
            const emojis = config.emojis.join(' ');
            return reply(`${prefix}_Current emoji pool:_\n${emojis}\n\n_Total: ${configemojis.length}_`);
        }

        // Add emoji to pool
        if (cmd === 'add') {
            const emoji = args[1];
            if (!emoji || !/^\p{Emoji}$/u.test(emoji)) return reply('_✘ Provide a valid emoji._');
            if (config.emojis.includes(emoji)) return reply('_✘ Emoji already in pool._');
            config.emojis.push(emoji);
            saveConfig(config);
            return reply(`_✓ Added ${emoji} to pool._`);
        }

        // Remove emoji from pool
        if (cmd === 'remove') {
            const emoji = args[1];
            if (!emoji) return reply('_Usage: .autoreact remove <emoji>_');
            const index = config.emojis.indexOf(emoji);
            if (index === -1) return reply('_✘ Emoji not in pool._');
            config.emojis.splice(index, 1);
            saveConfig(config);
            return reply(`_✓ Removed ${emoji} from pool._`);
        }

        // Reset to default emojis
        if (cmd === 'reset') {
            config.emojis = [...DEFAULT_EMOJIS];
            saveConfig(config);
            return reply(`_✓ Reset to default emojis._`);
        }

        // Show help
        return reply(`${prefix}_Auto‑react is ${configenabled ? 'enabled' : 'disabled'}._\n\n` +
                     `Commands:\n.autoreact on/off\n.autoreact list\n.autoreact add 🎈\n.autoreact remove 🎈\n.autoreact reset`);
    },

    // Export helpers for message handler
    isEnabled: () => loadConfig().enabled,
    getRandomEmoji: () => {
        const config = loadConfig();
        const emojis = config.emojis;
        if (!emojis.length) return '👍';
        return emojis[Math.floor(Math.random() * emojis.length)];
    }
};
