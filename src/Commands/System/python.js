'use strict';

const executionToggle = require('../../Plugin/executionToggle');

module.exports = {
    name: 'py',
    alias: ['python'],
    desc: 'Enable or disable the owner-only ~ Python trigger',
    category: 'Owner',
    ownerOnly: true,
    usage: '.py on|off',

    execute: async (_sock, _m, { args, reply, prefix }) => {
        const state = String(args?.[0] || '').toLowerCase();
        if (args?.length !== 1 || !['on', 'off'].includes(state)) {
            return reply(`_*Usage:* ${prefix || '.'}py on|off\n_${prefix || '.'}py controls the raw ~ Python trigger._`);
        }
        const enabled = executionToggle.setEnabled('python', state === 'on');
        return reply(enabled
            ? '`✓ PYTHON ENABLED` — `~ code` will execute Python.'
            : '`✘ PYTHON DISABLED` — `~ code` will be ignored.');
    }
};
