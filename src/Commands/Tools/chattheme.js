'use strict';

const { BUBBLE_PRESETS, bubblePayload, parseBubbleCustomization } = require('./chat-customization');

module.exports = {
    name: 'chattheme',
    alias: ['solidtheme', 'doodletheme'],
    category: 'Tools',
    desc: 'Apply a solid-color chat theme with doodles enabled',
    adminOnly: false,
    groupOnly: false,
    usage: '.chattheme <preset> [light=#... dark=#... doodlelight=#... doodledark=#...]',
    execute: async (sock, m, { args = [], reply }) => {
        const requested = args.join(' ').trim() || 'default';
        const solidColor = parseBubbleCustomization(args);
        if (!solidColor) return reply(`Unknown solid-color theme. Choose: ${Object.keys(BUBBLE_PRESETS).join(', ')}.`);
        solidColor.isDoodleEnabled = true;
        try {
            await sock.sendMessage(m.chat, bubblePayload(solidColor), { quoted: m });
            return reply(`Solid chat theme applied: ${requested.toLowerCase()} (doodles enabled).`);
        } catch (error) {
            return reply(`✘ Solid chat theme update failed: ${error.message}`);
        }
    }
};
