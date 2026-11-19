'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');
const path = require('node:path');

const envPath = path.join(process.cwd(), '.env');
const userConfigPath = path.join(__dirname, '../database/user-config.json');
const envNames = ['MENU_GIF', 'MENU_IMG', 'MENU_VIDEO', 'MENU_URL', 'THUMB_URL'];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const runtimeVars = {};
const deletedRuntimeKeys = [];
const pendingWrites = new Map();
let envContents = [
    '# keep this comment',
    'MENU_GIF=https://example.test/menu.gif',
    'MENU_IMG=https://example.test/menu.png',
    'export MENU_VIDEO=https://example.test/menu.mp4',
    'MENU_URL=https://example.test/menu-url.mp4',
    'THUMB_URL=https://example.test/thumb.jpg',
    'OTHER_SETTING=keep-me',
    ''
].join('\r\n');
let userConfigContents = JSON.stringify({
    owner: { number: '15550000000' },
    thumbUrl: 'https://example.test/user-config-menu.mp4',
    unrelated: true
}, null, 2);

const fakeFs = {
    existsSync(filePath) {
        return filePath === envPath || filePath === userConfigPath;
    },
    readFileSync(filePath) {
        if (filePath === envPath) return envContents;
        if (filePath === userConfigPath) return userConfigContents;
        throw new Error(`Unexpected read: ${filePath}`);
    },
    statSync() {
        return { mode: 0o100600 };
    },
    writeFileSync(filePath, contents) {
        pendingWrites.set(filePath, String(contents));
    },
    renameSync(tempPath, filePath) {
        if (!pendingWrites.has(tempPath)) throw new Error('Expected atomic temporary file');
        const contents = pendingWrites.get(tempPath);
        pendingWrites.delete(tempPath);
        if (filePath === envPath) envContents = contents;
        else if (filePath === userConfigPath) userConfigContents = contents;
        else throw new Error(`Unexpected write target: ${filePath}`);
    },
    unlinkSync(filePath) {
        pendingWrites.delete(filePath);
    }
};

const originalLoad = Module._load;
const resetMenuPath = /\/src\/Commands\/System\/resetmenu\.js$/;
Module._load = function (request, parent, isMain) {
    if (resetMenuPath.test(parent?.filename || '')) {
        if (request === 'node:fs') return fakeFs;
        if (request === '../../Plugin/configManager') {
            return {
                delVar(key) {
                    deletedRuntimeKeys.push(key);
                    delete runtimeVars[key];
                }
            };
        }
    }
    return originalLoad.call(this, request, parent, isMain);
};

let resetMenu;
try {
    resetMenu = require('../src/Commands/System/resetmenu.js');
} finally {
    Module._load = originalLoad;
}

test('resetmenu clears all menu media overrides and preserves unrelated configuration', async t => {
    t.after(() => {
        for (const name of envNames) {
            delete process.env[name];
            if (originalEnv[name] !== undefined) process.env[name] = originalEnv[name];
            delete runtimeVars[name];
        }
    });

    deletedRuntimeKeys.length = 0;
    for (const name of envNames) {
        process.env[name] = `https://env.example/${name.toLowerCase()}`;
        runtimeVars[name] = `https://runtime.example/${name.toLowerCase()}`;
    }

    const replies = [];
    await resetMenu.execute({}, {}, {
        prefix: '/',
        reply: async text => replies.push(text)
    });

    assert.deepEqual(envNames.map(name => process.env[name]), envNames.map(() => undefined));
    assert.deepEqual(envNames.map(name => runtimeVars[name]), envNames.map(() => undefined));
    assert.deepEqual(deletedRuntimeKeys, envNames);
    assert.equal(envContents, '# keep this comment\r\nOTHER_SETTING=keep-me\r\n');

    const userConfig = JSON.parse(userConfigContents);
    assert.equal(Object.hasOwn(userConfig, 'thumbUrl'), false);
    assert.deepEqual(userConfig.owner, { number: '15550000000' });
    assert.equal(userConfig.unrelated, true);

    assert.equal(resetMenu.ownerOnly, true);
    assert.match(replies[0], /default live photo/i);
    assert.match(replies[0], /\/menu/);
});
