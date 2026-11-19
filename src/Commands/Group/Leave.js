module.exports = {
    name: 'exit',
    alias: ['leavegc'],
    category: 'group',
    desc: 'Leave the current group',
    owner: true,

    execute: async (sock, m, { reply }) => {

        try {

            await reply('`×͜×⟁⃝GOOD BYE!℘`');

            await sock.groupLeave(m.chat);

            

        } catch (err) {

            console.error('[LEAVE ERROR]', err);

            reply(`
𓉤 CRYSNOVA AI

✘ Failed to Leave
${e?.message || err?.message || 'Unknown Error'}
`);
        }
    }
};

