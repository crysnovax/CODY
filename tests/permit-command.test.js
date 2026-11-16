'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const permit = require('../src/Commands/Owner/permit');
const { DB_PATH, readDB } = require('../src/Plugin/antiPermit');

test('permit executes for a dispatcher-authorized dual identity', async () => {
    const dbDir = path.dirname(DB_PATH);
    fs.mkdirSync(dbDir, { recursive: true });
    const hadDb = fs.existsSync(DB_PATH);
    const original = hadDb ? fs.readFileSync(DB_PATH) : null;
    const replies = [];

    try {
        if (hadDb) fs.unlinkSync(DB_PATH);
        await permit.execute(
            {},
            { chat: '120363000000000000@g.us' },
            {
                args: ['2347000000000'],
                prefix: '/',
                isOwner: false,
                isDual: true,
                isSudo: false,
                reply: async text => replies.push(text),
            }
        );

        assert.equal(readDB().groups['120363000000000000@g.us'][0], '2347000000000@s.whatsapp.net');
        assert.match(replies[0], /now immune/i);
    } finally {
        if (hadDb) fs.writeFileSync(DB_PATH, original);
        else if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    }
});
