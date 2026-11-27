'use strict';

module.exports = {
    name: 'cancelreqloc',
    alias: ['cancelrequestloc', 'cancelrequestlocation'],
    desc: 'Cancel a live-location request',
    category: 'Tools',
    adminOnly: false,
    groupOnly: false,
    usage: '.cancelreqloc (reply to the live-location message)',

    execute: async (sock, m, { reply, liveLocationMessage }) => {
        const key = liveLocationMessage?.key || m.quoted?.key;
        if (!key) return reply('Reply to the live-location message with .cancelreqloc.');
        try {
            await sock.sendMessage(m.chat, {
                requestLocationUpdate: { key, cancel: true }
            });
        } catch (error) {
            return reply(`✘ Failed to cancel location request: ${error?.message || error}`);
        }
    }
};
