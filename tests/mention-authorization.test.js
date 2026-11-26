'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const mention = require('../src/Commands/Owner/mention');

function message(sender, mentionedJid) {
    return {
        sender,
        key: { fromMe: false, participant: sender },
        mentionedJid,
        message: { extendedTextMessage: { contextInfo: { mentionedJid } } },
        msg: { contextInfo: { mentionedJid } },
    };
}

const sock = {
    user: { id: '99999@s.whatsapp.net', lid: '99999@lid' },
};

test('ordinary sender tagging the bot is an explicit mention but not a privileged target', async () => {
    const tagged = message('member@s.whatsapp.net', ['99999@s.whatsapp.net']);
    assert.equal(mention.isExplicitlyMentioned(tagged), true);
    assert.equal(await mention.isPrivilegedMentioned(sock, tagged), false);
});

test('ordinary sender tagging another user is not a privileged target', async () => {
    assert.equal(
        await mention.isPrivilegedMentioned(sock, message('member@s.whatsapp.net', ['other@s.whatsapp.net'])),
        false
    );
});

test('configured mention behavior only recognizes an explicit bot target', async () => {
    assert.equal(
        await mention.isBotExplicitlyMentioned(sock, message('member@s.whatsapp.net', ['other@s.whatsapp.net'])),
        false
    );
    assert.equal(
        await mention.isBotExplicitlyMentioned(sock, message('member@s.whatsapp.net', ['99999@s.whatsapp.net'])),
        true
    );
});

test('quoted message mentions do not become explicit bot tags', async () => {
    const quotedOnly = {
        sender: 'member@s.whatsapp.net',
        key: { fromMe: false, participant: 'member@s.whatsapp.net' },
        quoted: {
            sender: 'other@s.whatsapp.net',
            message: { extendedTextMessage: { contextInfo: { mentionedJid: ['99999@s.whatsapp.net'] } } }
        }
    };
    assert.equal(await mention.isBotExplicitlyMentioned(sock, quotedOnly), false);
});

test('only a privileged sender tagging the bot is marked for downstream suppression', async () => {
    const previousSudo = process.env.SUDO_NUMBERS;
    process.env.SUDO_NUMBERS = '77777';
    try {
        assert.equal(
            await mention.isPrivilegedBotMention(sock, message('member@s.whatsapp.net', ['99999@s.whatsapp.net'])),
            false
        );
        assert.equal(
            await mention.isPrivilegedBotMention(sock, message('77777@s.whatsapp.net', ['99999@lid'])),
            true
        );
    } finally {
        if (previousSudo === undefined) delete process.env.SUDO_NUMBERS;
        else process.env.SUDO_NUMBERS = previousSudo;
    }
});

test('bot phone and LID identities are not owner/sudo/dual filter identities', async () => {
    const privileged = await mention.getPrivilegedIdentities(sock);
    assert.equal(privileged.has('99999@s.whatsapp.net'), false);
    assert.equal(privileged.has('99999@lid'), false);
});
