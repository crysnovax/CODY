'use strict';

const { getWallpaperUrl, uploadImage } = require('./chat-customization');

function parseDimLevel(args) {
    const value = args.map(String).find(item => /^dim(?:level)?=/i.test(item));
    if (!value) return 0;
    const parsed = Number(value.split('=').slice(1).join('='));
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0;
}

module.exports = {
    name: 'background',
    alias: ['chatwallpaper', 'wallpaperchat'],
    category: 'Tools',
    desc: 'Change the chat wallpaper in a DM or group',
    adminOnly: false,
    groupOnly: false,
    usage: '.background <image-url> [dim=0] or reply to an image',
    execute: async (sock, m, { args = [], reply, setGroupWallpaper, uploadWallpaper = uploadImage }) => {
        try {
            const url = await getWallpaperUrl(m, args, uploadWallpaper);
            if (!url) return reply('Send an image URL or reply to an image with .background. Optional: dim=0 to dim the wallpaper.');
            const wallpaperSetter = setGroupWallpaper || (await import('plogme')).setGroupWallpaper;
            if (typeof wallpaperSetter !== 'function') throw new Error('This Plogme version does not expose setGroupWallpaper.');
            await wallpaperSetter(sock, m.chat, url, { dimLevel: parseDimLevel(args) });
            return reply('Chat wallpaper updated.');
        } catch (error) {
            return reply(`✘ Chat wallpaper failed: ${error.message}`);
        }
    }
};

module.exports.parseDimLevel = parseDimLevel;
