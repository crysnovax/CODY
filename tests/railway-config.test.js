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

test('Render deployment configuration is absent', () => {
    assert.equal(fs.existsSync('render.yaml'), false);
});
