'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { BOT_OUTGOING_MARKER, hasBotOutgoingMarker } = require('../src/Plugin/antiText');
const { getTagDetectionText } = require('../src/Commands/Admin/antitag');

test('AntiTag inspects interactive body text even when it carries the outgoing marker', () => {
    const messageText = `@everyone${BOT_OUTGOING_MARKER}\u200b`;
    const interactive = {
        body: { text: messageText },
        footer: { text: 'Group information' },
        nativeFlowMessage: { buttons: [] },
    };
    const message = {
        mtype: 'interactiveMessage',
        text: '',
        body: '',
        message: { interactiveMessage: interactive },
        msg: interactive,
    };

    const analyzedText = getTagDetectionText(message);
    const invisibleCount = (analyzedText.match(/[\u200e\u200f\u200b\u2060\u061c\ufeff]/g) || []).length;
    assert.ok(analyzedText.includes('@everyone'));
    assert.ok(analyzedText.includes(BOT_OUTGOING_MARKER), 'the marker must not bypass AntiTag inspection');
    assert.equal(invisibleCount, 2, 'the constant marker and additional invisible tag character remain observable');
    assert.equal(interactive.body.text, messageText, 'the source message must remain unchanged');
});

test('AntiTag accepts the serializer’s direct InteractiveMessage object shape', () => {
    const directInteractive = {
        body: { text: `hidden${BOT_OUTGOING_MARKER}\u200b` },
        footer: { text: 'footer' },
        nativeFlowMessage: { buttons: [] },
    };
    const analyzedText = getTagDetectionText({ mtype: 'interactiveMessage', msg: directInteractive });
    assert.ok(analyzedText.includes('hidden'));
    assert.ok(analyzedText.includes(BOT_OUTGOING_MARKER));
});

test('marked own-message detection ignores marker text that exists only in a quoted message', () => {
    const marked = {
        message: { interactiveMessage: { body: { text: `link https://example.org${BOT_OUTGOING_MARKER}` } } },
    };
    assert.equal(hasBotOutgoingMarker(marked), true);
    assert.equal(hasBotOutgoingMarker({
        fakeObj: { message: { interactiveMessage: { body: { text: `own text${BOT_OUTGOING_MARKER}` } } } },
    }), true, 'the serializer raw envelope can carry the marker');
    assert.equal(hasBotOutgoingMarker({
        message: { extendedTextMessage: { text: 'reply', contextInfo: {
            quotedMessage: { conversation: BOT_OUTGOING_MARKER },
        } } },
    }), false);
});
