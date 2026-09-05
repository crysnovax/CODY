// ── bizupdate.js ─────────────────────────────────────────────────
const config = require('../../../settings/config');

const BOT_NAME = config.botname || process.env.BOTNAME || 'CRYSNOVA';

const DAY_MAP = {
    mon: 'MONDAY', monday: 'MONDAY',
    tue: 'TUESDAY', tuesday: 'TUESDAY',
    wed: 'WEDNESDAY', wednesday: 'WEDNESDAY',
    thu: 'THURSDAY', thursday: 'THURSDAY',
    fri: 'FRIDAY', friday: 'FRIDAY',
    sat: 'SATURDAY', saturday: 'SATURDAY',
    sun: 'SUNDAY', sunday: 'SUNDAY'
};

const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number);
    return (h * 60) + (m || 0);
};

const parseDay = (entry) => {
    const [rawDay, rawMode] = entry.split(',');
    const day = DAY_MAP[rawDay.trim().toLowerCase()];
    if (!day) throw new Error(`Unknown day: ${rawDay}`);
    if (rawMode === 'open_24h' || rawMode === 'closed') return { day, mode: rawMode };
    if (rawMode.includes('-')) {
        const [open, close] = rawMode.split('-');
        return {
            day,
            mode: 'specific_hours',
            openTimeInMinutes: toMinutes(open.trim()),
            closeTimeInMinutes: toMinutes(close.trim())
        };
    }
    throw new Error(`Unknown mode: ${rawMode} — use open_24h, closed, or HH:MM-HH:MM`);
};

const FIELD_ICON = {
    desc: '📝', description: '📝',
    email: '📧',
    website: '🌐',
    address: '📍',
    hours: '🕐'
};

const USAGE = `\`\`\`۞ BUSINESS UPDATE\`\`\`

ⓘ  *.bizupdate* — show this guide
❒ • *.bizupdate desc [text]*
❒ • *.bizupdate email [email]*
❒ • *.bizupdate website [url]*
❒ • *.bizupdate address [address]*
❒ • *.bizupdate hours mon,open_24h;tue,10:00-22:00*`;

module.exports = {
    name: 'bizupdate',
    alias: ['updatebiz', 'bizsetup'],
    desc: 'Update your WhatsApp Business profile',
    category: 'Business',
    owner: true,
    usage: '.bizupdate [field] [value]',

    execute: async (sock, m, { args, reply }) => {
        const field = args[0]?.toLowerCase();
        const value = args.slice(1).join(' ');

        if (!field || !value) return reply(USAGE);

        try {
            await sock.sendMessage(m.chat, { react: { text: '🔧', key: m.key } });

            const updates = {};

            switch (field) {
                case 'desc':
                case 'description':
                    updates.description = value;
                    break;
                case 'address':
                    updates.address = value;
                    break;
                case 'email':
                    updates.email = value;
                    break;
                case 'website':
                    updates.websites = [value];
                    break;
                case 'hours': {
                    const days = value.split(';').map(entry => parseDay(entry.trim()));
                    updates.hours = { timezone: 'Africa/Lagos', days };
                    break;
                }
                default:
                    return reply('✘ Unknown field.\n_Use: desc, address, email, website, hours_');
            }

            const updateFn = sock.updateBusinessProfile || sock.updateBussinesProfile;
            if (!updateFn) throw new Error('updateBusinessProfile not available — update your plogme');
            await updateFn.call(sock, updates);

            const icon = FIELD_ICON[field] || '📝';

            await sock.sendMessage(m.chat, {
                text: `\`\`\`۞ BUSINESS UPDATE\`\`\`\n\n❒ - *Field* ⇆ ${field}\n${icon} - *Value* ⇆ ${value}\n✆ - *Status* ⇆ Updated`,
                footer: `⚉ ${BOT_NAME} Business`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (err) {
            console.error('[BIZUPDATE]', err.message);
            reply(`${prefix}✘ ${err?.message || err}`);
        }
    }
};

