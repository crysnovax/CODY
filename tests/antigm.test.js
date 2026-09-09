const assert = require('node:assert/strict');
const test = require('node:test');

const command = require('../src/Commands/Admin/antigm.js');
const plogme = require('../src/Commands/Core/plogme.js');
const savemode = require('../src/Commands/Owner/savemode.js');
const { allVars, setVar, resetAll } = require('../src/Plugin/configManager');
const path = require('node:path');
const fsSync = require('node:fs');

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


test('SAVE_MODE blocks calls from unsaved contacts', async () => {
    const before = allVars();
    const calls = [];
    try {
        setVar('SAVE_MODE', true);
        const sock = {
            updateBlockStatus: async (jid, action) => calls.push(['block', jid, action]),
            rejectCall: async (id, jid) => calls.push(['reject', id, jid])
        };
        const blocked = await savemode.handleSaveModeCall(sock, {
            status: 'offer', id: 'call-1', from: '555123@s.whatsapp.net'
        }, { contacts: new Map() });
        assert.equal(blocked, true);
        assert.deepEqual(calls, [
            ['block', '555123@s.whatsapp.net', 'block'],
            ['reject', 'call-1', '555123@s.whatsapp.net']
        ]);
    } finally {
        resetAll();
        for (const [key, value] of Object.entries(before)) setVar(key, value);
    }
});

test('/play sends an audio/mpeg payload without a rich preview', () => {
    const source = fsSync.readFileSync(path.join(process.cwd(), 'src/Commands/Downloader/play.js'), 'utf8');
    assert.match(source, /'mimetype':'audio\/mpeg'/);
    assert.doesNotMatch(source, /'contextInfo':\{'externalAdReply'/);
});
