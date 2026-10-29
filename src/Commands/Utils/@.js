module.exports = {
    name: 'channeljid',
    alias: ['chjid'],
    category: 'Tools',
    execute: async (sock, m, { args }) => {
        let jid;

        const input = args[0];
        if (!input) return;

        const match = input.match(/\/([A-Za-z0-9]+)$/);
        if (!match) return;

        const inviteCode = match[1];
        const metadata = await sock.newsletterMetadata('invite', inviteCode);
        
        jid = metadata.id;

        await sock.sendRichTextCopy(m.chat, {
            text: '## ⓘ Resolved lid/jid',
            copyText: jid,
            copyLabel: jid
        });
    }
};
