'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('Railway configuration builds and runs the bot as a worker', () => {
    const config = JSON.parse(fs.readFileSync('railway.json', 'utf8'));
    assert.equal(config.build.builder, 'RAILPACK');
    assert.equal(config.build.buildCommand, 'npm ci');
    assert.equal(config.deploy.startCommand, 'npm start');
    assert.equal(config.deploy.restartPolicyType, 'ON_FAILURE');
});

test('Render blueprint runs CODY as a worker with only the requested variables', () => {
    const config = fs.readFileSync('render.yaml', 'utf8');
    assert.match(config, /^\s+- type: worker$/m);
    assert.match(config, /^\s+env: node$/m);
    assert.match(config, /^\s+plan: starter$/m);
    assert.match(config, /^\s+buildCommand: npm ci$/m);
    assert.match(config, /^\s+startCommand: npm start$/m);

    const requestedVariables = [
        'SESSION_ID', 'OWNER_NUMBER', 'OWNER_NAME', 'BOT_NAME', 'PREFIX', 'MODE', 'TIMEZONE',
    ];
    const manifestVariables = Array.from(config.matchAll(/^\s+- key: ([A-Z_]+)$/gm), match => match[1]);
    assert.deepEqual(manifestVariables, requestedVariables);
    assert.match(config, /^\s+sync: false$/m);
});

test('README has the Render one-click deploy button', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    assert.match(readme, /Deploy to Render/);
    assert.match(readme, /https:\/\/render\.com\/deploy\?repo=https:\/\/github\.com\/crysnovax\/CODY/);
});
