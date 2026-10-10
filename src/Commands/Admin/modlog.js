'use strict';
const { readDB, writeDB, prune } = require('../../Plugin/modLog');
const { DB_PATH, MAX_ENTRIES } = require('../../Plugin/modLog');
const plugin = {
    name: 'modlog',
    alias: ['moderationlog'],
    desc: 'Opt-in, private moderation audit log (metadata only)',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    execute: async (sock, m, { args = [], reply }) => {
        const db = readDB();
        const config = db[m.chat] || (db[m.chat] = { enabled: false, retentionDays: 30, entries: [] });
        if (!Array.isArray(config.entries)) config.entries = [];
        if (!Number.isFinite(config.retentionDays)) config.retentionDays = 30;
        const sub = String(args[0] || 'status').toLowerCase();
        if (sub === 'status') {
            config.entries = prune(config.entries, config.retentionDays);
            writeDB(db);
            return reply(`*Moderation Log*\n• Status: ${config.enabled ? 'ON' : 'OFF'}\n• Retention: ${config.retentionDays} days\n• Stored events: ${config.entries.length}/${MAX_ENTRIES}\n• Privacy: no message text, links, captions, or command arguments are stored.\n\nCommands:\n• .modlog on / off\n• .modlog recent [count]\n• .modlog retention <1-90 days>\n• .modlog clear`);
        }
        if (sub === 'on' || sub === 'off') {
            config.enabled = sub === 'on';
            config.entries = prune(config.entries, config.retentionDays);
            writeDB(db);
            return reply(`Moderation log ${config.enabled ? 'enabled' : 'disabled'} for this group.`);
        }
        if (sub === 'retention') {
            const days = Number(args[1]);
            if (!Number.isInteger(days) || days < 1 || days > 90) return reply('Usage: .modlog retention <1-90 days>');
            config.retentionDays = days;
            config.entries = prune(config.entries, days);
            writeDB(db);
            return reply(`Moderation log retention set to ${days} days; expired entries were removed.`);
        }
        if (sub === 'clear') {
            config.entries = [];
            writeDB(db);
            return reply('Moderation log cleared for this group.');
        }
        if (sub === 'recent') {
            config.entries = prune(config.entries, config.retentionDays);
            writeDB(db);
            const requested = Number(args[1] || 10);
            const count = Number.isInteger(requested) ? Math.min(25, Math.max(1, requested)) : 10;
            const entries = config.entries.slice(-count).reverse();
            if (!entries.length) return reply('No moderation events in the log. Turn it on with .modlog on.');
            const lines = entries.map(entry => {
                const time = new Date(entry.timestamp).toLocaleString('en-GB', { timeZone: 'UTC' });
                const actor = entry.actor ? `@${entry.actor.split('@')[0]}` : 'unknown';
                const target = entry.target ? ` → @${entry.target.split('@')[0]}` : '';
                const detail = entry.action ? ` (${entry.action})` : '';
                return `• ${time} UTC — ${entry.command || entry.kind}${detail} — ${actor}${target}`;
            });
            return sock.sendMessage(m.chat, { text: `*Recent moderation events*\n${lines.join('\n')}` }, { quoted: m });
        }
        return reply('Usage: .modlog status | on | off | recent [count] | retention <1-90> | clear');
    },
};
plugin.DB_PATH = DB_PATH;
module.exports = plugin;
