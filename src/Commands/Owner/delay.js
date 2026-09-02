'use strict';

const { delayDemo } = require('../../../Bug/delay-demo');

function parseDelay(value = '10s') {
    const match = String(value).trim().toLowerCase().match(/^(\d{1,4})(s|m)$/);
    if (!match) return null;
    const amount = Number(match[1]);
    const milliseconds = amount * (match[2] === 'm' ? 60_000 : 1_000);
    return milliseconds > 0 && milliseconds <= 300_000 ? milliseconds : null;
}

module.exports = {
    name: 'delay',
    alias: ['delaydemo'],
    desc: 'Wait briefly and send a harmless local demonstration result',
    category: 'Owner',
    ownerOnly: true,
    usage: '.delay [1-300 seconds or 1-5 minutes]',
    reactions: { start: '⏳', success: '✅', error: '❌' },
    execute: async (sock, m, { args, reply }) => {
        const requested = args[0] || '10s';
        const delayMs = parseDelay(requested);
        if (!delayMs) return reply('Usage: .delay <1-300s|1-5m>');

        await sock.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
        await delayDemo(m.chat, delayMs);
        await reply(`Safe delay demonstration completed after ${requested}. No payload was relayed or executed.`);
        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    }
};

module.exports.parseDelay = parseDelay;
