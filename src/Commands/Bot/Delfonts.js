/**
 * Command: .remfonts
 * Description: Deletes the botfont.json file (removes all saved fonts – global & group)
 * Usage: .remfonts
 * Requirements: 
 *   - Recommended: restrict to bot owner only (very destructive)
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, "../../../database/botfont.json");

module.exports = {
    name: 'delfonts',
    alias: ['remfonts', 'clearfonts', 'rmfonts'],
    desc: 'Delete botfont.json (removes all saved fonts)',
    category: 'tools',
    usage: `.remfonts`,

    // Strongly recommended: make this owner-only
    // isOwner: true,   // ← uncomment this in your command loader if you have owner check

    execute: async (sock, m, { reply }) => {
        try {
            if (!fs.existsSync(FILE)) {
                return reply('_*No botfont.json found — nothing to delete.*_');
            }

            // Optional: ask for confirmation (uncomment if you want safety)
            /*
            await reply('_*⚉ This will delete ALL saved fonts (global & groups).*_\n' +
                        'Reply *yes* to confirm.');
            // Add confirmation logic here if needed
            */

            fs.unlinkSync(FILE);

            await reply('_*✓ botfont.json deleted successfully.*_\n' +
                        'All custom fonts have been removed.\n' +
                        'Bot will now use default/no styling.');

            // Optional success reaction
            await sock.sendMessage(m.key.remoteJid, {
                react: {
                    text: '🗑️',
                    key: m.key
                }
            });

        } catch (error) {
            console.error('[REMFONTS ERROR]', error);

            let msg = '_*✘ Failed to delete botfont.json.*_';

            if (error.code === 'ENOENT') {
                msg += '\nFile does not exist.';
            } else if (error.code === 'EACCES') {
                msg += '\nPermission denied — check file/folder permissions.';
            }

            await reply(msg);
        }
    }
};
