'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

global.prefix ??= '.';

const commands = require('../src/Commands/Owner/baileys.js');
const groupicon = commands.find(command => command.name === 'setgroupicon');

test('groupicon updates the group picture through updateProfilePicture with HD enabled', async () => {
    const replies = [];
    const image = Buffer.from('fake-image');
    const calls = [];
    const sock = {
        updateProfilePicture: async (...args) => calls.push(args)
    };
    const message = {
        isGroup: true,
        chat: '12345-67890@g.us',
        quoted: {
            mimetype: 'image/jpeg',
            download: async () => image
        }
    };

    await groupicon.execute(sock, message, {
        reply: async text => replies.push(text),
        prefix: '.'
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], message.chat);
    assert.equal(calls[0][1], image);
    assert.deepEqual(calls[0][2], { hd: true });
    assert.match(replies[0], /Group icon updated \(HD\)/);
});

test('groupicon reports a clear error when the supported socket method is unavailable', async () => {
    const replies = [];
    await groupicon.execute({}, {
        isGroup: true,
        chat: '12345-67890@g.us',
        quoted: {
            mimetype: 'image/jpeg',
            download: async () => Buffer.from('fake-image')
        }
    }, {
        reply: async text => replies.push(text),
        prefix: '.'
    });

    assert.match(replies[0], /sock\.updateProfilePicture is not a function/);
});
