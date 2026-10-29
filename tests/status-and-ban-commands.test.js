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

test('bancheck posts to Baron0 with the configured Bearer token', async () => {
    const replies = [];
    let requestedUrl = '';
    let requestedOptions;
    const originalApiKey = process.env.BARON0_API_KEY;
    process.env.BARON0_API_KEY = 'test-baron0-token';
    global.fetch = async (url, options) => {
        requestedUrl = String(url);
        requestedOptions = options;
        return {
            ok: true,
            status: 200,
            json: async () => ({
                status: 'ok',
                number: '+15550001111',
                banned: false,
                reason: 'No ban found'
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
        if (originalApiKey === undefined) delete process.env.BARON0_API_KEY;
        else process.env.BARON0_API_KEY = originalApiKey;
    }

    assert.equal(requestedUrl, 'https://baron0.com/api/v2/check');
    assert.equal(requestedOptions.method, 'POST');
    assert.equal(requestedOptions.headers.Authorization, 'Bearer test-baron0-token');
    assert.equal(requestedOptions.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(requestedOptions.body), { number: '+15550001111' });
    assert.match(replies[0], /Status: Clean/i);
    assert.match(replies[0], /Ban detected: NO/i);
    assert.match(replies[0], /ban-status endpoint/i);
});

test('bancheck reports a banned number as banned', async () => {
    const originalApiKey = process.env.BARON0_API_KEY;
    process.env.BARON0_API_KEY = 'test-baron0-token';
    stubFetch({
        status: 'ok',
        number: '+2348077528901',
        banned: true,
        reason: 'Test reason'
    });
    const replies = [];
    try {
        await bancheck.execute({}, { chat: '12345@s.whatsapp.net' }, {
            args: ['2348077528901'],
            reply: async value => replies.push(value)
        });
    } finally {
        global.fetch = realFetch;
        if (originalApiKey === undefined) delete process.env.BARON0_API_KEY;
        else process.env.BARON0_API_KEY = originalApiKey;
    }

    assert.match(replies[0], /Status: Banned/i);
    assert.match(replies[0], /Ban detected: YES/i);
});

test('bancheck debug mode returns safe diagnostics without raw response values', async () => {
    const originalApiKey = process.env.BARON0_API_KEY;
    process.env.BARON0_API_KEY = 'test-baron0-token';
    stubFetch({
        status: 'ok',
        number: '+2348077528901',
        banned: false
    });
    const replies = [];
    try {
        await bancheck.execute({}, { chat: '12345@s.whatsapp.net' }, {
            args: ['2348077528901', '--debug'],
            reply: async value => replies.push(value)
        });
    } finally {
        global.fetch = realFetch;
        if (originalApiKey === undefined) delete process.env.BARON0_API_KEY;
        else process.env.BARON0_API_KEY = originalApiKey;
    }

    assert.match(replies[0], /Diagnostics \(safe metadata only\)/i);
    assert.match(replies[0], /Ban detected: NO/i);
    assert.match(replies[0], /Data keys: status, number, banned/i);
});

test('bancheck reports a missing BARON0_API_KEY without making a request', async () => {
    const originalApiKey = process.env.BARON0_API_KEY;
    delete process.env.BARON0_API_KEY;
    const replies = [];
    try {
        await bancheck.execute({}, { chat: '12345@s.whatsapp.net' }, {
            args: ['2349122083563'],
            reply: async value => replies.push(value)
        });
    } finally {
        if (originalApiKey !== undefined) process.env.BARON0_API_KEY = originalApiKey;
    }

    assert.match(replies[0], /BARON0_API_KEY is not configured/i);
});
