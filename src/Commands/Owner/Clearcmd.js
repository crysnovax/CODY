const fs = require('fs');
const path = require('path');

const STICKER_CMD_FILE = path.join(__dirname, '../../../database/sticker_cmds.json');

const saveAndSync = (data) => {
    try {
        fs.writeFileSync(STICKER_CMD_FILE, JSON.stringify(data, null, 2));
        const setcmd = require('./setcmd.js');
        Object.keys(setcmd.stickerCmds).forEach(k => delete setcmd.stickerCmds[k]);
        Object.assign(setcmd.stickerCmds, data);
    } catch {}
};

module.exports = {
    name: 'clearcmd',
    alias: ['resetcmd', 'clrcmd'],
    desc: 'Delete all bound sticker commands',
    category: 'owner',
    ownerOnly: true,
    usage: `.clearcmd`,

    execute: async (sock, m, { reply }) => {
        try {
            // Clear the data
            saveAndSync({});
            return reply('`⎙ All sticker commands cleared`');
        } catch (err) {
            return reply('`✘ Failed to clear sticker commands`');
        }
    }
};
