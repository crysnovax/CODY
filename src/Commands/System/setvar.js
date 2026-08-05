const { setVar } = require('../../Plugin/configManager');
const fs   = require('fs');
const path = require('path');

const ENV_PATH = path.join(process.cwd(), '.env');

// Read current .env into a key-value map
function readEnv() {
    if (!fs.existsSync(ENV_PATH)) return {};
    const map = {};
    for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        map[k] = v;
    }
    return map;
}

// Write map back to .env preserving comments and blank lines
function writeEnv(map) {
    if (!fs.existsSync(ENV_PATH)) {
        // No .env yet — create from map
        const lines = Object.entries(map).map(([k, v]) => `${k}=${v}`).join('\n');
        fs.writeFileSync(ENV_PATH, lines + '\n');
        return;
    }

    const raw   = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
    const seen  = new Set();
    const out   = [];

    for (const line of raw) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            out.push(line);
            continue;
        }
        const idx = trimmed.indexOf('=');
        if (idx === -1) { out.push(line); continue; }
        const k = trimmed.slice(0, idx).trim();
        seen.add(k);
        // Replace value if key exists in map
        if (k in map) {
            out.push(`${k}=${map[k]}`);
        } else {
            out.push(line);
        }
    }

    // Append any new keys not already in file
    for (const [k, v] of Object.entries(map)) {
        if (!seen.has(k)) out.push(`${k}=${v}`);
    }

    fs.writeFileSync(ENV_PATH, out.join('\n'));
}

module.exports = {
    name: 'setvar',
    alias: ['sv'],
    desc: 'Set a config variable (saves to .env + runtime)',
    category: 'Owner',
    ownerOnly: true,
    reactions: { start: '⚙️', success: '👾' },

    execute: async (sock, m, { args, reply , prefix}) => {
        if (!args[0]) return reply(
            `Usage: .setvar KEY=value\n\nExamples:\n` +
            `• .setvar PREFIX=.\n` +
            `• .setvar BOT_NAME=ZEE BOT\n` +
            `• .setvar PUBLIC_MODE=true\n` +
            `• .setvar SUDO_NUMBERS=2348xxx,2349xxx`
        );

        // Support both KEY=value and KEY value formats
        const full = args.join(' ');
        let key, value;

        if (full.includes('=')) {
            const idx = full.indexOf('=');
            key   = full.slice(0, idx).trim().toUpperCase();
            value = full.slice(idx + 1).trim();
        } else {
            key   = args[0].toUpperCase();
            value = args.slice(1).join(' ').trim();
        }

        if (!key || value === '') return reply('_*⚉ Usage:*_ `.setvar KEY=value`');

        // 1. Save to runtime (immediate effect, no restart needed)
        setVar(key, value);

        // 2. Save to .env (persists across restarts)
        try {
            const env = readEnv();
            env[key]  = value;
            writeEnv(env);
            reply(`*${key}* = ${value}`);
        } catch (err) {
            reply(`${prefix}𓄄 *${key}* = ${value}\n\n_Runtime saved .env write failed: ${err.message}_`);
        }
    }
};
