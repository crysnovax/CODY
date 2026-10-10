'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read, setModerationEnabled, isModerationEnabled } = require('../src/Plugin/moderationControl');
const antis = require('../src/Commands/Admin/antis');
const clearwarn = require('../src/Commands/Admin/clearwarn');
const plogme = require('../src/Commands/Core/plogme');
const { addCommand, clearRegistry, getCommand } = require('../src/Plugin/crysCmd');

test('moderation master switch defaults on and can be toggled per group', () => {
  const group = `management-test-${Date.now()}@g.us`;
  const before = read()[group];
  try {
    assert.equal(isModerationEnabled(group), true);
    setModerationEnabled(group, false);
    assert.equal(isModerationEnabled(group), false);
    setModerationEnabled(group, true);
    assert.equal(isModerationEnabled(group), true);
  } finally {
    const data = read();
    if (before === undefined) delete data[group];
    else data[group] = before;
    require('../src/Plugin/moderationControl').write(data);
  }
});

test('antis and clearwarn expose distinct admin commands', () => {
  clearRegistry();
  addCommand(antis);
  addCommand(clearwarn);
  assert.equal(getCommand('antis'), antis);
  assert.equal(getCommand('antisystem'), antis);
  assert.equal(getCommand('clearwarn'), clearwarn);
  assert.equal(getCommand('clearallwarns'), clearwarn);
});

test('plogme cannot intercept or disable moderation-control commands', () => {
  for (const name of ['antis', 'antisystem', 'antimoderation', 'moderation', 'clearwarn']) {
    assert.equal(plogme.isCommandToggled(name), false, name);
    assert.equal(plogme.toggleCommand(name, true), false, name);
  }
  assert.equal(plogme.getToggledList().some(name => name === 'antis' || name === 'antisystem'), false);
});
