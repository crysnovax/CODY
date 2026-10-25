'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-mutesch-'));
const scheduleFile = path.join(tempDir, 'mute-schedules.json');
const previousScheduleFile = process.env.CODY_MUTE_SCHEDULE_FILE;
process.env.CODY_MUTE_SCHEDULE_FILE = scheduleFile;
const cronJobs = [];
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
    if (request === 'node-cron') return { schedule: (_cron, callback) => { const job = { callback, stop() {} }; cronJobs.push(job); return job; } };
    if (request.endsWith('Utils/timezone')) return { getCronOptions: () => ({}), getBotTimezone: () => 'UTC' };
    return originalLoad.call(this, request, parent, isMain);
};
const command = require('../src/Commands/Group/mutesch');
const core = require('../src/Plugin/mute-core');
Module._load = originalLoad;

test.after(() => {
    for (const job of Object.values(core.activeCrons)) { try { job.stop(); } catch {} }
    if (previousScheduleFile === undefined) delete process.env.CODY_MUTE_SCHEDULE_FILE;
    else process.env.CODY_MUTE_SCHEDULE_FILE = previousScheduleFile;
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('mutesch parses once/daily and multiword reason forms', () => {
    assert.deepEqual(command.parseScheduleArgs(['5pm', 'to', '10am', 'once', 'reason', 'repeated', 'rule', 'violations']), {
        startTime: '5pm', toWord: 'to', endTime: '10am', repeat: 'once', reason: 'repeated rule violations',
    });
    assert.equal(command.parseScheduleArgs(['5pm', 'to', '10am', 'daily', 'reason:', 'spam']).reason, 'spam');
    assert.equal(command.parseScheduleArgs(['5pm', 'to', '10am', 'noise', 'after', 'hours']).reason, 'noise after hours');
    assert.equal(command.parseScheduleArgs(['5pm', 'to', '10am', 'reason', 'spam']).repeat, 'daily');
});

test('mutesch saves and announces the configured reason', async () => {
    const group = `scheduled-${Date.now()}@g.us`;
    const replies = [];
    const sent = [];
    const sock = {
        groupSettingUpdate: async (...args) => sent.push(['setting', ...args]),
        sendMessage: async (...args) => sent.push(args),
    };
    core.schedules = [];
    core.activeCrons = {};
    cronJobs.length = 0;

    await command.execute(sock, { chat: group }, {
        args: ['5pm', 'to', '10am', 'once', 'reason', 'repeated', 'rule', 'violations'],
        reply: async text => replies.push(text), prefix: '.',
    });

    assert.equal(core.schedules.length, 2);
    assert.ok(core.schedules.every(schedule => schedule.reason === 'repeated rule violations'));
    const saved = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
    assert.ok(saved.every(schedule => schedule.reason === 'repeated rule violations'));
    assert.match(replies[0], /Reason\s+: repeated rule violations/);

    await cronJobs[0].callback();
    assert.ok(sent.some(([, payload]) => /Reason: repeated rule violations/.test(payload.text)));
});

test('scheduler restores and includes a saved reason after restart', async () => {
    const group = `restored-${Date.now()}@g.us`;
    const sent = [];
    const sock = {
        groupSettingUpdate: async () => {},
        sendMessage: async (...args) => sent.push(args),
    };
    core.schedules = [{ id: 'restored-reason', group, cron: '0 0 * * *', action: 'mute', once: false, time: 'midnight', reason: 'restored reason' }];
    core.activeCrons = {};
    const before = cronJobs.length;
    core.setupMuteSchedules(sock);
    await cronJobs[before].callback();
    assert.ok(sent.some(([, payload]) => /Reason: restored reason/.test(payload.text)));
});
