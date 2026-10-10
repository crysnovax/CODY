'use strict';

const fs = require('fs');
const path = require('path');

const DATABASE_DIR = path.join(process.cwd(), 'database');

function normalize(value) {
    return String(value || '').replace(/:\d+@/, '@').toLowerCase();
}

function getTarget(m) {
    const mentioned = m.mentionedJid?.[0] || m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mentioned) return normalize(mentioned);
    const quoted = m.quoted?.sender || m.quoted?.participant || m.msg?.contextInfo?.participantAlt;
    return quoted ? normalize(quoted) : null;
}

function belongsToGroup(key, group, target) {
    const value = String(key || '');
    if (!(value.startsWith(`${group}_`) || value.startsWith(`${group}:`))) return false;
    if (!target) return true;
    const suffix = value.slice(group.length + 1);
    return normalize(suffix) === target || suffix.replace(/[^0-9]/g, '') === target.replace(/[^0-9]/g, '');
}

function clearWarnings(group, target) {
    if (!fs.existsSync(DATABASE_DIR)) return 0;
    let removed = 0;
    const files = fs.readdirSync(DATABASE_DIR).filter(file => /(?:_warns|user_warns)\.json$/i.test(file));
    for (const file of files) {
        const filePath = path.join(DATABASE_DIR, file);
        let data;
        try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { continue; }
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
        let changed = false;
        for (const [key, record] of Object.entries(data)) {
            const recordUser = normalize(record?.user);
            if (belongsToGroup(key, group, target) ||
                (target && recordUser === target && (key.startsWith(`${group}_`) || key.startsWith(`${group}:`)))) {
                delete data[key];
                removed++;
                changed = true;
            }
        }
        if (changed) fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    return removed;
}

module.exports = {
    name: 'clearwarn',
    alias: ['clearwarnings', 'clearallwarns', 'resetallwarns'],
    desc: 'Clear warnings from every antisystem in this group',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🧹', success: '✅' },
    execute: async (sock, m, { reply }) => {
        const target = getTarget(m);
        const removed = clearWarnings(m.chat, target);
        if (target) {
            return reply(removed
                ? `✓ Cleared ${removed} warning record(s) for @${target.split('@')[0]} across all antisystems.`
                : 'No warning records found for that user.', { mentions: [target] });
        }
        return reply(`✓ Cleared ${removed} warning record(s) across all antisystems in this group.`);
    }
};

module.exports.clearWarnings = clearWarnings;
