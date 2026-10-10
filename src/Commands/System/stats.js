// stats.js — rewritten clean so every var is read live and shows what it's
// actually configured to. No more obfuscated mess. @crysnovax—FIX06-08-26
const { getVar, allVars } = require('../../Plugin/configManager');
const { getFont } = require('../Bot/botfont.js');
const path = require('path');
const fs = require('fs');

const readDb = (name) => {
    try {
        return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'database', name), 'utf8'));
    } catch {
        return {};
    }
};

const on = (v) => {
    if (v === undefined || v === null || v === '') return '—';
    if (v === true || v === 'true' || v === 'on' || v === 'yes' || v === 1 || v === '1') return '✓ ON';
    if (v === false || v === 'false' || v === 'off' || v === 'no' || v === 0 || v === '0') return '✘ OFF';
    return String(v);
};

const fmtMs = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m ${s % 60}s`;
};

const row = (label, value, width = 22) =>
    `❏◦ ${label}${'·'.repeat(Math.max(1, width - String(label).length))} ${value}\n`;

function uptimeFromStats() {
    const start = global.crysStats?.startTime || Date.now() - process.uptime() * 1000;
    return fmtMs(Date.now() - start);
}

module.exports = {
    name: 'stats',
    alias: ['botinfo', 'status', 'st'],
    desc: 'Show full bot statistics and every configured variable',
    category: 'System',
    ownerOnly: true,
    reactions: { start: '📊', success: '❔' },

    execute: async (sock, m, { reply }) => {
        const chat = m.chat;
        const font = getFont(chat) || 'default';
        const prefix = getVar('PREFIX', '.');
        const tz = getVar('TIMEZONE', 'Africa/Lagos');
        const lang = getVar('BOT_LANG', getVar('BOTLANG', 'en')) || 'en';
        const cfg = require('../../../settings/config');
        const botName = cfg.settings?.title || 'CODY AI';
        const botNum = (sock.user?.id || '').split(':')[0];
        const publicMode = cfg.status?.public ? '_*Public 彡*_' : '_*Private*_';

        const anti = (file) => {
            const data = readDb(file);
            const g = data[chat];
            return g?.enabled ? '✓ ON' : '✘ OFF';
        };

        let text = `⌘ ⿻ *B⎔T STATISTICS* ⿻ ⌘\n\n`;
        text += `𒆜 ಠ_ಠ *BⓘT INFO*\n𓀀\n`;
        text += row('Bot Name', botName);
        text += row('Number', botNum || '—');
        text += row('Mode', publicMode);
        text += row('Prefix', `[ ${prefix} ]`);
        text += row('Font', font);
        text += row('Language', lang);
        text += row('Timezone', tz);
        text += `𒆜 ⚔ *PERFORMANCE*\n𓅓\n`;
        text += row('Uptime', uptimeFromStats());
        text += row('Messages', String(global.crysStats?.messages || 0));
        text += row('Commands', String(global.crysStats?.commands || 0));
        text += `𒆜 ⌘ *CORE TOGGLES*\n𓄂ᬼ𓆃\n`;
        text += row('Auto Read', on(getVar('AUTO_READ', true)));
        text += row('Anti Call', on(getVar('ANTI_CALL', true)));
        text += row('Cmd React', on(getVar('CMD_REACT', getVar('AUTO_REACT', true))));
        text += row('Auto React', on(require('../Owner/autoreact.js').isEnabled()));
        text += row('Fake Typing', on(getVar('FAKE_TYPING', 'off')));
        text += row('Status View', on(getVar('AUTO_STATUS_VIEW', true)));
        text += row('Status Like', on(getVar('AUTO_STATUS_LIKE', true)));
        text += row('Auto Record', on(getVar('AUTO_RECORDING', false)));
        text += row('DND', on(getVar('DND', false)));
        text += row('Save Mode', on(getVar('SAVE_MODE', false)));
        text += row('Auto Approve', on(getVar('AUTO_APPROVE', false)));
        text += row('Pack Name', getVar('PACK_NAME') || 'not set');
        text += `𒆜 彡 *PROTECTION* (this chat)\n𓅓\n`;
        text += row('Anti Delete', anti('antidelete.json'));
        text += row('Anti Edit', anti('antiedit.json'));
        text += row('Anti Word', anti('antiword.json'));
        text += row('Anti Tag', anti('antitag.json'));
        text += row('Anti GM', anti('antigm.json'));
        text += row('Anti Link', anti('antilink.json'));
        text += row('Anti Spam', anti('antispam.json'));
        text += row('Anti Video', anti('antivideo.json'));
        text += row('Anti Audio', anti('antiaudio.json'));
        text += row('No Sticker', anti('nosticker.json'));

        const vars = allVars();
        const varKeys = Object.keys(vars);
        if (varKeys.length) {
            text += `𒆜 ✪ *RUNTIME VARS* (${varKeys.length})\n𓅓\n`;
            for (const k of varKeys) {
                let v = vars[k];
                if (v && typeof v === 'object') {
                    try { v = JSON.stringify(v); } catch { v = '[object]'; }
                }
                v = String(v);
                if (v.length > 42) v = v.slice(0, 42) + '…';
                text += row(k, v, 26);
            }
        }

        text += `\n⌘ ⿻ *𝗖𝗥𝗬𝗦𝗡☉𝗩𝗔 𝗔𝗜* ⿻ ⌘`;
        return reply(text);
    }
};
