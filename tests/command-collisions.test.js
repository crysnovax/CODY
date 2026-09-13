const test = require('node:test');
const assert = require('node:assert/strict');

const { addCommand, getCommand, clearRegistry } = require('../src/Plugin/crysCmd');

// Regression: addCommand() is first-come-first-served. A colliding command
// name used to be dropped entirely (unreachable forever) and a colliding alias
// was silently ignored, so two commands in the repo could cancel each other
// out. They must now both stay reachable via a numeric fallback ("story2").
test('colliding command names fall back to a suffixed name instead of being dropped', () => {
    clearRegistry();
    const first = { name: 'story', alias: ['tale'], execute() {} };
    const second = { name: 'story', alias: ['tale'], execute() {} };

    assert.equal(addCommand(first), true);
    assert.equal(addCommand(second), true);

    assert.equal(getCommand('story'), first);
    assert.equal(getCommand('story2'), second);
    assert.equal(getCommand('tale'), first);
    assert.equal(getCommand('tale2'), second);
});

test('a third colliding name keeps walking the suffix chain', () => {
    clearRegistry();
    const commands = [1, 2, 3].map(i => ({ name: 'shop', execute() {} }));

    commands.forEach(cmd => assert.equal(addCommand(cmd), true));

    assert.equal(getCommand('shop'), commands[0]);
    assert.equal(getCommand('shop2'), commands[1]);
    assert.equal(getCommand('shop3'), commands[2]);
});

test('non-colliding names and aliases are registered verbatim', () => {
    clearRegistry();
    const cmd = { name: 'unique', alias: ['uniquealias'], execute() {} };
    assert.equal(addCommand(cmd), true);
    assert.equal(getCommand('unique'), cmd);
    assert.equal(getCommand('uniquealias'), cmd);
    assert.equal(getCommand('unique2'), undefined);
});
