const fs = require('fs');
const path = require('path');

const STICKER_CMD_FILE = path.join(__dirname, '../../../database/sticker_cmds.json');

let stickerCmds = {};

const loadStickerCmds = () => {
    try {
        if (fs.existsSync(STICKER_CMD_FILE)) {
            stickerCmds = JSON.parse(fs.readFileSync(STICKER_CMD_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('[STICKER CMD LOAD ERROR]', e.message);
        stickerCmds = {};
    }
};

const saveStickerCmds = () => {
    try {
        fs.writeFileSync(STICKER_CMD_FILE, JSON.stringify(stickerCmds, null, 2));
    } catch (e) {
        console.error('[STICKER CMD SAVE ERROR]', e.message);
    }
};

loadStickerCmds();

module.exports = {
    name: 'setcmd',
    alias: ['bindcmd', 'stickercmd'],
    desc: 'Bind a command to a sticker',
    category: 'owner',
    ownerOnly: true,
    usage: `.setcmd <command> (reply to sticker)`,

    execute: async (sock, m, { args, reply, prefix }) => {
        const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const stickerData = quotedMsg?.stickerMessage;
        
        if (!stickerData) {
            return reply(
                `╭─❍ *SETCMD*\n│\n│ ✘ Reply to a sticker\n│ ⚉ Usage: ${prefix}setcmd <command>\n│\n│ 𓄄 Example: ${prefix}setcmd ping\n╰──────────────────`
            );
        }

        if (!args[0]) {
            return reply('╭─❍ *SETCMD*\n│\n│ ✘ Provide a command\n╰──────────────────');
        }

        const fileSha256 = stickerData.fileSha256;
        
        if (!fileSha256) {
            return reply('╭─❍ *SETCMD*\n│\n│ ✘ Could not get sticker hash\n╰──────────────────');
        }

                            const hash = Buffer.isBuffer(fileSha256) 
                            ? fileSha256.toString('hex') 
                            : String(fileSha256);
        

        const command = args.join(' ');
        const cmdName = command.split(/\s+/)[0];

        // ... (everything before stays the same)

        stickerCmds[hash] = command;
        saveStickerCmds();

        return reply(`\`⎙ Bounded to ${cmdName}\``);
    }
};

module.exports.stickerCmds = stickerCmds;
module.exports.loadStickerCmds = loadStickerCmds;

