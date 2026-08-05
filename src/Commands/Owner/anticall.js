const {
    loadConfig,
    saveConfig,
    normalizeJid,
    findLidForPhone,
    defaultConfig
} = require('../../Plugin/anticallManager');

module.exports = {
    name: 'anticall',
    alias: ['ac', 'callblock'],
    desc: 'Manage anti‑call settings (whitelist/blacklist always active)',
    category: 'Owner',

    execute: async (sock, m, { args, reply , prefix}) => {
        console.log('[ANTICALL CMD] args:', args);
        const sub = args[0]?.toLowerCase();
        const config = loadConfig();

        if (!config.pendingPhoneReject) config.pendingPhoneReject = [];

        const toJid = (input) => {
            if (!input) return '';
            const trimmed = input.trim();
            if (/^\d+$/.test(trimmed)) {
                const lid = findLidForPhone(trimmed);
                if (lid) {
                    console.log(`[ANTICALL] Found LID for ${trimmed}: ${lid}`);
                    return lid;
                }
                console.log(`[ANTICALL] No LID found for ${trimmed}, using phone JID.`);
                return `${trimmed}@s.whatsapp.net`;
            }
            return trimmed;
        };

        // --- HELP ---
        if (!sub) {
            return reply(
                `𖣘 *ANTI‑CALL MANAGER*\n\n` +
                `*Whitelist & Blacklist are ALWAYS active.*\n` +
                `Global ON/OFF controls unknown callers.\n\n` +
                `Commands:\n` +
                `.anticall on/off\n` +
                `.anticall reason <text>\n` +
                `.anticall unknownreason <text>\n` +
                `.anticall schedule once <start ISO> <end ISO>\n` +
                `.anticall schedule always <start HH:MM> <end HH:MM> [days] [dates] [months]\n` +
                `.anticall schedule off\n` +
                `.anticall reject add/remove/list <number or JID>\n` +
                `.anticall whitelist add/remove/list <number or JID>\n` +
                `.anticall status\n` +
                `${prefix}anticall reset`
            );
        }

        // --- ON / OFF (Global switch for unknowns only) ---
        if (sub === 'on') {
            config.enabled = true;
            saveConfig(config);
            return reply('`✓ Global block unknowns ENABLED`');
        }
        if (sub === 'off') {
            config.enabled = false;
            saveConfig(config);
            return reply('`✘ Global block unknowns DISABLED`');
        }

        // --- REASON ---
        if (sub === 'reason') {
            const reason = args.slice(1).join(' ');
            if (!reason) return reply('_Provide a rejection message._');
            config.reason = reason;
            saveConfig(config);
            return reply(`Reason set to:\n${reason}`);
        }

        // --- UNKNOWN REASON ---
        if (sub === 'unknownreason') {
            const text = args.slice(1).join(' ');
            if (!text) return reply('_Provide a message for unknown callers._');
            config.unknownReason = text;
            saveConfig(config);
            return reply(`Unknown caller reason set to:\n${text}`);
        }

        // --- SCHEDULE ---
        if (sub === 'schedule') {
            const action = args[1]?.toLowerCase();
            if (action === 'off') {
                config.schedule.enabled = false;
                saveConfig(config);
                return reply('Schedule disabled');
            }

            if (action === 'once') {
                const start = args[2];
                const end = args[3];
                if (!start || !end) return reply('_Usage: .anticall schedule once <start ISO> <end ISO>_');
                config.schedule.enabled = true;
                config.schedule.type = 'once';
                config.schedule.start = start;
                config.schedule.end = end;
                saveConfig(config);
                return reply(`One‑time schedule set:\n${start} → ${end}`);
            }

            if (action === 'always') {
                const start = args[2];
                const end = args[3];
                if (!start || !end) return reply('_Usage: .anticall schedule always <start HH:MM> <end HH:MM> [days] [dates] [months]_');
                config.schedule.enabled = true;
                config.schedule.type = 'always';
                config.schedule.start = start;
                config.schedule.end = end;
                config.schedule.days = args[4] ? args[4].split(',').map(Number) : [];
                config.schedule.dates = args[5] ? args[5].split(',').map(Number) : [];
                config.schedule.months = args[6] ? args[6].split(',').map(Number) : [];
                saveConfig(config);
                return reply(
                    `Recurring schedule set:\n` +
                    `${start} → ${end}\n` +
                    `Days: ${config.schedule.days.length ? config.schedule.days.join(',') : 'All'}\n` +
                    `Dates: ${config.schedule.dates.length ? config.schedule.dates.join(',') : 'All'}\n` +
                    `Months: ${config.schedule.months.length ? config.schedule.months.join(',') : 'All'}`
                );
            }

            return reply('_Invalid schedule action. Use: on/off/once/always_');
        }

        // --- REJECT (blacklist) ---
        if (sub === 'reject') {
            const action = args[1]?.toLowerCase();
            const target = args.slice(2).join(' ').trim();

            if (action === 'add') {
                const jid = toJid(target);
                if (!jid) return reply('_Provide a phone number or JID._');
                if (!config.blacklist.includes(jid)) {
                    config.blacklist.push(jid);
                }
                if (/^\d+$/.test(target) && !jid.includes('@lid')) {
                    if (!config.pendingPhoneReject.includes(target)) {
                        config.pendingPhoneReject.push(target);
                    }
                    saveConfig(config);
                    return reply(
                        `Added ${jid} to reject list.\n` +
                        `_ⓘ LID not yet known — will auto‑upgrade on first call._`
                    );
                }
                saveConfig(config);
                return reply(`Added ${jid} to reject list.`);
            }

            if (action === 'remove') {
                const jid = toJid(target);
                if (!jid) return reply('_Provide a phone number or JID._');
                config.blacklist = config.blacklist.filter(b => normalizeJid(b) !== normalizeJid(jid));
                if (/^\d+$/.test(target)) {
                    config.pendingPhoneReject = config.pendingPhoneReject.filter(p => p !== target);
                }
                saveConfig(config);
                return reply(`Removed ${jid} from reject list.`);
            }

            if (action === 'list') {
                const list = config.blacklist.length ? config.blacklist.join('\n') : '(empty)';
                const pending = config.pendingPhoneReject?.length ? config.pendingPhoneReject.join('\n') : '(none)';
                return reply(
                    `*Blacklist (active):*\n${list}\n\n` +
                    `*Pending phone numbers (awaiting LID):*\n${pending}`
                );
            }

            return reply('_Usage: .anticall reject add/remove/list <number or JID>_');
        }

        // --- WHITELIST ---
        if (sub === 'whitelist') {
            const action = args[1]?.toLowerCase();
            const target = args.slice(2).join(' ').trim();

            if (!action) {
                const list = config.whitelist.length ? config.whitelist.join('\n') : '(empty)';
                return reply(`*Whitelist (always allowed):*\n${list}`);
            }

            if (action === 'add') {
                const jid = toJid(target);
                if (!jid) return reply('_Provide a phone number or JID._');
                if (!config.whitelist.includes(jid)) {
                    config.whitelist.push(jid);
                    saveConfig(config);
                }
                return reply(`Added ${jid} to whitelist (never rejected).`);
            }

            if (action === 'remove') {
                const jid = toJid(target);
                if (!jid) return reply('_Provide a phone number or JID._');
                config.whitelist = config.whitelist.filter(w => normalizeJid(w) !== normalizeJid(jid));
                saveConfig(config);
                return reply(`Removed ${jid} from whitelist.`);
            }

            if (action === 'list') {
                const list = config.whitelist.length ? config.whitelist.join('\n') : '(empty)';
                return reply(`*Whitelist (always allowed):*\n${list}`);
            }

            return reply('_Usage: .anticall whitelist [add/remove/list] <number or JID>_');
        }

        // --- STATUS ---
        if (sub === 'status') {
            const s = config.schedule;
            let scheduleInfo = s.enabled
                ? `${s.type.toUpperCase()}: ${s.start} → ${s.end}`
                : 'Disabled';
            if (s.enabled && s.type === 'always') {
                scheduleInfo += `\nDays: ${s.days.length ? s.days.join(',') : 'All'}`;
                scheduleInfo += `\nDates: ${s.dates.length ? s.dates.join(',') : 'All'}`;
                scheduleInfo += `\nMonths: ${s.months.length ? s.months.join(',') : 'All'}`;
            }

            return reply(
                `*Anti‑Call Status*\n` +
                `Global block unknowns: *${config.enabled ? 'ON' : 'OFF'}*\n` +
                `Schedule: ${scheduleInfo}\n\n` +
                `*Always Active Lists:*\n` +
                `Whitelisted: ${config.whitelist.length} entries\n` +
                `Blacklisted: ${config.blacklist.length} entries\n` +
                `Pending LID upgrades: ${config.pendingPhoneReject?.length || 0} numbers\n\n` +
                `Reason (blocked): ${config.reason}\n` +
                `Reason (unknown): ${config.unknownReason || '(not set)'}`
            );
        }

        // --- RESET ---
        if (sub === 'reset') {
            saveConfig(defaultConfig);
            return reply('`✓ Anti‑Call reset to defaults`');
        }

        return reply('_Unknown subcommand. Use .anticall for help._');
    }
};
