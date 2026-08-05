/**
 * Command: .lockgc
 * Description: Locks group settings — only admins can edit group info, add/remove members, change subject/desc, etc.
 * Usage: .lockgc
 */

module.exports = {
    name: 'lockgc',
    alias: ['lockgroup', 'gclock', 'lock', 'fulllock'],
    desc: 'Lock group settings (only admins can edit group info, add/remove members, etc.)',
    category: 'group',
    usage: `.lockgc`,

    execute: async (sock, m, { reply, isGroupAdmin }) => {
        const chatId = m.key.remoteJid;

        // Must be a group
        if (!chatId.endsWith('@g.us')) {
            return reply('`☠︎︎⟁⃝GROUP ONLY!℘`');
        }

        if (!isGroupAdmin && !m.key.fromMe) {
            return reply('`⟁⃝×͜× ADMIN ONLY!℘`');
        }

        try {
            const groupMetadata = await sock.groupMetadata(chatId);
            const botParticipant = groupMetadata.participants.find(p => p.id === sock.user.id);

            if (!botParticipant || !botParticipant.admin) {
                return reply('_*𓉤 Make me an admin first!*_');
            }

            // Lock group info edits — only admins can change subject/description
            // This uses groupSettingUpdate with 'locked'
            await sock.groupSettingUpdate(chatId, 'locked');

            await reply('`⟁⃝ADMINS ONLY CAN MANAGE GROUP!℘`');

            await sock.sendMessage(chatId, {
                react: { text: '🔒', key: m.key }
            });

        } catch (error) {
            console.error('[LOCKGC ERROR]', error);

            let errorMsg = '_*✘ Failed to lock the group.*_';

            if (error?.message?.includes('not-authorized') || error?.message?.includes('Unauthorized')) {
                errorMsg += '\n\nBot is **not admin** or lacks permission.';
            } else if (error?.message?.includes('rate-overlimit')) {
                errorMsg += '\n\nToo many requests — try again later.';
            }

            await reply(errorMsg);
        }
    }
};
