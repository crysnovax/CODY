'use strict';
const fs = require('fs');
const path = require('path');

function supervisorState(name = process.env.CDLOG_NAME || 'cody') {
    const file = path.join(process.cwd(), '.cdlog', `${name}.json`);
    try {
        const state = JSON.parse(fs.readFileSync(file, 'utf8'));
        return state?.supervisorPid ? state : null;
    } catch { return null; }
}

function requestRestart(reason = 'manual', delayMs = 0) {
    const restart = () => {
        const state = supervisorState();
        if (state?.supervisorPid) {
            try {
                process.kill(Number(state.supervisorPid), 'SIGHUP');
                console.log(`[CDLOG] requested supervised restart: ${reason}`);
                return true;
            } catch (error) {
                console.warn('[CDLOG] supervisor restart failed:', error.message);
            }
        }
        // Local/legacy launches are still supported; cdloger will restart a
        // child that exits, while a direct node launch simply terminates.
        process.exit(0);
        return false;
    };
    if (delayMs > 0) setTimeout(restart, delayMs).unref?.();
    else restart();
}

module.exports = { requestRestart, supervisorState };
