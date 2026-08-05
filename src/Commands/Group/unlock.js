/**
 * Command: .unlockgc
 * Description: Unlocks the group — everyone can send messages, edit subject/desc (if permitted), etc.
 * Usage: .unlockgc
 * Requirements:
 *   - Must be used in a group
 *   - Bot must be an admin with permission to change group settings
 *   - Optional: restrict to group admins or bot owner
 */

module.exports = {
    name: 'unlockgc',
    alias: ['unlockgroup', 'gcunlock', 'unfulllock'],
    desc: 'Unlock group settings (allow everyone to send messages again)',
    category: 'group',
    usage: `.unlockgc`,

    execute: async (sock, m, { reply, isGroupAdmin }) => {
        const chatId = m.key.remoteJid;

       
        if (!chatId.endsWith('@g.us')) {
            return reply('_*✘ GROUP ONLY*_');
        }

       
        if (!isGroupAdmin && !m.key.fromMe) {
            return reply('_*⚉ Only group admins can unlock the group.*_');
        }

        try {
           
            const groupMetadata = await sock.groupMetadata(chatId);
            const botParticipant = groupMetadata.participants.find(p => p.id === sock.user.id);

            // Uncomment if you want to enforce bot is admin
            // if (!botParticipant || !botParticipant.admin) {
            //     return reply('_*𓉤 Not admin*_');
            // }

            // 3. Unlock the group
            await sock.groupSettingUpdate(chatId, 'not_announcement'); // Everyone can send messages again

            // Optional: re-apply subject & description (usually not needed, but consistent with lockgc)
            await sock.groupUpdateSubject(chatId, groupMetadata.subject);
            await sock.groupUpdateDescription(chatId, groupMetadata.desc || '');

            await reply('_*✓ Group unlocked successfully!*_\n\n' +
                        'Now **everyone** can:\n' +
                        '• Send messages\n' +
                        '• Edit subject/description (if they have permission)\n' +
                        '• Add/remove members (if they are admin)\n\n' +
                        'Group is back to normal mode.');

            // Success reaction
            await sock.sendMessage(chatId, {
                react: {
                    text: '🔓',
                    key: m.key
                }
            });

        } catch (error) {
            console.error('[UNLOCKGC ERROR]', error);

            let errorMsg = '_*✘ Failed to unlock the group.*_';

            if (error?.message?.includes('not-authorized') || error?.message?.includes('Unauthorized')) {
                errorMsg += '\n\nBot is **not admin** or lacks permission to change group settings.';
            } else if (error?.message?.includes('rate-overlimit')) {
                errorMsg += '\n\nToo many requests — try again in a few minutes.';
            }

            await reply(errorMsg);
        }
    }
};
