'use strict';

const { getWallpaperUrl, resolveChatTarget, uploadImage } = require('./chat-customization');

function parseDimLevel(args) {
    const value = args.map(String).find(item => /^dim(?:level)?=/i.test(item));
    if (!value) return 0;
    const parsed = Number(value.split('=').slice(1).join('='));
    return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0;
}

module.exports = {
    name: 'chatbackground',
    alias: ['chatwallpaper', 'wallpaperchat'],
    category: 'Tools',
    desc: 'Change the chat wallpaper in a DM or group',
    adminOnly: false,
    groupOnly: false,
    usage: '.chatbackground [jid/lid/group-link] <image-url|list> [dim=0] or reply to an image',
    execute: async (sock, m, { args = [], reply, setGroupWallpaper, uploadWallpaper = uploadImage }) => {
        try {
            const resolved = await resolveChatTarget(sock, m, args);
            if (resolved.args.length === 1 && /^list$/i.test(resolved.args[0])) {
                return reply('Chat background supports direct http(s) image URLs, replied images, and dim=0 through dim=1.');
            }
            const url = await getWallpaperUrl(m, resolved.args, uploadWallpaper);
            if (!url) return reply('Send an image URL or reply to an image with .chatbackground. Optional: dim=0 to dim the wallpaper.');
            const wallpaperSetter = setGroupWallpaper || (await import('plogme')).setGroupWallpaper;
            if (typeof wallpaperSetter !== 'function') throw new Error('This Plogme version does not expose setGroupWallpaper.');
            await wallpaperSetter(sock, resolved.target, url, { dimLevel: parseDimLevel(resolved.args) });
            return reply(`Chat wallpaper updated${resolved.target !== m.chat ? ` for ${resolved.target}` : ''}.`);
        } catch (error) {
            return reply(`✘ Chat wallpaper failed: ${error.message}`);
        }
    }
};

module.exports.parseDimLevel = parseDimLevel;
