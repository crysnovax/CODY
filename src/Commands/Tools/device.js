const DEVICE_LABELS = {
    ios: 'iPhone (iOS)',
    android: 'Android',
    web: 'WhatsApp Web',
    desktop: 'WhatsApp Desktop',
    unknown: 'Unknown device',
};

function detectDevice(messageId) {
    // Modern WhatsApp message IDs vary in length, so the exact-length rules in
    // Baileys' getDevice (e.g. /^3E.{20}$/) miss current iOS and Web IDs.
    // Prefix-based rules identify the platform reliably regardless of length.
    const id = String(messageId || '').trim().toUpperCase();
    if (!id) return 'unknown';
    if (id.startsWith('3EB0')) return 'web';
    if (id.startsWith('3A')) return 'ios';
    if (id.startsWith('3F') || id.startsWith('BAE5')) return 'desktop';
    if (/^[0-9A-F]{16,40}$/.test(id)) return 'android';
    return 'unknown';
}

module.exports = {
    name: 'device',
    alias: ['checkdevice', 'dev'],
    desc: 'Detect the device a message was sent from',
    category: 'Tools',
    usage: `.device (reply to a message)`,
    reactions: { start: '💭', success: '🐾', error: '🪲' },

    execute: async (sock, m, { reply }) => {
        const quotedId = m.quoted?.key?.id || m.quoted?.id
            || m.msg?.contextInfo?.stanzaId
            || m.message?.extendedTextMessage?.contextInfo?.stanzaId;

        const targetId = quotedId || m.key?.id;
        const targetSender = quotedId
            ? (m.quoted?.sender || m.msg?.contextInfo?.participant || 'that user')
            : (m.sender || 'you');

        if (!targetId) return reply('Could not read a message ID. Reply to a message with .device');

        const device = detectDevice(targetId);
        const label = DEVICE_LABELS[device] || DEVICE_LABELS.unknown;
        const who = quotedId ? `@${String(targetSender).split('@')[0]}` : 'You';

        return sock.sendMessage(m.chat, {
            text: `${who} sent that message from: *${label}*`,
            mentions: quotedId && String(targetSender).includes('@') ? [targetSender] : [],
        }, { quoted: m });
    },

    detectDevice,
};
