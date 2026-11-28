'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const social = require('../src/Commands/Core/plogme-social.js');

const chat = `plogme-social-${process.pid}@g.us`;

test.after(() => social.clear(chat));

test('social policy parses durations and keeps separate cooldowns', () => {
    social.clear(chat);
    assert.equal(social.parseDuration('5m'), 5 * 60 * 1000);
    assert.equal(social.parseDuration('2h'), 2 * 60 * 60 * 1000);
    social.setContributionCooldown(chat, '5m');
    social.setReactionCooldown(chat, '20s');
    const status = social.getStatus(chat);
    assert.equal(status.contributionCooldown, '5m');
    assert.equal(status.reactionCooldown, '20s');
});

test('contribution policy blocks rapid repeats and the same topic', () => {
    social.clear(chat);
    const now = 1_000_000;
    assert.equal(social.canContribute(chat, 'The deployment failed', now), true);
    social.markContribution(chat, 'The deployment failed', now);
    assert.equal(social.canContribute(chat, 'The deployment failed', now + 1), false);
    assert.equal(social.canContribute(chat, 'A completely different question', now + 1), false);
    assert.equal(social.canContribute(chat, 'A completely different question', now + 5 * 60 * 1000 + 1), true);
});

test('reaction and contribution controls are independent', () => {
    social.clear(chat);
    social.setReactionEnabled(chat, false);
    social.setContributionEnabled(chat, true);
    assert.equal(social.getStatus(chat).reactionEnabled, false);
    assert.equal(social.getStatus(chat).contributionEnabled, true);
    social.setReactionEnabled(chat, true);
    social.setContributionEnabled(chat, false);
    assert.equal(social.canReact(chat, 30_000), true);
    assert.equal(social.canContribute(chat, 'question', 30_000), false);
});
