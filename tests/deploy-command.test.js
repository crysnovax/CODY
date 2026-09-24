const test = require('node:test');
const assert = require('node:assert/strict');
const deploy = require('../src/Commands/System/deploy');

test('deploy opens a plogme 2.0.5 rich button grid', async () => {
    const calls = [];
    const replies = [];
    const sock = {
        sendRichButtonGrid: async (...args) => {
            calls.push(args);
            return { key: { id: 'deploy-menu-1' } };
        }
    };
    const message = { chat: '123@s.whatsapp.net', key: { id: 'request-1' } };

    await deploy.execute(sock, message, { args: [], reply: text => replies.push(text) });

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], message.chat);
    assert.deepEqual(calls[0][2], { quoted: message });
    const grid = calls[0][1];
    assert.match(grid.text, /CODY AI Deployment Guide/);
    assert.equal(grid.cards.length, 2);
    assert.equal(grid.cards[0].image.url, 'https://cdn.crysnovax.link/files/1786913837400-12ad05cc-468a-4d71-8de8-1e5a11b48f3b.jpeg');
    assert.match(grid.cards[0].buttons[0].id, /^\.deploy step1 --menu=[a-z0-9]+$/);
    assert.match(grid.cards[1].buttons[0].id, /^\.deploy step4 --menu=[a-z0-9]+$/);
    assert.equal(replies.length, 0);
    assert.deepEqual(deploy.alias, ['pair']);
});

test('repeated menu builds receive fresh callback namespaces', () => {
    const first = deploy._internals.buildMenuPayload();
    const second = deploy._internals.buildMenuPayload();
    assert.notEqual(first.cards[0].buttons[0].id, second.cards[0].buttons[0].id);
});

test('step1 sends one quoted plogme rich table', async () => {
    const messages = [];
    const sock = {
        sendPlogmeMessage: async (...args) => {
            messages.push(args);
            return { key: { id: 'deploy-step-1' } };
        }
    };
    const message = { chat: '123@s.whatsapp.net', key: { id: 'request-2' } };

    await deploy.execute(sock, message, { args: ['step1'], reply: () => { throw new Error('step must not use plain reply'); } });

    assert.equal(messages.length, 1);
    assert.equal(messages[0][0], message.chat);
    assert.equal(messages[0][2], message);
    assert.equal(messages[0][3].renderRichResponse, true);
    const content = messages[0][1];
    assert.match(content.headerText, /Step 1/);
    assert.equal(content.table[0][0], 'Item');
    assert.match(content.table[1][1], /discord\.com/);
});

test('step3 sends one plogme rich table with code', async () => {
    const messages = [];
    const sock = {
        sendPlogmeMessage: async (...args) => {
            messages.push(args);
            return { key: { id: 'deploy-step-3' } };
        }
    };
    const message = { chat: '123@s.whatsapp.net', key: { id: 'request-3' } };

    await deploy.execute(sock, message, { args: ['step3'], reply: () => { throw new Error('step must not use plain reply'); } });

    const content = messages[0][1];
    assert.match(content.table[3][1], /country-code/);
    assert.equal(content.code, 'Owner number: 234xxxxxxxxx\nGenerated file: index.js');
    assert.equal(content.language, 'javascript');
});

test('deploy reports a clear message when the current grid API is unavailable', async () => {
    const replies = [];
    const message = { chat: '123@s.whatsapp.net', key: { id: 'request-4' } };

    await deploy.execute({}, message, { args: [], reply: text => replies.push(text) });

    assert.match(replies[0], /sendRichButtonGrid is unavailable/);
    assert.match(replies[0], /2\.0\.5/);
});

test('tutorials sends the requested reels grid instead of a rich table', async () => {
    const calls = [];
    const sock = {
        sendReels: async (...args) => { calls.push(args); return { key: { id: 'tutorial-reels-1' } }; }
    };
    const message = { chat: '123@g.us', key: { id: 'request-tutorials' } };

    await deploy.execute(sock, message, { args: ['tutorials'], reply: () => { throw new Error('tutorials must use reels'); } });

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], message.chat);
    assert.equal(calls[0][2], message);
    assert.match(calls[0][1][0].videoUrl, /tutorial5$/);
    assert.match(calls[0][1][1].videoUrl, /tutorial3$/);
    assert.match(calls[0][1][2].videoUrl, /pair\.crysnovax\.link$/);
    assert.match(calls[0][1][3].videoUrl, /PANEL2$/);
    assert.equal(calls[0][1][0].is_verified, true);
});
