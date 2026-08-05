const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(process.cwd(), 'database', 'autoupdate.json');

// Load setting
function getAutoUpdateSetting() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).enabled === true;
        }
    } catch {}
    return false; // default off
}

// Save setting
function setAutoUpdateSetting(enabled) {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ enabled: !!enabled }, null, 2));
}

module.exports = {
    name: 'autoupdate',
    alias: ['autoupd', 'autoupgrade'],
    desc: 'Toggle automatic updates on every bot restart',
    category: 'Owner',
    owner: true,
    usage: '.autoupdate on/off/status',

    execute: async (sock, m, { args, reply , prefix}) => {
        const sub = args[0]?.toLowerCase();

        if (sub === 'on') {
            setAutoUpdateSetting(true);
            return reply('`✓ Auto‑Update ENABLED — bot will update on every restart`');
        }

        if (sub === 'off') {
            setAutoUpdateSetting(false);
            return reply('`✘ Auto‑Update DISABLED`');
        }

        if (sub === 'status') {
            const enabled = getAutoUpdateSetting();
            return reply(`Auto‑Update is currently: *${enabled ? 'ON' : 'OFF'}*`);
        }

        return reply(`${prefix}𖣘 *AUTO‑UPDATE*\n\nUsage:\nautoupdate on\n.autoupdate off\n.autoupdate status`);
    },

    // Export getter for use in startup
    getAutoUpdateSetting
};
