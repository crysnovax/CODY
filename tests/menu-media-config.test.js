'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const originalLoad = Module._load;
const runtimeVars = {};
const menuPath = /\/src\/Commands\/Bot\/ⓘ\.js$/;

Module._load = function (request, parent, isMain) {
    if (menuPath.test(parent?.filename || '')) {
        if (request === '../../Plugin/crysCmd') return { getByCategory: () => ({}), getAll: () => new Map() };
        if (request === '../../Plugin/configManager') return { getVar: name => runtimeVars[name] };
        if (request === '../../Utils/timezone') return { formatBotDateTime: () => '12:00:00 PM' };
        if (request === "../Core/'.js'") return { fancy35: value => value };
        if (request === '../../../settings/config') return { thumbUrl: '' };
    }
    return originalLoad.call(this, request, parent, isMain);
};

let menu;
try {
    menu = require('../src/Commands/Bot/ⓘ.js');
} finally {
    Module._load = originalLoad;
}

const envNames = ['MENU_GIF', 'MENU_IMG', 'MENU_VIDEO', 'MENU_URL', 'THUMB_URL'];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));

async function runMenu(args = []) {
    const sent = { live: [], messages: [] };
    const sock = {
        sendPhotoLive: async (...call) => sent.live.push(call),
        sendMessage: async (...call) => sent.messages.push(call)
    };
    await menu.execute(sock, { chat: '123@g.us', pushName: 'Tester' }, {
        args,
        reply: async text => { throw new Error(`Unexpected menu reply: ${text}`); },
        prefix: '.',
        config: {}
    });
    return sent;
}

function clearMediaSettings() {
    for (const name of envNames) delete process.env[name];
    for (const name of envNames) delete runtimeVars[name];
}

test('dedicated menu media variables fully replace live photo and MENU_URL media', async t => {
    t.after(() => {
        clearMediaSettings();
        for (const [name, value] of Object.entries(originalEnv)) {
            if (value !== undefined) process.env[name] = value;
        }
        for (const name of envNames) delete runtimeVars[name];
    });
    clearMediaSettings();

    runtimeVars.MENU_URL = 'https://example.test/parent-image.jpg';
    process.env.MENU_GIF = 'https://example.test/custom.gif';
    let sent = await runMenu();
    assert.equal(sent.live.length, 0);
    assert.equal(sent.messages.length, 1);
    assert.equal(sent.messages[0][1].video.url, process.env.MENU_GIF);
    assert.equal(sent.messages[0][1].gifPlayback, true);
    assert.equal(sent.messages[0][1].image, undefined);

    clearMediaSettings();
    process.env.MENU_IMG = 'https://example.test/menu.png';
    sent = await runMenu();
    assert.equal(sent.live.length, 0);
    assert.equal(sent.messages[0][1].image.url, process.env.MENU_IMG);
    assert.equal(sent.messages[0][1].video, undefined);
    assert.equal(sent.messages[0][1].gifPlayback, undefined);

    clearMediaSettings();
    runtimeVars.MENU_VIDEO = 'https://example.test/menu.mp4';
    sent = await runMenu();
    assert.equal(sent.live.length, 0);
    assert.equal(sent.messages[0][1].video.url, runtimeVars.MENU_VIDEO);
    assert.equal(sent.messages[0][1].gifPlayback, undefined);
    assert.equal(sent.messages[0][1].image, undefined);
});

test('MENU_URL alone retains the default live-photo behavior', async t => {
    t.after(() => {
        clearMediaSettings();
        for (const [name, value] of Object.entries(originalEnv)) {
            if (value !== undefined) process.env[name] = value;
        }
        for (const name of envNames) delete runtimeVars[name];
    });
    clearMediaSettings();
    runtimeVars.MENU_URL = 'https://example.test/menu.jpg';

    const sent = await runMenu();
    assert.equal(sent.messages.length, 0);
    assert.equal(sent.live.length, 1);
    assert.equal(sent.live[0][1].thumbnail, runtimeVars.MENU_URL);
    assert.match(sent.live[0][1].video, /\.mp4$/);
});
