const { withAppStateRecovery } = require('../../Utils/app-state');

module.exports = {
    name: 'setname',
    alias: ['myname', 'username'],
    desc: 'Change bot WhatsApp display name',
    category: 'Owner',
    owner: true,
    reactions: { start: '✏️', success: '🍃', error: '❔' },

    execute: async (sock, m, { args, reply }) => {
        const name = args.join(' ').trim() || m.quoted?.body || m.quoted?.text || '';
        if (!name) return reply('✐ _Usage: .name <new name>_');

        try {
            await sock.sendMessage(m.chat, { react: { text: '✏️', key: m.key } });
            await withAppStateRecovery(sock, () => sock.updateProfileName(name));
            await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
            return reply(`✓ *Name updated:* ${name}`);
        } catch (err) {
            console.error('[NAME ERROR]', err.message);
            try { await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } }); } catch {}
            const detail = String(err?.message || err);
            if (/app state key not present|app-state|bad mac/i.test(detail)) {
                return reply('`✘ WhatsApp app-state keys are stale. The connection is refreshing; run !setname again after it reconnects.`');
            }
            return reply(`\`✘ Error: ${detail}\``);
        }
    }
};
