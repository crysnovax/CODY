const core = require('../../Plugin/mute-core');
const cron = require('node-cron');

module.exports = {
    name: 'mute',
    alias: ['silence', 'groupmute', 'mutesch'],
    desc: 'Mute group instantly, for a duration, or on a schedule',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    reactions: { start: '🔇', success: '✦' },

    setupMuteSchedules: core.setupMuteSchedules,

    execute: async (sock, m, { args, reply, prefix }) => {
        const groupJid = m.chat;
        const sub = args[0]?.toLowerCase();

        // ── CANCEL SCHEDULE ───────────────────────────────────
        if (sub === 'cancel') {
            const removed = core.schedules.filter(s => s.group === groupJid);
            core.schedules = core.schedules.filter(s => s.group !== groupJid);
            core.saveSchedules();
            for (const s of removed) {
                core.activeCrons[s.id]?.stop();
                delete core.activeCrons[s.id];
            }
            return reply(`✦ ${removed.length} schedule(s) cancelled for this group`);
        }

        // ── SHOW SCHEDULES ────────────────────────────────────
        if (sub === 'schedules' || sub === 'list') {
            const mine = core.schedules.filter(s => s.group === groupJid);
            if (!mine.length) return reply('✘ No active schedules for this group');
            const text = mine.map(s =>
                `✦ ${s.action.toUpperCase()} at ${s.time} (${s.once ? 'once' : 'daily'})`
            ).join('\n');
            return reply(`🕒 *Active Schedules:*\n\n${text}`);
        }

        // ── MUTE FOR <time> ───────────────────────────────────
        if (sub === 'for') {
            const timeArg = args[1];
            const ms = core.parseTime(timeArg);
            if (!ms) return reply(`⚉ Use: \`${prefix}mute for 10m | 2h | 1d | 2w\``);
            if (ms > 60 * 24 * 60 * 60 * 1000) return reply('⚉ Maximum is 60 days');

            await sock.groupSettingUpdate(groupJid, 'announcement');
            reply(`🔇 Group muted for ${timeArg}`);

            if (global.muteTimers[groupJid]) clearTimeout(global.muteTimers[groupJid]);
            global.muteTimers[groupJid] = setTimeout(async () => {
                try {
                    await sock.groupSettingUpdate(groupJid, 'not_announcement');
                    await sock.sendMessage(groupJid, { text: '🔊 _Group auto-unmuted_' });
                } catch (err) {
                    console.error('[MUTE TIMER]', err.message);
                }
                delete global.muteTimers[groupJid];
            }, ms);
            return;
        }

        // ── MUTE FROM <time> TO <time> ────────────────────────
        if (sub === 'from') {
            const startTime = args[1];
            const toWord    = args[2];
            const endTime   = args[3];
            const repeat    = args[4]?.toLowerCase() || 'daily';

            if (!startTime || !endTime || toWord !== 'to') {
                return reply(`⚉ Use: \`${prefix}mute from 12pm to 5am daily\` or \`${prefix}mute from 12pm to 5am once\`\nSchedule usage:\n• ${prefix}mute from 10pm to 6am daily\n• ${prefix}mutesch 5pm to 10am once`);
            }

            const startCron = core.timeToCron(startTime);
            const endCron   = core.timeToCron(endTime);
            if (!startCron || !endCron) return reply('⚉ Invalid time. Use: 12pm, 5am, 17:00 etc.');

            const baseId = `${groupJid}-${Date.now()}`;
            const isOnce = repeat !== 'daily';

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
                                text: sch.action === 'mute' ? '🔇 _Group auto-muted_' : '🔊 _Group auto-unmuted_'
                            });
                            if (sch.once) {
                                core.schedules = core.schedules.filter(s => s.id !== sch.id);
                                core.saveSchedules();
                                core.activeCrons[sch.id]?.stop();
                                delete core.activeCrons[sch.id];
                            }
                        } catch (err) {
                            console.error('[SCHED MUTE]', err.message);
                        }
                    });
                    core.activeCrons[sch.id] = job;
                } catch (err) {
                    console.error('[CRON SETUP]', err.message);
                }
            }

            return reply(
                `🕒 *Mute Schedule Set*\n\n` +
                `✦ Mute at   : ${startTime}\n` +
                `✦ Unmute at : ${endTime}\n` +
                `✦ Repeat    : ${repeat}\n\n` +
                `Use \`${prefix}mute cancel\` to remove`
            );
        }

        // ── INSTANT MUTE ──────────────────────────────────────
        await sock.groupSettingUpdate(groupJid, 'announcement');
        return reply('🔇 Group muted — only admins can send messages');
    }
};
