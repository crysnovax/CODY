const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'sharp') {
        return () => ({ resize() { return this; }, jpeg() { return this; }, toBuffer: async () => Buffer.from('image') });
    }
    if (request === 'plogme') {
        return {
            prepareWAMessageMedia: async () => ({ imageMessage: {} }),
            generateWAMessageContent: async () => ({ groupStatusMessageV2: {} }),
            generateMessageIDV2: () => 'status-id',
            buildLinkPreview: async url => ({ title: url, description: '' })
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const gstatus = require('../src/Commands/Group/⤷.js');
const mention = require('../src/Commands/Owner/mention.js');
Module._load = originalLoad;

test('gstatus parses named backgrounds and copy-caption options', () => {
    assert.deepEqual(gstatus.parseStatusOptions('--bg=red --cp=Copied caption'), {
        backgroundColor: '#FF6B6B',
        copyCaption: false,
        caption: 'Copied caption',
        cleanText: ''
    });
    assert.deepEqual(gstatus.parseStatusOptions('-cp --bg=#112233'), {
        backgroundColor: '#112233',
        copyCaption: true,
        caption: undefined,
        cleanText: ''
    });
});

test('gstatus recognizes gstatusall and id<JID> routing', () => {
    assert.equal(gstatus.resolveStatusTarget('gstatusall', [], '12345@g.us'), 'all');
    assert.equal(gstatus.resolveStatusTarget('gstatus', ['id120363425204601114@g.us'], '12345@g.us'), '120363425204601114@g.us');
});

test('mention text configuration does not throw valueSlice', async () => {
    const replies = [];
    await mention.execute({}, { key: { fromMe: true } }, {
        args: ['-text', 'Busy, back later'],
        prefix: '.',
        reply: async value => replies.push(value)
    });
    assert.match(replies[0], /Busy, back later/);
});

test('gstatusall broadcasts replied media with explicit caption and named background', async () => {
    const calls = [];
    const replies = [];
    const sock = {
        user: { id: '99999@s.whatsapp.net' },
        sendMessage: async () => {},
        groupFetchAllParticipating: async () => ({ '111@g.us': {}, '222@g.us': {} }),
        sendGroupStatus: async (jid, content, options) => {
            calls.push({ jid, content, options });
            return { key: { id: `status-${calls.length}` } };
        }
    };
    const message = {
        chat: '999@g.us',
        sender: '99999@s.whatsapp.net',
        key: { id: 'm1' },
        quoted: {
            mtype: 'imageMessage',
            caption: 'old caption',
            download: async () => Buffer.from('image')
        }
    };
    await gstatus.execute(sock, message, {
        command: 'gstatusall',
        text: '',
        args: ['--cp=New caption', '--bg=red'],
        reply: async value => replies.push(value)
    });
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.content.image.toString() === 'image'));
    assert.ok(calls.every(call => call.content.caption === 'New caption'));
    assert.ok(calls.every(call => call.options.backgroundColor === '#FF6B6B'));
    assert.match(replies.at(-1), /Broadcast Done/i);
});
