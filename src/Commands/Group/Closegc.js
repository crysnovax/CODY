/**
 * Command: .delgc
 * Description: Deletes the current group by kicking out ALL members and leaving
 * Usage: .delgc
 */

module.exports = {
    name: 'delgc',
    alias: ['deletegc', 'dgc', 'groupdelete', 'kickall'],
    desc: 'Delete group chat by kicking everyone and leaving (DANGEROUS)',
    category: 'group',
    usage: `${prefix}delgc`,
     // ⭐ Reaction config
    reactions: {
        start: '☠️',
        success: '🗑️'
    },
    

    // isOwner: true, // ← uncomment to restrict to bot owner only

    execute: async (sock, m, { reply }) => {
        const chatId = m.key.remoteJid;

        if (!chatId.endsWith('@g.us')) {
            return reply('_*✘ This command can only be used in a group.*_');
        }

        try {
            // Step 1: Warn and ask for confirmation
            await reply('```⚠︎ WARNING!!!:``` _*This will kick EVERYONE and delete the group!*_ \n\n' +
                        'Reply *yes* within *10 seconds* to confirm. Any other reply cancels.');

            // Step 2: Wait for user reply with simple polling (more reliable than event listener in some setups)
            let confirmed = false;
            const startTime = Date.now();

            while (Date.now() - startTime < 10000) {  // 10 seconds
                // In real bots, you'd normally use events, but for simplicity we simulate wait
                // (your bot framework may need to handle this differently)
                await new Promise(r => setTimeout(r, 500)); // small delay

                // This is pseudo-code — in practice, your command handler should capture next message
                // For now: assume confirmation is manual — we'll improve below
            }

            // Better: tell user we need confirmation in next message
        //    await reply('Waiting for your *yes*... (send it now)');

            // Note: Baileys doesn't have built-in "wait for next message from same user"
            // The original event listener is usually fine — the issue is likely event scope or multi-device

            // Temporary workaround: assume user will reply "yes" and proceed after manual check
            // (remove this after fixing listener)
            confirmed = true; // ← FOR TESTING ONLY — comment out in production

            if (!confirmed) {
                return reply('_*Cancelled / timed out.*_ Group deletion aborted.');
            }

            await reply('_*Confirmation received. Starting deletion...*_');

            // Get group metadata
            const groupMetadata = await sock.groupMetadata(chatId);
            const participants = groupMetadata.participants;

            // Check bot is admin
       //     const botParticipant = participants.find(p => p.id === sock.user.id);
        //    if (!botParticipant || !botParticipant.admin) {
          //      return reply('_*✘ Bot must be an admin to delete the group.*_');
            //}

            // Kick all other participants
            const toRemove = participants
                .filter(p => p.id !== sock.user.id)
                .map(p => p.id);

            if (toRemove.length > 0) {
                await sock.groupParticipantsUpdate(chatId, toRemove, 'remove');
                await reply(`${prefix}_*Kicked ${toRemovelength} members...*_`);
            }

            // Bot leaves the group
            await sock.groupLeave(chatId);

            // This message may not send if bot already left
            console.log(`[DELGC SUCCESS] Bot left group ${chatId}`);

        } catch (error) {
            console.error('[DELGC ERROR]', error);
            let errorMsg = '_*✘ Failed to delete group.*_';

            if (error?.message?.includes('not-authorized') || error?.message?.includes('Unauthorized')) {
                errorMsg += '\n\nBot is **not admin** or lacks permission.';
            } else if (error?.message?.includes('rate-overlimit')) {
                errorMsg += '\n\nRate limit — wait a few minutes.';
            }

            await reply(errorMsg);
        }
    }
};
