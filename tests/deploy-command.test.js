const test = require('node:test');
const assert = require('node:assert/strict');
const deploy = require('../src/Commands/System/deploy');

test('deploy opens the only Gen4 menu with current panel and tutorial links', async () => {
    const calls = [];
    const replies = [];
    const sock = {
        richMenu: async (...args) => {
            calls.push(args);
            return { key: { id: 'deploy-menu-1' } };
        }
    };
    const message = { chat: '123@s.whatsapp.net', key: { id: 'request-1' } };

    await deploy.execute(sock, message, { args: [], reply: text => replies.push(text) });

    assert.equal(calls.length, 1);
    const payload = calls[0][1];
    assert.equal(payload.header.title, 'CODY AI Deployment Guide');
    assert.equal(payload.footer.url, 'https://sl.crysnovax.link/tutorial5');
    assert.match(payload.body.cards[0].buttons[0].id, /^\.deploy step1 --menu=[a-z0-9]+$/);
    assert.match(payload.body.cards[1].buttons[0].id, /^\.deploy step4 --menu=[a-z0-9]+$/);
    assert.equal(replies.length, 0);
    assert.deepEqual(deploy.alias, ['pair']);
});

test('repeated menu builds receive fresh callback namespaces', () => {
    const first = deploy._internals.buildMenuPayload();
    const second = deploy._internals.buildMenuPayload();
    assert.notEqual(first.body.cards[0].buttons[0].id, second.body.cards[0].buttons[0].id);
});

test('step1 sends one quoted rich table and no second Gen4 menu', async () => {
    const messages = [];
    const menus = [];
    const sock = {
        richMenu: async (...args) => menus.push(args),
        sendMessage: async (...args) => {
            messages.push(args);
            return { key: { id: 'deploy-step-1' } };
        }
    };
    const message = { chat: '123@s.whatsapp.net', key: { id: 'request-2' }, message: { conversation: 'Step 1 · Discord' } };

    await deploy.execute(sock, message, { args: ['step1'], reply: () => { throw new Error('step must not use plain reply'); } });

    assert.equal(menus.length, 0);
    assert.equal(messages.length, 1);
    assert.equal(messages[0][0], message.chat);
    assert.deepEqual(messages[0][2], { quoted: message });
    const content = messages[0][1];
    assert.ok(Array.isArray(content.richResponse));
    assert.equal(content.richResponse.length, 2);
    assert.match(content.richResponse[0].text, /Step 1/);
    assert.equal(content.richResponse[1].title, 'Step 1 · Discord account');
    assert.equal(content.richResponse[1].table[0].isHeading, true);
    assert.match(content.richResponse[1].table[1].items[1], /discord\.com/);
});

test('step3 sends one rich table with code and no Gen4 menu', async () => {
    const messages = [];
    const menus = [];
    const sock = {
        richMenu: async (...args) => menus.push(args),
        sendMessage: async (...args) => {
            messages.push(args);
            return { key: { id: 'deploy-step-3' } };
        }
    };
    const message = { chat: '123@s.whatsapp.net', key: { id: 'request-3' } };

    await deploy.execute(sock, message, { args: ['step3'], reply: () => { throw new Error('step must not use plain reply'); } });

    assert.equal(menus.length, 0);
    assert.equal(messages.length, 1);
    const content = messages[0][1];
    assert.equal(content.richResponse.length, 3);
    assert.match(content.richResponse[1].table[3].items[1], /country-code/);
    assert.equal(content.richResponse[2].language, 'javascript');
    assert.match(content.richResponse[2].code[0].codeContent, /index\.js/);
});

test('deploy reports a clear message when richMenu is unavailable', async () => {
    const replies = [];
    const message = { chat: '123@s.whatsapp.net', key: { id: 'request-4' } };

    await deploy.execute({}, message, { args: [], reply: text => replies.push(text) });

    assert.match(replies[0], /richMenu is unavailable/);
    assert.match(replies[0], /2\.7\.12/);
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
