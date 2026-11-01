'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const plogme = require('../src/Commands/Core/plogme');
const { registerCommand } = require('../src/Plugin/crysCmd');
const leaveCommand = require('../src/Commands/Group/Leave');

registerCommand(leaveCommand);

test('Plogme cannot execute .exit or its leavegc alias, even though the command is registered', async () => {
    let leaveCalls = 0;
    const sock = { async groupLeave() { leaveCalls += 1; } };
    const opts = { reply: async () => {} };

    for (const target of ['exit', 'leavegc', '.exit', '.leavegc']) {
        const result = await plogme.runCommandAction(sock, { chat: 'test@g.us', isGroup: true }, opts, target);
        assert.match(result, /\.exit is disabled for PLOGME/i);
    }

    assert.equal(leaveCalls, 0);
});

test('Plogme is instructed to stay in groups and cannot see exit commands in its catalog', () => {
    const commands = plogme.commandNameList();
    assert.equal(commands.includes('exit'), false);
    assert.equal(commands.includes('leavegc'), false);

    const safetyRule = /must never leave, exit, or disconnect from a WhatsApp group[\s\S]*\.exit and \.leavegc commands are disabled[\s\S]*mentioning\/tagging you/i;
    assert.match(plogme.buildPrompt('test@g.us', '@Plogme please help'), safetyRule);
    assert.match(plogme.buildClassifierPrompt('@Plogme please help'), safetyRule);
});
