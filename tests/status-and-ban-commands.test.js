const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'plogme') {
        return {
            downloadContentFromMessage: async function* () {
                yield Buffer.from('unused');
            }
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
const poststatus = require('../src/Commands/Owner/poststatus.js');
const groupstatus = require('../src/Commands/Owner/groupstatus.js');
const bancheck = require('../src/Commands/Owner/bancheck.js');
Module._load = originalLoad;

test('poststatus delegates personal status to sendStatus', async () => {
    const calls = [];
    const replies = [];
    const sock = {
        user: { id: '99999:0@s.whatsapp.net' },
        signalRepository: { lidMapping: {} },
        sendStatus: async content => {
            calls.push(content);
            return { key: { id: 'status-1' } };
        }
    };

    await poststatus.execute(sock, { chat: '99999@s.whatsapp.net', key: { id: 'm1' } }, {
        args: ['hello'],
        store: { contacts: new Map([['c', { id: '12345@s.whatsapp.net' }]]) },
        prefix: '.',
        reply: async value => replies.push(value)
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].text, 'hello');
    assert.match(replies[0], /Status posted successfully/i);
});

test('groupstatus sends audio through sendGroupStatus with selectable background', async () => {
    const calls = [];
    const replies = [];
    const sock = {
        sendGroupStatus: async (jid, content, options) => {
            calls.push({ jid, content, options });
            return { key: { id: 'group-status-1' } };
        }
    };
    const message = {
        chat: '12345@g.us',
        quoted: { message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', ptt: true } } }
    };

    await groupstatus.execute(sock, message, {
        args: ['--bg=#112233'],
        prefix: '.',
        reply: async value => replies.push(value),
        downloadQuotedMedia: async () => ({ type: 'audio', media: { mimetype: 'audio/ogg; codecs=opus', ptt: true }, buffer: Buffer.from('audio') })
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].jid, '12345@g.us');
    assert.equal(calls[0].content.audio.toString(), 'audio');
    assert.equal(calls[0].options.backgroundColor, '#112233');
    assert.match(replies[0], /Group status posted/i);
});

const realFetch = global.fetch;

function stubFetch(payload, { ok = true, status = 200 } = {}) {
    global.fetch = async () => ({ ok, status, json: async () => payload });
}

test('bancheck queries the keyless kyuux ban-status endpoint', async () => {
    const replies = [];
    let requestedUrl = '';
    global.fetch = async url => {
        requestedUrl = String(url);
        return {
            ok: true,
            status: 200,
            json: async () => ({
                success: true,
                data: { number: '15*****111', status: 'Safe', banned: false, info: { device: 'Unknown', email: 'Unknown' } }
            })
        };
    };

    try {
        await bancheck.execute({}, { chat: '12345@s.whatsapp.net' }, {
            args: ['+1 (555) 000-1111'],
            reply: async value => replies.push(value)
        });
    } finally {
        global.fetch = realFetch;
    }

    assert.match(requestedUrl, /kyuux-r\.indevs\.in\/api\/check-whatsapp\?phone=15550001111/);
    assert.match(replies[0], /Status: Safe/i);
    assert.match(replies[0], /Ban detected: NO/i);
    assert.match(replies[0], /ban-status endpoint/i);
});

test('bancheck reports a banned number as banned', async () => {
    stubFetch({
        success: true,
        data: { number: '23*****901', status: 'Unsafe', banned: true, info: { device: 'Android', email: 'Unknown' } }
    });
    const replies = [];
    try {
        await bancheck.execute({}, { chat: '12345@s.whatsapp.net' }, {
            args: ['2348077528901'],
            reply: async value => replies.push(value)
        });
    } finally {
        global.fetch = realFetch;
    }

    assert.match(replies[0], /Status: Unsafe/i);
    assert.match(replies[0], /Ban detected: YES/i);
});

test('bancheck debug mode returns safe diagnostics without raw response values', async () => {
    stubFetch({
        success: true,
        data: { number: '23*****901', status: 'Safe', banned: false, info: { device: 'Unknown', email: 'Unknown' } }
    });
    const replies = [];
    try {
        await bancheck.execute({}, { chat: '12345@s.whatsapp.net' }, {
            args: ['2348077528901', '--debug'],
            reply: async value => replies.push(value)
        });
    } finally {
        global.fetch = realFetch;
    }

    assert.match(replies[0], /Diagnostics \(safe metadata only\)/i);
    assert.match(replies[0], /Ban detected: NO/i);
    assert.match(replies[0], /Data keys: number/i);
});
