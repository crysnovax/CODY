const { getVar, setVar } = require('../../Plugin/configManager');

module.exports = {
    name: 'statusview',
    alias: ['statuslike', 'autoview', 'autolike', 'readstatus', 'viewstatus', 'likestatus'],
    desc: 'Toggle auto status view / like',
    category: 'Owner',
    ownerOnly: true,
    usage: '.statusview/.readstatus on/off  OR  .statuslike/.likestatus on/off',
    examples: ['.readstatus on', '.likestatus off'],
    reactions: { start: '⚙️', success: '🐾', error: '😪' },

    execute: async (sock, m, { args, reply, command, prefix }) => {
        // The router supplies the parsed command separately; `m.body` is not
        // guaranteed to exist on normalized WhatsApp messages. Falling back
        // to text also supports direct invocation by tests and older callers.
        const cmd = String(command || m?.body || m?.text || '')
            .toLowerCase().trim().split(/\s+/)[0].replace(/^[^a-z0-9]+/, '');
        const arg = String(args?.[0] || '').toLowerCase();

        const settings = [
            { cmd: 'statusview', key: 'AUTO_STATUS_VIEW', label: 'Status View' },
            { cmd: 'autoview', key: 'AUTO_STATUS_VIEW', label: 'Status View' },
            { cmd: 'readstatus', key: 'AUTO_STATUS_VIEW', label: 'Status View' },
            { cmd: 'viewstatus', key: 'AUTO_STATUS_VIEW', label: 'Status View' },
            { cmd: 'statuslike', key: 'AUTO_STATUS_LIKE', label: 'Status Like' },
            { cmd: 'autolike', key: 'AUTO_STATUS_LIKE', label: 'Status Like' },
            { cmd: 'likestatus', key: 'AUTO_STATUS_LIKE', label: 'Status Like' }
        ];

        const setting = settings.find(s => s.cmd === cmd);
        if (!setting) return;

        if (!arg || !['on', 'off'].includes(arg)) {
            const current = getVar(setting.key, true);
            return reply(
                `ⓘ *${setting.label}:* ${current ? '✓ ON' : '⊘ OFF'}\n\n` +
                `ℹ️ Usage: ${prefix || '.'}${cmd} on/off`
            );
        }

        const value = arg === 'on';
        setVar(setting.key, value);
        await sock.sendMessage(m.chat, { react: { text: '✓', key: m.key } });
        return reply(`✓ *${setting.label}* → ${value ? 'ON' : 'OFF'}`);
    }
};
