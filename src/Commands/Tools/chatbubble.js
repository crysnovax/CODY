'use strict';

const { bubblePayload, listBubblePresets, parseBubbleCustomization, resolveChatTarget } = require('./chat-customization');

module.exports = {
    name: 'chatbubble',
    alias: ['bubble', 'bubbles'],
    category: 'Tools',
    desc: 'Change chat bubble colors in a DM or group',
    adminOnly: false,
    groupOnly: false,
    usage: '.chatbubble [jid/lid/group-link] <preset|list> [--dark|--light] [light=#... dark=#...]',
    execute: async (sock, m, { args = [], reply }) => {
        try {
            const resolved = await resolveChatTarget(sock, m, args);
            if (resolved.args.length === 1 && /^list$/i.test(resolved.args[0])) {
                return reply(`Available bubble presets:\n${listBubblePresets().join(', ')}`);
            }
            const requested = resolved.args.join(' ').trim() || 'default';
            const solidColor = parseBubbleCustomization(resolved.args);
            if (!solidColor) return reply(`Unknown bubble preset. Choose: ${listBubblePresets().join(', ')} or use .chatbubble list.`);
            await sock.sendMessage(resolved.target, bubblePayload(solidColor), { quoted: m });
            return reply(`Chat bubbles changed to ${requested.toLowerCase()}${resolved.target !== m.chat ? ` for ${resolved.target}` : ''}.`);
        } catch (error) {
            return reply(`✘ Chat bubble update failed: ${error.message}`);
        }
    }
};
