const { setVar } = require('../../Plugin/configManager');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(process.cwd(), '.env');
const VIDEO_URL = 'https://cdn.crysnovax.link/files/1783469167623-6d58c43c-68b4-41ce-87ab-c0da1f615b28.mp4';
const IMAGE_URL = 'https://cdn.crysnovax.link/files/1783544348569-450d330b-87ee-478f-821e-c76d5730e741.jpeg';

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
        const lines = Object.entries(map).map(([k, v]) => `${k}=${v}`).join('\n');
        fs.writeFileSync(ENV_PATH, lines + '\n');
        return;
    }

    const raw = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
    const seen = new Set();
    const out = [];

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
        if (k in map) {
            out.push(`${k}=${map[k]}`);
        } else {
            out.push(line);
        }
    }

    for (const [k, v] of Object.entries(map)) {
        if (!seen.has(k)) out.push(`${k}=${v}`);
    }

    fs.writeFileSync(ENV_PATH, out.join('\n'));
}

module.exports = {
    name: 'togglepp',
    alias: [],
    desc: 'Flip MENU_URL between the default video and image',
    category: 'Owner',
    ownerOnly: true,
    reactions: { start: '🍁', success: '🍂' },

    execute: async (sock, m, { reply , prefix}) => {
        const current = readEnv().MENU_URL;
        const next = current === IMAGE_URL ? VIDEO_URL : IMAGE_URL;

        setVar('MENU_URL', next);

        try {
            const env = readEnv();
            env.MENU_URL = next;
            writeEnv(env);
        } catch (err) {
            return reply(`${prefix}𓄄 MENU_URL set to runtime, but env write failed: ${err.message}`);
        }

        reply(`✪ *MENU_URL* → ${next === VIDEO_URL ? 'video (mp4)' : 'image (jpeg)'}`);
    }
};
