'use strict';
const { getVar, allVars } = require('../../Plugin/configManager');
module.exports = {
    name: 'getvar', alias: ['gv'], desc: 'Get a runtime config variable', category: 'Owner', ownerOnly: true,
    reactions: { start: '🔍', success: '❔' },
    execute: async (sock, m, { args, reply }) => {
        if (!args[0]) {
            const all = allVars();
            const rows = Object.keys(all).map(key => `${key} = ${all[key]}`);
            if (!rows.length) return reply('No variables set.');
            if (typeof sock.sendList === 'function') return sock.sendList(m.chat, 'Runtime Variables', rows, m);
            return reply('📋 Variables:\n' + rows.map(row => `• ${row}`).join('\n'));
        }
        const key = args[0].toUpperCase();
        const val = getVar(key);
        return reply(val !== null ? `${key} = ${val}` : 'Variable not found.');
    }
};
