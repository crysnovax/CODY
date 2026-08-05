/**
 * Command: .dellang
 * Description: Deletes the language preference file (lang_prefs.json)
 *              Removes all saved languages – global & group
 * Usage: .dellang
 * Requirements:
 *   - Recommended: restrict to bot owner only (very destructive)
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, "../../../database/lang_prefs.json");

module.exports = {
    name: 'dellang',
    alias: ['remlang', 'clearlang', 'rmlang'],
    desc: 'Delete lang_prefs.json (removes all saved language preferences)',
    category: 'tools',
    usage: `.dellang`,

    // Strongly recommended: make this owner-only
    // isOwner: true,   // ← uncomment this in your command loader if you have owner check

    execute: async (sock, m, { reply }) => {
        try {
            if (!fs.existsSync(FILE)) {
                return reply('_*No language preference file found — nothing to delete.*_');
            }

            // Optional: ask for confirmation (uncomment if you want safety)
            /*
            await reply('_*⚉ This will delete ALL saved language preferences (global & groups).*_\n' +
                        'Reply *yes* to confirm.');
            // Add confirmation logic here if needed
            */

            fs.unlinkSync(FILE);

            await reply('_*✓ Language preference file deleted successfully.*_\n' +
                        'All custom language settings have been removed.\n' +
                        'Bot will now use original/auto-detected language.');

            // Optional success reaction
            await sock.sendMessage(m.key.remoteJid, {
                react: {
                    text: '🗑️',
                    key: m.key
                }
            });

        } catch (error) {
            console.error('[DELLANG ERROR]', error);

            let msg = '_*✘ Failed to delete language preference file.*_';

            if (error.code === 'ENOENT') {
                msg += '\nFile does not exist.';
            } else if (error.code === 'EACCES') {
                msg += '\nPermission denied — check file/folder permissions.';
            }

            await reply(msg);
        }
    }
};
