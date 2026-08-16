const assert = require('node:assert/strict');
const test = require('node:test');

const testcard = require('../src/Commands/Owner/testcard.js');

test('testcard sends the Meta AI-style image-backed rich grid', async () => {
    const calls = [];
    const replies = [];
    const sock = {
        sendRichButtonGrid: async (jid, payload) => {
            calls.push({ jid, payload });
            return {
                key: { id: 'grid-1' },
                message: { cards: payload.cards.map(card => ({ ...card, nativeFlow: card.buttons })) }
            };
        },
        sendMessage: async () => {
            throw new Error('fallback sendMessage should not be used');
        }
    };
    const message = { chat: '12345@g.us' };

    await testcard.execute(sock, message, {
        reply: async value => replies.push(value),
        args: [],
        text: ''
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].jid, message.chat);
    assert.equal(calls[0].payload.cards.length, 2);
    assert.ok(calls[0].payload.cards.every(card => card.image?.url));
    assert.ok(calls[0].payload.cards.every(card => card.buttons.length > 0));
    assert.match(calls[0].payload.text, /MENU/);
    assert.equal(replies.length, 1);
    assert.match(replies[0], /payload verified and relayed/i);
});

 test('testcard reports a clear error when the rich-grid helper is unavailable', async () => {
    const replies = [];
    const sock = {};

    await testcard.execute(sock, { chat: '12345@s.whatsapp.net' }, {
        reply: async value => replies.push(value),
        args: [],
        text: ''
    });

    assert.equal(replies.length, 1);
    assert.match(replies[0], /sendRichButtonGrid/i);
});
