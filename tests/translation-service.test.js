'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const axios = require('axios');
const { extractGoogle, extractMyMemory, normalizeLanguage, translate } = require('../src/Plugin/translationService');

test('normalizes language tags to provider-compatible codes', () => {
    assert.equal(normalizeLanguage('fr-FR'), 'fr');
    assert.equal(normalizeLanguage('yo-NG'), 'yo');
    assert.equal(normalizeLanguage('not a language'), null);
});

test('extracts Google translation segments safely', () => {
    assert.equal(extractGoogle([[['bonjour'], [' le monde']], 'x', 'fr']), 'bonjour le monde');
    assert.equal(extractGoogle('<html>blocked</html>'), null);
});

test('accepts MyMemory numeric and string success statuses', () => {
    assert.equal(extractMyMemory({ responseStatus: 200, responseData: { translatedText: 'bonjour' } }), 'bonjour');
    assert.equal(extractMyMemory({ responseStatus: '200', responseData: { translatedText: 'bonjour' } }), 'bonjour');
    assert.equal(extractMyMemory({ responseStatus: '403', responseData: { translatedText: 'error' } }), null);
});

test('falls back to MyMemory autodetect when Google is unavailable', async () => {
    const originalGet = axios.get;
    const calls = [];
    axios.get = async (url, options) => {
        calls.push({ url, options });
        if (url.includes('googleapis')) throw new Error('blocked');
        return {
            data: {
                responseStatus: '200',
                responseData: { translatedText: 'hello', detectedLanguage: 'fr' }
            }
        };
    };
    try {
        const result = await translate('bonjour', 'en');
        assert.deepEqual(result, { translated: 'hello', from: 'fr' });
        assert.equal(calls[1].options.params.langpair, 'autodetect|en');
    } finally {
        axios.get = originalGet;
    }
});
