// ssl.js — toggle the secured meta service label (secureMetaServiceLabel)
// that can be attached to outgoing messages in ?.js. Off by default.
// @crysnovax—FIX08-07-26
const { getVar, setVar } = require('../../Plugin/configManager');

module.exports = {
    name: 'ssl',
    alias: ['tssl', 'securelabel'],
    desc: 'Toggle the secured meta service label on outgoing messages',
    category: 'Owner',
    ownerOnly: true,
    reactions: { start: '🛡️', success: '🔐' },

    execute: async (sock, m, { args, reply }) => {
        const current = getVar('SECURE_META_LABEL', false);
        const arg = (args[0] || '').toLowerCase();

        let next;
        if (arg === 'on' || arg === 'true' || arg === '1') next = true;
        else if (arg === 'off' || arg === 'false' || arg === '0') next = false;
        else next = !current;

        setVar('SECURE_META_LABEL', next);

        return reply(
            `╭─❍ *SECURED META LABEL*\n│\n` +
            `│ 🛡️ Status : ${next ? '✓ ON' : '✗ OFF'}\n` +
            `│ 𓄄 Label   : secureMetaServiceLabel\n│\n` +
            `│ .ssl on / .ssl off / .ssl (toggle)\n` +
            `╰──────────────────`
        );
    }
};
