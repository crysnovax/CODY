'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { decorateOutboundContent, isPrivateJid } = require('../src/Plugin/outboundMessageMetadata');

test('ordinary outbound DM content does not gain AI/business metadata by default', () => {
    const original = { text: 'hello' };
    const decorated = decorateOutboundContent(original, '15550001111@s.whatsapp.net');

    assert.deepEqual(decorated, { text: 'hello' });
    assert.notEqual(decorated, original);
    assert.deepEqual(original, { text: 'hello' });
});

test('optional AI badge applies only to private chats and secure label stays opt-in', () => {
    const direct = decorateOutboundContent({ text: 'hello' }, '15550001111@lid', {
        aiBadgeEnabled: true,
        secureMetaLabelEnabled: true
    });
    const group = decorateOutboundContent({ text: 'hello' }, '120363000000000000@g.us', {
        aiBadgeEnabled: true,
        secureMetaLabelEnabled: true
    });

    assert.deepEqual(direct, { text: 'hello', ai: true, secureMetaServiceLabel: true });
    assert.deepEqual(group, { text: 'hello', secureMetaServiceLabel: true });
});

test('explicit caller metadata is preserved and non-object payloads are untouched', () => {
    const explicit = { text: 'hello', ai: true, secureMetaServiceLabel: true };
    assert.deepEqual(decorateOutboundContent(explicit, '120363000000000000@g.us'), explicit);
    assert.equal(decorateOutboundContent(null, '15550001111@s.whatsapp.net'), null);
    assert.equal(decorateOutboundContent('text', '15550001111@s.whatsapp.net'), 'text');
});

test('private JID classification accepts PN/LID only', () => {
    assert.equal(isPrivateJid('15550001111@s.whatsapp.net'), true);
    assert.equal(isPrivateJid('12345@lid'), true);
    assert.equal(isPrivateJid('120363000000000000@g.us'), false);
    assert.equal(isPrivateJid('status@broadcast'), false);
});
