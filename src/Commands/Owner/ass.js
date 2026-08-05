const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.cwd(), 'database', 'autosavestatus.json');

// Default config
const defaultConfig = {
    enabled: false,
    mode: 'dm',        // 'dm' = owner DM, 'chat' = specific chat, 'number' = specific WhatsApp number
    target: null,      // JID for chat mode, or phone number string for number mode
};

// Load config
let config = { ...defaultConfig };
try {
    if (fs.existsSync(CONFIG_PATH)) {
        config = { ...defaultConfig, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
    }
} catch {}

function saveConfig() {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Get owner JID
function getOwnerJid() {
    const num = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
    return num ? `${num}@s.whatsapp.net` : null;
}

module.exports = {
    name: 'ass',
    alias: ['autosave', 'autostatus'],
    desc: 'Auto‑save all statuses to a specified chat or DM',
    category: 'Owner',
    usage: '.ass on/off | .ass mode dm/chat/number | .ass set <number/chatJid> | .ass status',

    execute: async (sock, m, { args, reply , prefix}) => {
        const sub = args[0]?.toLowerCase();
        const value = args.slice(1).join(' ');

        // --- ON / OFF ---
        if (sub === 'on') {
            config.enabled = true;
            saveConfig();
            return reply('`✓ Auto Save Status ENABLED`');
        }
        if (sub === 'off') {
            config.enabled = false;
            saveConfig();
            return reply('`✘ Auto Save Status DISABLED`');
        }

        // --- MODE ---
        if (sub === 'mode') {
            const mode = value.toLowerCase();
            if (!['dm', 'chat', 'number'].includes(mode)) {
                return reply('_Invalid mode. Use: dm, chat, or number_');
            }
            config.mode = mode;
            saveConfig();
            return reply(`${prefix}Mode set to: *${modetoUpperCase()}*`);
        }

        // --- SET TARGET ---
        if (sub === 'set') {
            if (!value) return reply('_Provide a number (e.g., +234xxxxxxxx) or a chat JID_');
            let target = value.trim();
            if (config.mode === 'number') {
                target = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            } else if (config.mode === 'chat') {
                if (!target.includes('@')) target = target + '@g.us'; // assume group if missing
            }
            config.target = target;
            saveConfig();
            return reply(`Target set to: *${target}*`);
        }

        // --- STATUS ---
        if (sub === 'status') {
            const modeDisplay = config.mode.toUpperCase();
            let targetDisplay = 'None';
            if (config.target) {
                if (config.mode === 'number') targetDisplay = config.target.split('@')[0];
                else targetDisplay = config.target;
            }
            return reply(
                `*Auto Save Status*\n` +
                `Enabled: *${config.enabled ? 'ON' : 'OFF'}*\n` +
                `Mode: *${modeDisplay}*\n` +
                `Target: *${targetDisplay}*`
            );
        }

        // --- HELP ---
        return reply(
            `𖣘 *AUTO SAVE STATUS*\n\n` +
            `Commands:\n` +
            `.ass on          → Enable\n` +
            `.ass off         → Disable\n` +
            `.ass mode dm     → Save to owner DM\n` +
            `.ass mode chat   → Save to specific chat\n` +
            `.ass mode number → Save to a specific number\n` +
            `.ass set <target> → Set the chat JID or phone number\n` +
            `.ass status      → Show current config`
        );
    },

    // Exported config getter for use in status handler
    getConfig: () => config,
};
