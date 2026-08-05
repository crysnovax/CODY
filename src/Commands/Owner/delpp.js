/**
 * Command: .delpp
 * Description: Removes (deletes) your own WhatsApp profile picture
 * Usage: .delpp
 */

module.exports = {
    name: 'delpp',
    alias: ['removepp', 'deletepp', 'rmpp'],
    desc: 'Remove your WhatsApp profile picture',
    category: 'utility',
    usage: `.delpp`,

    execute: async (sock, m, { args, reply }) => {
        const chatId = m.key.remoteJid;

        try {
          
            await sock.removeProfilePicture(sock.user.id);  
            await reply(`_*✓ success!*_.`);

          
            await sock.sendMessage(chatId, {
                react: {
                    text: '🗑️',
                    key: m.key
                }
            });

        } catch (error) {
            console.error('[DELPP ERROR]', error);

            let errorMsg = '_*𓄄 Failed to remove profile picture.*_';

            if (error?.message?.includes('not authorized')) {
                errorMsg += ' You may need to be the bot owner or check permissions.';
            } else if (error?.message?.includes('no profile picture')) {
                errorMsg += ' You don’t have a profile picture set right now.';
            }

            await reply(errorMsg);
        }
    }
};
