'use strict';

module.exports = {
    name: 'reqloc',
    alias: ['requestloc', 'requestlocation'],
    desc: 'Request a live location from the chat',
    category: 'Tools',
    adminOnly: false,
    groupOnly: false,
    usage: '.reqloc',

    execute: async (sock, m, { reply }) => {
        try {
            await sock.sendMessage(m.chat, { requestLocation: true });
        } catch (error) {
            return reply(`✘ Failed to request location: ${error?.message || error}`);
        }
    }
};
