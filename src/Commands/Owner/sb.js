module.exports = {
    name: 'bio',
    alias: ['setbio', 'about', 'setabout'],
    desc: 'Change bot WhatsApp bio/about',
    category: 'Owner',
    ownerOnly: true,
    reactions: { start: '✏️', success: '☘️', error: '❔' },

    execute: async (sock, m, { args, reply , prefix}) => {
        const bio = (args.join(' ').trim() || m.quoted?.body || m.quoted?.text || '').trim();
        if (!bio) return reply('✐ _Usage: .bio <new bio>_');
        if (bio.length > 139) return reply(`${prefix}✘ WhatsApp bios can contain at most 139 characters Your bio has ${bio.length}.`);
        if (typeof sock.updateProfileStatus !== 'function') return reply('✘ This Baileys socket does not support updating the account bio.');

        try {
            await sock.sendMessage(m.chat, { react: { text: '✏️', key: m.key } });
            await sock.updateProfileStatus(bio);
            await sock.sendMessage(m.chat, { react: { text: '☘️', key: m.key } });
            return reply(`✓ *Bio updated:* ${bio}`);
        } catch (err) {
            console.error('[BIO ERROR]', err.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            return reply(`\`✘ Error: ${err.message}\``);
        }
    }
};
