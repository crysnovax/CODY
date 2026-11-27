'use strict';

const { BUBBLE_PRESETS, bubblePayload, parseBubbleCustomization } = require('./chat-customization');

module.exports = {
    name: 'chatbubble',
    alias: ['bubble', 'bubbles'],
    category: 'Tools',
    desc: 'Change chat bubble colors in a DM or group',
    adminOnly: false,
    groupOnly: false,
    usage: '.chatbubble <preset> [light=#... dark=#... doodle=off]',
    execute: async (sock, m, { args = [], reply }) => {
        const requested = args.join(' ').trim() || 'default';
        const solidColor = parseBubbleCustomization(args);
        if (!solidColor) return reply(`Unknown bubble preset. Choose: ${Object.keys(BUBBLE_PRESETS).join(', ')}.`);
        try {
            await sock.sendMessage(m.chat, bubblePayload(solidColor), { quoted: m });
            return reply(`Chat bubbles changed to ${requested.toLowerCase()}.`);
        } catch (error) {
            return reply(`✘ Chat bubble update failed: ${error.message}`);
        }
    }
};
