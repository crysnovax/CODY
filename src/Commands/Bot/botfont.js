'use strict';
const fs = require('fs');
const path = require('path');
const { sendFontList, resolveFont, styles } = require('../Tools/fontCatalog');
const FILE = path.join(__dirname, '../../../database/botfont.json');
function loadDB() { try { if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {} return { global: null, groups: {} }; }
function saveDB(data) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
function getFont(jid) { const db = loadDB(); return jid?.endsWith('@g.us') && db.groups[jid] ? db.groups[jid] : db.global; }
module.exports = {
  name: 'botfont', alias: ['setfont'], category: 'Tools',
  execute: async (sock, m, { args, reply }) => {
    const jid = m.key.remoteJid;
    if (!args[0] || args[0].toLowerCase() === 'list') return sendFontList(sock, m.chat, m, 'Bot Fonts');
    const selected = resolveFont(args);
    if (!selected) return reply('𓀀 Use: .botfont list\n.botfont <number>\n.botfont group <number>');
    const db = loadDB();
    if (args[0].toLowerCase() === 'group') {
      if (!m.isGroup) return reply('This option is only available in groups.');
      db.groups[jid] = selected; saveDB(db); return reply(`_✓ Group font set to: ${selected}_`);
    }
    db.global = selected; saveDB(db); return reply(`_*✦ Global bot font set to: ${selected}*_`);
  }, getFont, styles,
};
