module.exports = {
    name: 'jid',
    alias: ['getjid', 'chatid'],
    category: 'Tools',
    execute: async (sock, m, { args }) => {
        let jid;

        if (!args[0]) {
            jid = m.chat;
        } else if (args[0].includes('chat.whatsapp.com')) {
            const code = args[0].split('chat.whatsapp.com/')[1].split('?')[0];
            const info = await sock.groupGetInviteInfo(code);
            jid = info.id;
        } else {
            let number = args[0].replace(/[^0-9]/g, '');
            if (number.startsWith('0')) number = number.substring(1);
            jid = `${number}@s.whatsapp.net`;
        }

        await sock.sendRichTextCopy(m.chat, {
            text: '## ⓘ Resolved lid/jid',
            copyText: jid,
            copyLabel: jid
        });
    }
};
