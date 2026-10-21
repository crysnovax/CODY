'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..');

test('CODY loads its .env before redirect and bot modules initialize', () => {
    const source = fs.readFileSync(path.join(repo, 'index.js'), 'utf8');
    const dotenvLoad = source.indexOf("require('dotenv').config({ path: path.join(__dirname, '.env'), override: false });");
    const redirectLoad = source.indexOf("require('./redirect.js')");
    assert.notEqual(dotenvLoad, -1, 'entrypoint must load .env explicitly');
    assert.ok(redirectLoad > dotenvLoad, 'dotenv must load before modules that read configuration');
});

test('menu uses MENU_URL from the environment for its default live media', () => {
    const source = fs.readFileSync(path.join(repo, 'src/Commands/Bot/ⓘ.js'), 'utf8');
    assert.match(source, /getVar\('MENU_URL'\) \|\| process\.env\.MENU_URL/);
    assert.match(source, /video: liveVideoUrl/);
    assert.match(source, /thumbnail: liveThumbnailUrl/);
});

test('production start preserves child ANSI colors through cdloger', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
    assert.match(packageJson.scripts.start, /^FORCE_COLOR=\$\{FORCE_COLOR:-1\} cdlog run/);
});

test('BOT_NAME and OWNER_NAME from .env reach canonical and legacy config fields', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-config-env-'));
    const envFile = path.join(temp, '.env');
    fs.writeFileSync(envFile, 'BOT_NAME="Blue Bird CODY"\nOWNER_NAME="Nora O\'Neil"\n');
    const script = [
        "require('dotenv').config({ path: process.env.TEST_ENV_FILE, override: false, quiet: true });",
        `const config = require(${JSON.stringify(path.join(repo, 'settings/config.js'))});`,
        "process.stdout.write('CONFIG_RESULT=' + JSON.stringify({ title: config.settings.title, owner: config.settings.ownerName, botAlias: config.botname, ownerAlias: config.ownerName }));"
    ].join('\n');
    const env = { ...process.env, TEST_ENV_FILE: envFile };
    delete env.BOT_NAME;
    delete env.OWNER_NAME;
    try {
        const result = spawnSync(process.execPath, ['-e', script], { cwd: repo, env, encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr || 'config subprocess failed');
        const marker = 'CONFIG_RESULT=';
        const markerAt = result.stdout.lastIndexOf(marker);
        assert.notEqual(markerAt, -1, result.stdout);
        assert.deepEqual(JSON.parse(result.stdout.slice(markerAt + marker.length)), {
            title: 'Blue Bird CODY',
            owner: "Nora O'Neil",
            botAlias: 'Blue Bird CODY',
            ownerAlias: "Nora O'Neil"
        });
    } finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
