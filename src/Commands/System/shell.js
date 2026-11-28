'use strict';

const executionToggle = require('../../Plugin/executionToggle');

module.exports = {
    name: 'shell',
    alias: ['sh'],
    desc: 'Enable or disable the owner-only \\ shell trigger',
    category: 'Owner',
    ownerOnly: true,
    usage: '.shell on|off',

    execute: async (_sock, _m, { args, reply, prefix }) => {
        const state = String(args?.[0] || '').toLowerCase();
        if (args?.length !== 1 || !['on', 'off'].includes(state)) {
            return reply(`_*Usage:* ${prefix || '.'}shell on|off\n_${prefix || '.'}shell controls the raw \\ shell trigger._`);
        }
        const enabled = executionToggle.setEnabled('shell', state === 'on');
        return reply(enabled
            ? '`✓ SHELL ENABLED` — `\\ command` will execute shell commands.'
            : '`✘ SHELL DISABLED` — `\\ command` will be ignored.');
    }
};
