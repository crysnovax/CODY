'use strict';

const { sendFileCommandAction } = require('../Core/plogme');

module.exports = {
    name: 'send_file',
    alias: ['sendfile'],
    desc: 'Upload a workspace file through the verified CDN path and send it',
    category: 'Tools',
    usage: '.send_file <workspace-relative-path>',
    ownerOnly: true,
    execute: async (sock, m, { args = [], reply, sendMessage, cdnUpload }) => {
        const filePath = args.join(' ').trim();
        return sendFileCommandAction(sock, m, {
            reply,
            sendMessage: sendMessage || (typeof sock?.sendMessage === 'function' ? sock.sendMessage.bind(sock) : null),
            cdnUpload
        }, { path: filePath });
    }
};
