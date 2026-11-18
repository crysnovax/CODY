'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const npmCommand = require('../src/Commands/Bot/_');
const npmInfo = require('../src/Commands/Search/npminfo');

test('npm update runs in place without removing node_modules', () => {
    assert.deepEqual(npmCommand._test.buildNpmArgs('update'), [
        'update', '--prefer-online', '--no-audit', '--no-fund',
    ]);
    assert.deepEqual(npmCommand._test.buildNpmArgs('update', ['axios']), [
        'update', 'axios', '--prefer-online', '--no-audit', '--no-fund',
    ]);
    const project = npmCommand._test.resolveNpmProject(process.cwd());
    assert.equal(project.root, process.cwd());
    assert.equal(project.hasNodeModules, true);
});

test('npm resolver selects the existing CODY dependency location in both layouts', () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'cody-npm-'));
    const direct = path.join(fixture, 'direct');
    const site = path.join(fixture, 'site');
    const bot = path.join(site, 'bot');
    for (const dir of [direct, site, bot]) fs.mkdirSync(dir, { recursive: true });
    for (const dir of [direct, site, bot]) fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'CODY-AI' }));
    fs.mkdirSync(path.join(direct, 'node_modules'));
    fs.mkdirSync(path.join(bot, 'node_modules'));
    assert.equal(npmCommand._test.resolveNpmProject(direct).root, direct);
    assert.equal(npmCommand._test.resolveNpmProject(site).root, bot);
    fs.rmSync(fixture, { recursive: true, force: true });
});

test('npm output is bounded for chat replies', () => {
    assert.equal(npmCommand._test.trimOutput(''), 'Success (no output)');
    assert.match(npmCommand._test.trimOutput('x'.repeat(4000)), /output truncated/);
});

test('npm result uses one RichAI response with command and output code blocks', () => {
    const content = npmCommand._test.buildNpmResponseContent({
        action: 'install',
        projectRoot: '/workspace/CODY',
        args: ['install', 'axios', '--no-audit', '--no-fund'],
        output: 'added 1 package',
        success: true,
    });
    assert.deepEqual(content.sections.map(section => section.type), ['plain', 'codeBlock', 'codeBlock']);
    assert.match(content.sections[0].text, /npm install completed in CODY/);
    assert.match(content.sections[1].code, /install axios/);
    assert.equal(content.sections[2].code, 'added 1 package');
});

test('npminfo includes the full description, registry manifest fields, and install options', () => {
    const description = 'A complete package description without truncation. '.repeat(5);
    const data = {
        _id: 'axios',
        name: 'axios',
        description,
        'dist-tags': { latest: '1.0.0', next: '2.0.0-beta.1' },
        time: { created: '2020-01-01T00:00:00.000Z', modified: '2025-01-01T00:00:00.000Z', '1.0.0': '2025-01-01T00:00:00.000Z' },
        maintainers: [{ name: 'maintainer' }],
        versions: {
            '1.0.0': {
                name: 'axios',
                version: '1.0.0',
                description,
                dependencies: { 'follow-redirects': '^1.0.0' },
                engines: { node: '>=18' },
                dist: { tarball: 'https://registry.npmjs.org/axios/-/axios-1.0.0.tgz', integrity: 'sha512-example' },
            },
        },
    };
    const content = npmInfo._test.buildPackageInfoContent('axios', data, '1.0.0', '12,345');
    assert.deepEqual(content.sections.map(section => section.type), ['list', 'table', 'codeBlock']);
    assert.equal(content.sections[0].items[0], description);
    const rows = content.sections[1].rows;
    assert.ok(rows.some(([field, value]) => field === 'Dependencies' && value.includes('follow-redirects')));
    assert.ok(rows.some(([field, value]) => field === 'Registry Dist Tags' && value.includes('next')));
    assert.match(content.sections[2].code, /npm install axios@1\.0\.0/);
    assert.match(content.sections[2].code, /yarn add axios@1\.0\.0/);
    assert.match(content.sections[2].code, /pnpm add axios@1\.0\.0/);
});

test('npminfo sends ordered description, metadata table, and installation code through RichAI', async () => {
    const calls = [];
    const sock = {
        async sendRichAIResponse(...args) { calls.push(args); },
        async sendList() { throw new Error('sendList fallback should not run'); },
    };
    const message = { chat: 'user@s.whatsapp.net', key: { id: '1' } };
    const content = npmInfo._test.buildPackageInfoContent('axios', {
        name: 'axios',
        description: 'HTTP client',
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': { name: 'axios', version: '1.0.0', description: 'HTTP client' } },
    }, '1.0.0');
    await npmInfo._test.sendPackageInfo(sock, message, 'axios', content);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], message.chat);
    assert.deepEqual(calls[0][1].sections.map(section => section.type), ['list', 'table', 'codeBlock']);
    assert.equal(calls[0][2], message);
});

test('npminfo retains a sendList fallback when RichAI sending is unavailable', async () => {
    const calls = [];
    const sock = {
        async sendList(...args) { calls.push(args); },
    };
    const message = { chat: 'user@s.whatsapp.net', key: { id: '1' } };
    const content = npmInfo._test.buildPackageInfoContent('axios', {
        name: 'axios',
        description: 'HTTP client',
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': { name: 'axios', version: '1.0.0' } },
    }, '1.0.0');
    await npmInfo._test.sendPackageInfo(sock, message, 'axios', content);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], message.chat);
    assert.ok(calls[0][2].some(item => item.includes('npm install axios@1.0.0')));
});
