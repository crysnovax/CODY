// ── ALL GROUP SETTINGS COMMANDS ──────────────────────────────────────────
module.exports = [
    // ── TOGGLE EPHEMERAL (DISAPPEARING MESSAGES) ──────────────────────
    {
        name: 'ephemeral',
        alias: ['disappearing', 'toggleephemeral', 'settimer'],
        desc: 'Set disappearing messages timer (seconds)',
        category: 'Group',
        admin: true,
        group: true,
        usage: `${prefix}ephemeral <seconds>`,
        examples: ['.ephemeral 86400', '.ephemeral 0', '.ephemeral 604800'],
        reactions: { start: '⏳', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply , prefix}) => {
            const seconds = parseInt(args[0]);

            if (isNaN(seconds) || seconds < 0) {
                return reply(`${prefix}⊘ *Usage:* ephemeral <seconds>\n\nCommon values:\n• 0 - Off\n• 86400 - 24 hours\n• 604800 - 7 days\n• 2592000 - 30 days`);
            }

            await sock.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

            try {
                await sock.groupToggleEphemeral(m.chat, seconds);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });

                const displayTime = seconds === 0 ? 'OFF'
                    : seconds === 86400 ? '24 hours'
                    : seconds === 604800 ? '7 days'
                    : seconds === 2592000 ? '30 days'
                    : `${seconds} seconds`;

                return reply(`✓ *Disappearing messages set to:* ${displayTime}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`${prefix}⊘ *Error:* ${errmessage}`);
            }
        }
    },

    // ── SET MEMBER ADD MODE ─────────────────────────────────────────────
    {
        name: 'addmode',
        alias: ['memberaddmode', 'setaddmode'],
        desc: 'Set who can add members to the group',
        category: 'Group',
        admin: true,
        group: true,
        usage: '.addmode <admin_add/all_member_add>',
        examples: ['.addmode admin_add', '.addmode all_member_add'],
        reactions: { start: '👥', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply , prefix}) => {
            const mode = args[0]?.toLowerCase();
            const valid = ['admin_add', 'all_member_add'];

            if (!mode || !valid.includes(mode)) {
                return reply(`${prefix}⊘ *Usage:* addmode admin_add/all_member_add\n\nOptions:\n• admin_add - Only admins can add members\n• all_member_add - All members can add members`);
            }

            await sock.sendMessage(m.chat, { react: { text: '👥', key: m.key } });

            try {
                await sock.groupMemberAddMode(m.chat, mode);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`${prefix}✓ *Member add mode set to:* ${modereplace('_', ' ').toUpperCase()}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`${prefix}⊘ *Error:* ${errmessage}`);
            }
        }
    },

    // ── SET JOIN APPROVAL MODE ──────────────────────────────────────────
    {
        name: 'setapproval',
        alias: ['setjoinapproval'],
        desc: 'Set whether join requests require admin approval',
        category: 'Group',
        admin: true,
        group: true,
        usage: '.approval <on/off>',
        examples: ['.approval on', '.approval off'],
        reactions: { start: '🔐', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply , prefix}) => {
            const setting = args[0]?.toLowerCase();
            const valid = ['on', 'off'];

            if (!setting || !valid.includes(setting)) {
                return reply(`${prefix}⊘ *Usage:* approval on/off\n\nOptions:\n• on - Admins must approve new members\n• off - Anyone can join without approval`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🔐', key: m.key } });

            try {
                await sock.groupJoinApprovalMode(m.chat, setting);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`${prefix}✓ *Join approval mode set to:* ${settingtoUpperCase()}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`${prefix}⊘ *Error:* ${errmessage}`);
            }
        }
    },

    // ── SET BOT MEMBER AG ──────────────────────────────────────────────
    // updateMemberLabel sets the bot's OWN display tag in the group.
    // It does not update another participant's tag — that's not supported by WA.
    {
        name: 'membertag',
        alias: ['setmytag', 'bottag', 'memberlabel', 'setmemberlabel'],
        desc: "Set the bot's own member tag/label in this group (max 30 chars)",
        category: 'Group',
        admin: true,
        group: true,
        usage: `${prefix}bottag <label>`,
        examples: ['.bottag ⚉ CRYSNOVA AI', '.bottag Admin Bot'],
        reactions: { start: '🏷️', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply , prefix}) => {
            const label = args.join(' ').trim();

            if (!label) {
                return reply(`${prefix}⊘ *Usage:* bottag <label>\n\n_Sets the bot's own display tag in this group._\n_Max 30 characters._`);
            }

            if (label.length > 30) {
                return reply(`${prefix}⊘ Label too long — max 30 characters (yours: ${labellength})`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🏷️', key: m.key } });

            try {
                await sock.updateMemberLabel(m.chat, label);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Bot tag set to:* ${label}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`${prefix}⊘ *Error:* ${errmessage}`);
            }
        }
    }
];

