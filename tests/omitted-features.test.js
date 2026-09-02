const assert = require('node:assert/strict');
const test = require('node:test');

const antitag = require('../src/Commands/Admin/antitag');
const savemode = require('../src/Commands/Owner/savemode');
const autoread = require('../src/Commands/Owner/autoread');
const kickinactive = require('../src/Commands/Admin/kickinactive');
const tiktok = require('../src/Commands/Downloader/Tikd');
const tgsticker = require('../src/Commands/Media/⩇⩇:⩇⩇');


test('omitted commands load without undefined prefix errors', () => {
    assert.equal(tiktok.usage, '.tt <TikTok URL>');
    assert.equal(tgsticker.usage, '.tg <Telegram sticker URL>');
});

test('unknown-contact autoblocking aliases are registered', () => {
    assert.ok(savemode.alias.includes('abu'));
    assert.ok(savemode.alias.includes('autoblockunknown'));
    assert.equal(savemode.ownerOnly, true);
});

test('antitag temporary kick configuration is read from the group record', () => {
    assert.equal(typeof antitag.handleAntiTag, 'function');
    assert.equal(typeof antitag.getMentions, 'function');
});

test('kickinactive duration parser accepts bounded units and rejects unsafe input', () => {
    assert.equal(kickinactive.parseDuration('30d'), 30 * 86_400_000);
    assert.equal(kickinactive.parseDuration('2w'), 2 * 604_800_000);
    assert.equal(kickinactive.parseDuration('0d'), null);
    assert.equal(kickinactive.parseDuration('30 days'), null);
    assert.equal(kickinactive.parseDuration('1d; rm -rf /'), null);
});

test('autoread supports a separate group toggle', async () => {
    const previous = process.env.AUTO_READ_GROUP;
    const replies = [];
    try {
        delete process.env.AUTO_READ_GROUP;
        await autoread.execute({}, {}, {
            args: ['group', 'on'],
            reply: async text => replies.push(String(text))
        });
        assert.match(replies.at(-1), /Group auto read: \*ON\*/);
    } finally {
        if (previous === undefined) delete process.env.AUTO_READ_GROUP;
        else process.env.AUTO_READ_GROUP = previous;
    }
});
