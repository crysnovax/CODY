// uptime.js — keeps the bot's uptime alive across controlled update/redeploy restarts.
// A manual restart still starts a fresh uptime counter.
// @crysnovax—FIX06-08-26
const fs = require('fs');
const path = require('path');

const UPTIME_FILE = path.join(process.cwd(), 'database', 'uptime.json');

// Called right before a controlled restart so the clock carries over.
function markRestart() {
    try {
        const startTime = global.crysStats?.startTime || Date.now();
        fs.mkdirSync(path.dirname(UPTIME_FILE), { recursive: true });
        fs.writeFileSync(UPTIME_FILE, JSON.stringify({ restartFlag: true, startTime }, null, 2));
        console.log('[UPTIME] controlled restart marked — uptime will carry over');
    } catch (err) {
        console.error('[UPTIME] mark failed:', err.message);
    }
}

// Called on boot. If the last shutdown was a controlled restart, reuse the old startTime.
// The flag is always cleared afterwards, so a normal restart starts fresh.
function restoreOnBoot(stats) {
    try {
        if (!stats) return;
        if (!fs.existsSync(UPTIME_FILE)) return;

        const data = JSON.parse(fs.readFileSync(UPTIME_FILE, 'utf8'));
        if ((data.restartFlag || data.updateFlag) && data.startTime) {
            stats.startTime = data.startTime;
            console.log('[UPTIME] restored startTime — uptime preserved');
        }
        fs.rmSync(UPTIME_FILE, { force: true });
    } catch (err) {
        console.error('[UPTIME] restore failed:', err.message);
    }
}

module.exports = { markRestart, markUpdateRestart: markRestart, restoreOnBoot };
