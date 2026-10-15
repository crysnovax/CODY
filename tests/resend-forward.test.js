'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const resend = require('../src/Commands/Owner/✆.js');

test('resend forwards a quoted poll as a native poll message', async () => {
    const sent = [];
    const source = {
        key: { remoteJid: 'source@g.us', id: 'poll-resend-1' },
        message: {
            pollCreationMessage: {
                name: 'Pick a color',
                options: [{ optionName: 'Red' }, { optionName: 'Blue' }],
                selectableOptionsCount: 1
            }
        }
    };

    await resend.execute({
        sendMessage: async (...args) => { sent.push(args); return {}; }
    }, {
        quoted: { fakeObj: source }
    }, {
        args: ['2348000000000'],
        reply: async text => { throw new Error(text); }
    });

    assert.deepEqual(sent, [[
        '2348000000000@s.whatsapp.net',
        { poll: { name: 'Pick a color', values: ['Red', 'Blue'], selectableCount: 1 } }
    ]]);
});
