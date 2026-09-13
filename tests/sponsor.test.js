const test = require('node:test');
const assert = require('node:assert/strict');

const sponsor = require('../src/Commands/Core/sponsor');
const repo = require('../src/Commands/Core/⎙.js');

function message() {
    return { chat: '123@s.whatsapp.net', key: { remoteJid: '123@s.whatsapp.net' } };
}

test('sponsor builds a URL button for the official sponsorship page', () => {
    const payload = sponsor._internals.buildSponsorPayload('https://example.com/sponsor');
    assert.equal(payload.cards[0].buttons[0].id, 'cody_sponsor');
    assert.equal(payload.cards[0].buttons[0].url, 'https://example.com/sponsor');
    assert.equal(payload.cards[0].buttons[0].text, 'Sponsor CODY');
});

test('sponsor uses the rich button grid when plogme supports it', async () => {
    const calls = [];
    const sock = {
        sendRichButtonGrid: async (...args) => calls.push(args)
    };
    await sponsor.execute(sock, message(), { reply: assert.fail });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '123@s.whatsapp.net');
    assert.equal(calls[0][1].cards[0].buttons[0].id, 'cody_sponsor');
    assert.match(calls[0][1].cards[0].buttons[0].url, /^https:\/\/github\.com\/sponsors\//);
});

test('sponsor falls back to a normal URL button on older runtimes', async () => {
    const calls = [];
    const sock = {
        sendMessage: async (...args) => calls.push(args)
    };
    await sponsor.execute(sock, message(), { reply: assert.fail });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '123@s.whatsapp.net');
    assert.equal(calls[0][1].buttons[0].text, 'Sponsor CODY');
    assert.match(calls[0][1].buttons[0].url, /^https:\/\/github\.com\/sponsors\//);
});

test('repo creator panel includes a Sponsor CODY rich button', async () => {
    const calls = [];
    const sock = {
        sendMessage: async (...args) => calls.push(['message', ...args]),
        sendRichButtonGrid: async (...args) => calls.push(['grid', ...args])
    };
    await repo.execute(sock, message(), { reply: assert.fail });
    const grid = calls.find(call => call[0] === 'grid');
    assert.ok(grid, 'creator panel should send a rich sponsor button');
    assert.equal(grid[2].cards[0].buttons[0].id, 'cody_sponsor');
    assert.equal(grid[2].cards[0].buttons[0].text, 'Sponsor CODY');
});
