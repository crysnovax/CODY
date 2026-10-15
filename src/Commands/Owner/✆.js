const { sendBroadcastContent } = require('../Admin/broadcast');

module.exports = {
    name: 'resend',
    alias: ['repost'],
    desc: 'Repost a replied message',
    category: 'Tools',

    execute: async (sock, m, { reply, args }) => {

        if (!m.quoted) {
            return reply('⊘ Reply to a message first.');
        }

        if (!args[0]) {
            return reply(
                '⊘ Provide target chat!\n\n' +
                'Examples:\n' +
                '• .resend 2348xxxx@s.whatsapp.net\n' +
                '• .resend https://chat.whatsapp.com/xxxxx\n' +
                '• .resend https://wa.me/2348xxxx'
            );
        }

        let target = args[0];

        try {
            // GROUP INVITE
            if (target.includes('chat.whatsapp.com')) {
                const code = target.split('chat.whatsapp.com/')[1].split('?')[0];
                const info = await sock.groupGetInviteInfo(code);
                target = info.id;
                if (!target) return reply('⊘ Could not resolve group JID.');
            }
            // WA.ME
            else if (target.includes('wa.me/')) {
                const num = target.split('wa.me/')[1].split('?')[0];
                target = `${num}@s.whatsapp.net`;
            }
            // RAW NUMBER
            else if (!target.includes('@')) {
                target = `${target}@s.whatsapp.net`;
            }
        } catch (e) {
            return reply('⊘ Invalid link or expired invite.');
        }

        const q = m.quoted;
        try {
            const source = q.fakeObj || q;
            await sendBroadcastContent(sock, target, source, '');

        } catch (e) {
            console.error('REPOST ERROR:', e);
            return reply(`⊘ Failed to repost: ${e?.message || e}`);
        }
    }
};
