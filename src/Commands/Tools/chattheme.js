'use strict';

const { bubblePayload, listBubblePresets, parseBubbleCustomization, resolveChatTarget } = require('./chat-customization');

module.exports = {
    name: 'chattheme',
    alias: ['solidtheme', 'doodletheme'],
    category: 'Tools',
    desc: 'Apply a solid-color chat theme with doodles enabled',
    adminOnly: false,
    groupOnly: false,
    usage: '.chattheme [jid/lid/group-link] <preset|list> [--dark|--light] [light=#... dark=#...]',
    execute: async (sock, m, { args = [], reply }) => {
        try {
            const resolved = await resolveChatTarget(sock, m, args);
            if (resolved.args.length === 1 && /^list$/i.test(resolved.args[0])) {
                return reply(`Available solid-color themes:\n${listBubblePresets().join(', ')}\n\nDoodles are always enabled by .chattheme.`);
            }
            const requested = resolved.args.join(' ').trim() || 'default';
            const solidColor = parseBubbleCustomization(resolved.args);
            if (!solidColor) return reply(`Unknown solid-color theme. Choose: ${listBubblePresets().join(', ')} or use .chattheme list.`);
            solidColor.isDoodleEnabled = true;
            await sock.sendMessage(resolved.target, bubblePayload(solidColor), { quoted: m });
            return reply(`Solid chat theme applied: ${requested.toLowerCase()} (doodles enabled)${resolved.target !== m.chat ? ` for ${resolved.target}` : ''}.`);
        } catch (error) {
            return reply(`✘ Solid chat theme update failed: ${error.message}`);
        }
    }
};
