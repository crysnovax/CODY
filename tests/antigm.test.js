const assert = require('node:assert/strict');
const test = require('node:test');

const command = require('../src/Commands/Admin/antigm.js');
const plogme = require('../src/Commands/Core/plogme.js');

test('antigm exposes the antigroupstatus alias', () => {
    assert.ok(command.alias.includes('antigroupstatus'));
});

test('anti-group-status detects wrapped status mentions', () => {
    assert.equal(command.isStatusMention({
        message: {
            ephemeralMessage: {
                message: { groupStatusMentionMessage: { message: {} } },
            },
        },
    }), true);
});

test('PLOGME auto-replies are opt-in by default', () => {
    assert.equal(plogme.isEnabled('default-test-chat@s.whatsapp.net'), false);
});
