const assert = require('node:assert/strict');
const test = require('node:test');
const plogme = require('../src/Commands/Core/plogme.js');

test('PLOGME detects clear current-message languages', () => {
    assert.equal(plogme.detectMessageLanguage('Please remind me about our meeting tomorrow.'), 'en');
    assert.equal(plogme.detectMessageLanguage('Recordatorio sobre la reunión de mañana.'), 'es');
    assert.equal(plogme.detectMessageLanguage('Bonjour, merci pour votre aide.'), 'fr');
});

test('PLOGME defaults short ambiguous messages to English', () => {
    assert.equal(plogme.detectMessageLanguage('bro'), 'en');
    assert.equal(plogme.detectMessageLanguage('👍'), 'en');
});

test('chat prompt explicitly follows the current message instead of quoted context', () => {
    const prompt = plogme.buildPrompt('language-regression', 'bro', {
        chatType: 'private',
        quoted: { sender: 'someone', type: 'conversation', text: 'Recordatorio sobre la reunión de mañana.' }
    });
    assert.match(prompt, /LANGUAGE POLICY: Reply in English \(en\)/);
    assert.match(prompt, /Do not follow the language of quoted text/);
});

test('classifier prompt carries the same language policy', () => {
    const prompt = plogme.buildClassifierPrompt('bro', {
        chatType: 'private',
        quoted: { sender: 'someone', type: 'conversation', text: 'Recordatorio sobre la reunión de mañana.' }
    });
    assert.match(prompt, /LANGUAGE POLICY: Reply in English \(en\)/);
    assert.match(prompt, /Do not translate unless the user explicitly asks/);
});
