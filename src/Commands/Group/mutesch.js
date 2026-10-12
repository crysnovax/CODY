// mutesch.js — proper scheduled mute: .mutesch 5pm to 10am once|daily
// @crysnovax—FIX06-08-26
const core = require('../../Plugin/mute-core');
const cron = require('node-cron');
const { getCronOptions, getBotTimezone } = require('../../Utils/timezone');

module.exports = {
    name: 'mutesch',
    alias: ['mutetime', 'schedmute'],
    desc: 'Schedule group mute: .mutesch 5pm to 10am once|daily',
    category: 'Group',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🕒', success: '🔇' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const groupJid = m.chat;
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'cancel') {
            const removed = core.schedules.filter(s => s.group === groupJid);
            core.schedules = core.schedules.filter(s => s.group !== groupJid);
            core.saveSchedules();
            for (const s of removed) {
                try { core.activeCrons[s.id]?.stop(); } catch {}
                delete core.activeCrons[s.id];
            }
            return reply(`_✓ ${removed.length} schedule(s) cancelled for this group_`);
        }

        if (sub === 'list') {
            const mine = core.schedules.filter(s => s.group === groupJid);
            if (!mine.length) return reply('_✘ No active schedules in this group_');
            const text = mine.map(s =>
                `✦ ${s.action.toUpperCase()} at ${s.time} (${s.once ? 'once' : 'daily'}, ${getBotTimezone()})`
            ).join('\n');
            return reply(`🕒 *Active Schedules:*\n\n${text}`);
        }

        // .mutesch 5pm to 10am once|daily
        const startTime = args[0];
        const toWord = (args[1] || '').toLowerCase();
        const endTime = args[2];
        const repeat = (args[3] || 'daily').toLowerCase();

        if (!startTime || toWord !== 'to' || !endTime) {
            return reply(
                `_⚉ Usage:_\n` +
                `${prefix}mutesch 5pm to 10am once\n` +
                `${prefix}mutesch 5pm to 10am daily\n` +
                `${prefix}mutesch list\n` +
                `${prefix}mutesch cancel`
            );
        }
        if (repeat !== 'once' && repeat !== 'daily') {
            return reply('_✘ Repeat must be `once` or `daily`_');
        }

        const startCron = core.timeToCron(startTime);
        const endCron = core.timeToCron(endTime);
        if (!startCron || !endCron) {
            return reply('_✘ Invalid time. Use 5pm, 10am, 17:00 etc._');
        }

        const baseId = `${groupJid}-${Date.now()}`;
        const isOnce = repeat === 'once';

        const entries = [
            { id: baseId + '-start', group: groupJid, cron: startCron, action: 'mute',   once: isOnce, time: startTime },
            { id: baseId + '-end',   group: groupJid, cron: endCron,   action: 'unmute', once: isOnce, time: endTime }
        ];

        core.schedules.push(...entries);
        core.saveSchedules();

        for (const sch of entries) {
            try {
                const job = cron.schedule(sch.cron, async () => {
                    try {
                        await sock.groupSettingUpdate(sch.group, sch.action === 'mute' ? 'announcement' : 'not_announcement');
                        await sock.sendMessage(sch.group, {
                            text: sch.action === 'mute' ? '🔇 _Group auto-muted (scheduled)_' : '🔊 _Group auto-unmuted (scheduled)_'
                        });
                        if (sch.once) {
                            core.schedules = core.schedules.filter(s => s.id !== sch.id);
                            core.saveSchedules();
                            try { core.activeCrons[sch.id]?.stop(); } catch {}
                            delete core.activeCrons[sch.id];
                        }
                    } catch (err) {
                        console.error('[MUTESCH]', err.message);
                    }
                }, getCronOptions());
                core.activeCrons[sch.id] = job;
            } catch (err) {
                console.error('[MUTESCH CRON]', err.message);
            }
        }

        return reply(
            `🕒 *Mute Schedule Set*\n\n` +
            `✦ Mute at   : ${startTime}\n` +
            `✦ Unmute at : ${endTime}\n` +
            `✦ Repeat    : ${repeat}\n\n` +
            `✦ Timezone  : ${getBotTimezone()}\n\n` +
            `${prefix}mutesch cancel to remove`
        );
    }
};
