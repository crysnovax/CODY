'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pollCommand = require('../src/Commands/Group/Poll');

const stableImage = 'https://cdn.crysnova.qzz.io/files/stable.jpg';
const betaImage = 'https://cdn.crysnova.qzz.io/files/beta.jpg';

test('poll parser builds image options and supports expiry, hidden voters, and locked option list', () => {
    const before = Date.now();
    const result = pollCommand.parsePollInput([
        `Release preference | Stable :: ${stableImage} | Beta :: ${betaImage} --select 1 --end 8h --hide-voter --no-add-option`,
    ]);
    const after = Date.now();
    assert.equal(result.error, undefined);
    assert.deepEqual(result.poll.values, [
        { name: 'Stable', image: { url: stableImage } },
        { name: 'Beta', image: { url: betaImage } },
    ]);
    assert.equal(result.poll.name, 'Release preference');
    assert.equal(result.poll.selectableCount, 1);
    assert.equal(result.poll.hideVoter, true);
    assert.equal(result.poll.canAddOption, false);
    assert.ok(result.poll.endDate instanceof Date);
    assert.ok(result.poll.endDate.getTime() >= before + 8 * 60 * 60 * 1000);
    assert.ok(result.poll.endDate.getTime() <= after + 8 * 60 * 60 * 1000);
});

test('poll parser keeps legacy single and multi poll syntax and supports selectable count override', () => {
    const single = pollCommand.parsePollInput(['Who is best? | Ronaldo | Messi']);
    assert.deepEqual(single.poll, { name: 'Who is best?', values: ['Ronaldo', 'Messi'], selectableCount: 1 });

    const multi = pollCommand.parsePollInput(['multi Choose | A | B | C']);
    assert.equal(multi.poll.selectableCount, 0);

    const selected = pollCommand.parsePollInput(['Choose | A | B | C --select 2 --show-voter --can-add-option']);
    assert.equal(selected.poll.selectableCount, 2);
    assert.equal(selected.poll.hideVoter, false);
    assert.equal(selected.poll.canAddOption, true);
});

test('poll parser accepts a future ISO date and rejects invalid or expired poll settings', () => {
    const isoDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const future = pollCommand.parsePollInput([`Choose | A | B --end ${isoDate}`]);
    assert.equal(future.poll.endDate.toISOString(), isoDate);
    assert.match(pollCommand.parsePollInput(['Choose | A | B --end yesterday']).error, /future date/);
    assert.match(pollCommand.parsePollInput(['Choose | A | B --select 4']).error, /Selectable count/);
    assert.match(pollCommand.parsePollInput(['Choose | A :: file:///etc/passwd | B']).error, /Invalid image URL/);
});

test('poll command sends the extended poll object through sendMessage', async () => {
    const sent = [];
    const replies = [];
    await pollCommand.execute({ sendMessage: async (...args) => sent.push(args) }, {
        chat: 'poll-group@g.us', key: { id: 'quoted-message' },
    }, {
        args: [`Release preference | Stable :: ${stableImage} | Beta :: ${betaImage} --end 8h --hide-voter --no-add-option`],
        prefix: '.', reply: async message => replies.push(message),
    });
    assert.equal(sent.length, 1);
    assert.equal(sent[0][0], 'poll-group@g.us');
    assert.equal(sent[0][1].poll.values[0].image.url, stableImage);
    assert.equal(sent[0][1].poll.hideVoter, true);
    assert.equal(sent[0][1].poll.canAddOption, false);
    assert.ok(sent[0][1].poll.endDate instanceof Date);
    assert.deepEqual(sent[0][2], { quoted: { chat: 'poll-group@g.us', key: { id: 'quoted-message' } } });
    assert.deepEqual(replies, []);
});
