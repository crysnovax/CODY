module.exports = {
    name: 'channeljid',
    alias: ['chjid'],
    category: 'Tools',
    execute: async (sock, m, { args }) => {
        let raw = args[0];

        // If no args, try get link from quoted message
        if (!raw) {
            const q = m.quoted?.text 
                || m.quoted?.body 
                || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation
                || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text
                || "";

            // extract https://whatsapp.com/channel/xxx from quoted text
            const found = q.match(/(https?:\/\/)?(www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]+/i);
            raw = found ? found[0] : q;
        }

        if (!raw) return;

        const match = raw.match(/\/([A-Za-z0-9]+)$/);
        if (!match) return;

        const inviteCode = match[1];
        const metadata = await sock.newsletterMetadata('invite', inviteCode);
        const jid = metadata.id;

        await sock.sendRichTextCopy(m.chat, {
            text: '## ⓘ Resolved lid/jid',
            copyText: jid,
            copyLabel: jid
        });
    }
};
