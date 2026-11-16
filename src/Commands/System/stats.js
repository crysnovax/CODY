// stats.js — rewritten clean so every var is read live and shows what it's
// actually configured to. No more obfuscated mess. @crysnovax—FIX06-08-26
const { getVar, allVars } = require('../../Plugin/configManager');
const { getFont } = require('../Bot/botfont.js');
const path = require('path');
const fs = require('fs');
const { getBotTimezone } = require('../../Utils/timezone');

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
        const tz = getBotTimezone();
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

        const rows = [
            ['Bot Name', botName], ['Number', botNum || '—'], ['Mode', publicMode],
            ['Prefix', `[ ${prefix} ]`], ['Font', font], ['Language', lang], ['Timezone', tz],
            ['Uptime', uptimeFromStats()], ['Messages', String(global.crysStats?.messages || 0)],
            ['Commands', String(global.crysStats?.commands || 0)],
            ['Auto Read', on(getVar('AUTO_READ', false))], ['Anti Call', on(getVar('ANTI_CALL', true))],
            ['Cmd React', on(getVar('CMD_REACT', getVar('AUTO_REACT', true)))],
            ['Auto React', on(require('../Owner/autoreact.js').isEnabled())],
            ['Fake Typing', on(getVar('FAKE_TYPING', 'off'))], ['Status View', on(getVar('AUTO_STATUS_VIEW', true))],
            ['Status Like', on(getVar('AUTO_STATUS_LIKE', true))], ['Auto Record', on(getVar('AUTO_RECORDING', false))],
            ['DND', on(getVar('DND', false))], ['Save Mode', on(getVar('SAVE_MODE', false))],
            ['Auto Approve', on(getVar('AUTO_APPROVE', false))], ['Pack Name', getVar('PACK_NAME') || 'not set'],
            ['Anti Delete', anti('antidelete.json')], ['Anti Edit', anti('antiedit.json')],
            ['Anti Word', anti('antiword.json')], ['Anti Tag', anti('antitag.json')],
            ['Anti GM', anti('antigm.json')], ['Anti Link', anti('antilink.json')],
            ['Anti Spam', anti('antispam.json')], ['Anti Image', anti('antiimage.json')],
            ['Anti Video', anti('antivideo.json')], ['Anti Audio', anti('antiaudio.json')],
            ['No Sticker', anti('nosticker.json')],
        ];

        const vars = allVars();
        const varKeys = Object.keys(vars);
        if (varKeys.length) {
            for (const k of varKeys) {
                let v = vars[k];
                if (v && typeof v === 'object') {
                    try { v = JSON.stringify(v); } catch { v = '[object]'; }
                }
                v = String(v);
                if (v.length > 42) v = v.slice(0, 42) + '…';
                rows.push([k, v]);
            }
        }

        return sock.sendRichAIResponse(chat, {
            table: { title: '⌘ B⎔T STATISTICS', headers: ['Setting', 'Value'], rows },
        }, m);
    }
};
