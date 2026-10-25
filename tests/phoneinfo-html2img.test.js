'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const originalPrefix = global.prefix;
global.prefix = '.';
const axiosCalls = [];
const axiosStub = {
    impl: async () => { throw new Error('Unexpected Axios request'); },
    get: async (...args) => {
        axiosCalls.push(args);
        return axiosStub.impl(...args);
    },
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
    if (request === 'axios') return axiosStub;
    return originalLoad.call(this, request, parent, isMain);
};
let phoneinfo;
let html2img;
try {
    const phonePath = require.resolve('../src/Commands/Search/Pinfo');
    const htmlPath = require.resolve('../src/Commands/Documents/html2img');
    delete require.cache[phonePath];
    delete require.cache[htmlPath];
    phoneinfo = require(phonePath);
    html2img = require(htmlPath)[0];
} finally {
    Module._load = originalLoad;
    if (originalPrefix === undefined) delete global.prefix;
    else global.prefix = originalPrefix;
}

const GROUP = '120363000000000000@g.us';
const REQUESTER = '15550000001@s.whatsapp.net';
const TARGET_LID = '987654321012@lid';
const TARGET_PHONE = '2348077528901@s.whatsapp.net';
const validPhoneInfo = {
    status: 'success',
    formatE164: '+2348077528901',
    countryName: 'Nigeria',
    numberCountryCode: '234',
    city: 'Lagos',
    regionName: 'Lagos',
    carrier: 'Example Carrier',
    numberType: 'mobile',
    timezone: 'Africa/Lagos',
    numberValid: true,
};

function makeMessage({ chat = GROUP, quotedSender, quotedParticipant } = {}) {
    const quoted = quotedSender || quotedParticipant
        ? { sender: quotedSender, key: { participant: quotedParticipant } }
        : undefined;
    return {
        chat,
        sender: REQUESTER,
        key: { id: 'command-1', remoteJid: chat, participant: REQUESTER },
        quoted,
        msg: {},
        message: {},
    };
}

function makeSock({ metadata } = {}) {
    const sent = [];
    return {
        sent,
        groupMetadata: async () => metadata || { participants: [{ id: REQUESTER, admin: 'admin' }] },
        sendMessage: async (...args) => { sent.push(args); return {}; },
    };
}

test('phoneinfo still accepts an explicit country-code number', async () => {
    axiosCalls.length = 0;
    axiosStub.impl = async () => ({ data: validPhoneInfo });
    const sock = makeSock();
    const replies = [];
    await phoneinfo.execute(sock, makeMessage(), {
        args: ['2348077528901'],
        reply: async text => replies.push(text),
        prefix: '.',
    });
    assert.equal(axiosCalls.length, 1);
    assert.equal(axiosCalls[0][1].params.number, '2348077528901');
    assert.equal(replies.length, 0);
    const result = sock.sent.find(([, content]) => content?.table);
    assert.ok(result, 'phone data is sent');
    assert.equal(result[2].quoted.chat, GROUP);
});

test('phoneinfo resolves a replied-to group member LID through group metadata', async () => {
    axiosCalls.length = 0;
    axiosStub.impl = async () => ({ data: validPhoneInfo });
    const sock = makeSock({ metadata: {
        participants: [
            { id: REQUESTER, admin: 'admin' },
            { id: TARGET_LID, lid: TARGET_LID, phoneNumber: TARGET_PHONE, admin: null },
        ],
    } });
    const replies = [];
    const m = makeMessage({ quotedSender: TARGET_LID });
    await phoneinfo.execute(sock, m, {
        args: [],
        reply: async text => replies.push(text),
        prefix: '.',
    });
    assert.equal(axiosCalls.length, 1);
    assert.equal(axiosCalls[0][1].params.number, '2348077528901');
    assert.equal(replies.length, 0);
    assert.ok(sock.sent.some(([, content]) => content?.table), 'reply receives the phone lookup result');
});

test('phoneinfo never treats unresolved LID digits as a real phone number', async () => {
    axiosCalls.length = 0;
    const sock = makeSock();
    const replies = [];
    await phoneinfo.execute(sock, makeMessage({ chat: REQUESTER, quotedParticipant: TARGET_LID }), {
        args: [],
        reply: async text => replies.push(text),
        prefix: '.',
    });
    assert.equal(axiosCalls.length, 0);
    assert.equal(replies.length, 1);
    assert.match(replies[0], /will not use LID digits/i);
});

test('phoneinfo limits replied-to group member lookups to group admins', async () => {
    axiosCalls.length = 0;
    const sock = makeSock({ metadata: {
        participants: [
            { id: REQUESTER, admin: null },
            { id: TARGET_LID, lid: TARGET_LID, phoneNumber: TARGET_PHONE, admin: null },
        ],
    } });
    const replies = [];
    await phoneinfo.execute(sock, makeMessage({ quotedSender: TARGET_LID }), {
        args: [],
        reply: async text => replies.push(text),
        prefix: '.',
    });
    assert.equal(axiosCalls.length, 0);
    assert.match(replies[0], /Only group admins/);
});

test('html2img sends HTML through sendHtmlMessage before trying image conversion', async () => {
    axiosCalls.length = 0;
    const htmlCalls = [];
    const sock = makeSock();
    sock.sendHtmlMessage = async (...args) => { htmlCalls.push(args); return { key: { id: 'rendered' } }; };
    const replies = [];
    const m = makeMessage();
    await html2img.execute(sock, m, {
        args: ['<main><h1>Hello</h1></main>'],
        reply: async text => replies.push(text),
    });
    assert.equal(htmlCalls.length, 1);
    assert.equal(htmlCalls[0][0], GROUP);
    assert.equal(htmlCalls[0][1].html, '<main><h1>Hello</h1></main>');
    assert.equal(htmlCalls[0][2].quoted, m);
    assert.equal(axiosCalls.length, 0, 'healthy native HTML rendering avoids the failing remote converter');
    assert.equal(replies.length, 0);
});

test('html2img keeps its image-service fallback when the native renderer is unavailable', async () => {
    axiosCalls.length = 0;
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    axiosStub.impl = async () => ({ data: image, headers: { 'content-type': 'image/png' } });
    const sock = makeSock();
    const replies = [];
    const m = makeMessage();
    await html2img.execute(sock, m, {
        args: ['<h1>Fallback</h1>'],
        reply: async text => replies.push(text),
    });
    assert.equal(axiosCalls.length, 1);
    assert.equal(sock.sent.find(([, content]) => content?.image)?.[1].image.toString('hex'), image.toString('hex'));
    assert.equal(replies.length, 0);
});

test('html2img falls back to the image service if native HTML rendering throws', async () => {
    axiosCalls.length = 0;
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    axiosStub.impl = async () => ({ data: image, headers: { 'content-type': 'image/png' } });
    const sock = makeSock();
    sock.sendHtmlMessage = async () => { throw new Error('renderer unavailable'); };
    const replies = [];
    await html2img.execute(sock, makeMessage(), {
        args: ['<h1>Fallback</h1>'],
        reply: async text => replies.push(text),
    });
    assert.equal(axiosCalls.length, 1);
    assert.ok(sock.sent.some(([, content]) => content?.image));
    assert.equal(replies.length, 0);
});
