'use strict';

const { parsePollInput } = require('../Group/Poll');

module.exports = {
    name: 'addpoll',
    alias: ['polladd'],
    desc: 'Create a poll where participants can always add options',
    category: 'Tools',
    adminOnly: false,
    groupOnly: false,
    usage: '.addpoll Question | Option 1 | Option 2 [--end 8h] [--hide-voter] [--select 2]',

    execute: async (sock, m, { args = [], reply, prefix = '.' }) => {
        if (!args.length) {
            return reply(
                `╭─❍ *📊 ADD-POLL CREATOR*\n│\n` +
                `│ ${prefix}addpoll Question | Option 1 | Option 2\n` +
                `│ Multi choice: ${prefix}addpoll multi Question | Option 1 | Option 2\n` +
                `│ Expiry defaults to 8 hours; use --end to override\n` +
                `│ Voters are visible by default; use --hide-voter to hide them\n` +
                `│ Participants can always add options\n` +
                `╰──────────────────`
            );
        }

        const parsed = parsePollInput(args);
        if (parsed.error) return reply(`_✘ ${parsed.error}_`);

        const poll = {
            ...parsed.poll,
            endDate: parsed.poll.endDate || new Date(Date.now() + 28_800_000),
            hideVoter: parsed.poll.hideVoter === undefined ? false : parsed.poll.hideVoter,
            canAddOption: true
        };

        try {
            await sock.sendMessage(m.chat, { poll }, { quoted: m });
        } catch (error) {
            console.error('[ADDPOLL ERROR]', error.message);
            return reply(`_✘ Failed to create add-option poll: ${error?.message || error}_`);
        }
    },

    parsePollInput
};
