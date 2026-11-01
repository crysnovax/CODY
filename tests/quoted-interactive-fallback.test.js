'use strict';

const assert = require('node:assert/strict');
const { after, test } = require('node:test');
global.prefix = '.';
const quotedCommand = require('../src/Commands/Admin/qt');

after(() => {
    delete global.prefix;
});

function makeSocket() {
    const sent = [];
    return {
        sent,
        async sendMessage(chat, content, options) {
            sent.push({ chat, content, options });
        },
    };
}

function interactiveMessage() {
    return {
        interactiveMessage: {
            body: { text: 'Owner details and link text' },
            footer: { text: 'Bot footer' },
            nativeFlowMessage: {
                buttons: [{ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: 'Open', url: 'https://example.org/channel' }) }],
            },
        },
    };
}

async function runQuoted(targetMessage) {
    const chat = 'room@g.us';
    const sock = makeSocket();
    const replies = [];
    await quotedCommand.execute(sock, {
        chat,
        key: { remoteJid: chat, id: 'command-1' },
        quoted: {
            id: 'target-1',
            chat,
            fakeObj: {
                key: { remoteJid: chat, id: 'target-1', fromMe: false },
                message: targetMessage,
            },
        },
    }, { reply: text => replies.push(text), store: null, prefix: '.' });
    return { sock, replies };
}

for (const [name, target] of [
    ['direct interactive message', interactiveMessage()],
    ['interactive message nested in a quoted reply', {
        extendedTextMessage: {
            text: 'Link detected',
            contextInfo: { quotedMessage: interactiveMessage() },
        },
    }],
]) {
    test(`.quoted returns body and CTA URL for ${name}`, async () => {
        const { sock, replies } = await runQuoted(target);
        const sentText = sock.sent.find(({ content }) => typeof content?.text === 'string')?.content.text;
        assert.match(sentText || '', /Owner details and link text/);
        assert.match(sentText || '', /Bot footer/);
        assert.match(sentText || '', /https:\/\/example\.org\/channel/);
        assert.deepEqual(replies, []);
    });
}

test('.quoted returns the content nested in an AntiLink notice when another outer contextInfo exists', async () => {
    const originalText = '⊘ That message has no quoted message inside it.\nwa.me/2347066248340';
    const target = {
        contextInfo: { participant: 'bot@s.whatsapp.net' },
        extendedTextMessage: {
            text: 'ⓘ Link detected! Links are not allowed here. Message deleted.',
            contextInfo: { quotedMessage: { conversation: originalText } },
        },
    };
    const { sock, replies } = await runQuoted(target);
    const sentText = sock.sent.find(({ content }) => typeof content?.text === 'string')?.content.text;
    assert.equal(sentText, originalText);
    assert.deepEqual(replies, []);
});
