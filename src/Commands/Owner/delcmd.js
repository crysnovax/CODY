const fs = require('fs');
const path = require('path');

const STICKER_CMD_FILE = path.join(__dirname, '../../../database/sticker_cmds.json');

const loadFresh = () => {
    try {
        if (fs.existsSync(STICKER_CMD_FILE)) {
            return JSON.parse(fs.readFileSync(STICKER_CMD_FILE, 'utf8'));
        }
    } catch {}
    return {};
};

const saveAndSync = (data) => {
    try {
        fs.writeFileSync(STICKER_CMD_FILE, JSON.stringify(data, null, 2));
        const setcmd = require('./setcmd.js');
        Object.keys(setcmd.stickerCmds).forEach(k => delete setcmd.stickerCmds[k]);
        Object.assign(setcmd.stickerCmds, data);
    } catch {}
};

module.exports = {
    name: 'delcmd',
    alias: ['uncmd', 'unbind'],
    desc: 'Unbind command from sticker',
    category: 'owner',
    ownerOnly: true,
    usage: `.delcmd (reply to sticker)`,

    execute: async (sock, m, { reply }) => {
        const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const stickerData = quotedMsg?.stickerMessage;
        
        if (!stickerData) {
            return reply('`✘ Reply to a bound sticker`');
        }

        const fileSha256 = stickerData.fileSha256;
        if (!fileSha256) {
            return reply('`✘ Could not get sticker hash`');
        }

        const hash = Buffer.isBuffer(fileSha256) 
            ? fileSha256.toString('hex') 
            : String(fileSha256);

        const stickerCmds = loadFresh();

        if (!stickerCmds[hash]) {
            return reply('`✘ This sticker has no bound command`');
        }

        const removedCmd = stickerCmds[hash].split(/\s+/)[0];
        delete stickerCmds[hash];
        saveAndSync(stickerCmds);

        return reply(`\`⎙ Unbounded from ${removedCmd}\``);
    }
};
