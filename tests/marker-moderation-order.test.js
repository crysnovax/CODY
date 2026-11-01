'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('marked messages reach AntiLink and AntiTag before the AFK-marker return', () => {
    const source = fs.readFileSync(path.join(__dirname, '../?.js'), 'utf8');
    const branchStart = source.indexOf('if (m.body && m.body.includes(AFK_MARKER)) {');
    assert.notEqual(branchStart, -1, 'AFK-marker branch exists');
    const branchEnd = source.indexOf('\n            }\n\n            const _afkSender', branchStart);
    assert.notEqual(branchEnd, -1, 'AFK-marker branch has its expected end');

    const branch = source.slice(branchStart, branchEnd);
    const linkCall = branch.indexOf('handleAntiLink?.(sock, m, mek)');
    const tagCall = branch.indexOf('handleAntiTag?.(sock, m)');
    const earlyReturn = branch.indexOf('return;');
    assert.ok(linkCall >= 0 && linkCall < earlyReturn);
    assert.ok(tagCall >= 0 && tagCall < earlyReturn);
});
