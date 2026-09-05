/**
 * Command: .delgpp
 * Description: Removes (deletes) the current group's profile picture (group icon)
 * Usage: .delgpp
 * Requirements: 
 *   - Must be used in a group
 *   - Bot must be an admin in the group
 *   - Bot must have permission to edit group info
 */

module.exports = {
    name: 'delgpp',
    alias: ['removegpp', 'deletegpp', 'rmgpp',],
    desc: 'Remove the current group\'s profile picture',
    category: 'group',
    usage: `${prefix}delgpp`,

    execute: async (sock, m, { reply, isGroupAdmin }) => {
        const chatId = m.key.remoteJid;

      
        if (!chatId.endsWith('@g.us')) {
            return reply('_*✘ GROUP ONLY*_');
        }

      
         if (!isGroupAdmin && !m.key.fromMe) {   // or check your owner list
            return reply('_*✘ Only group admins can use this command*_.');
         }

        try {
          
            // In Baileys, removeProfilePicture() with group JID deletes the group icon
            await sock.removeProfilePicture(chatId);

            // 4. Success message + reaction
            await reply('🗑️ *Group profile picture removed successfully.*');

            await sock.sendMessage(chatId, {
                react: {
                    text: '🗑️',
                    key: m.key
                }
            });

        } catch (error) {
            console.error('[DELGPP ERROR]', error);

            let errorMsg = '𓄄 Failed to remove group profile picture.';

            if (error?.message?.includes('not-authorized') || error?.message?.includes('Unauthorized')) {
                errorMsg += '\n\nThe bot is *not an admin* or doesn’t have permission to change group info.';
            } else if (error?.message?.includes('no profile picture') || error?.message?.includes('not found')) {
                errorMsg += '\n\nThis group doesn’t have a profile picture set right now.';
            } else if (error?.message?.includes('no-id') || error?.message?.includes('Illegal')) {
                errorMsg += '\n\nBaileys version issue — make sure you’re using the latest plogme.';
            }

            await reply(errorMsg);
        }
    }
};
