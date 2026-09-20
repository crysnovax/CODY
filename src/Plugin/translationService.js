'use strict';

const axios = require('axios');

function normalizeLanguage(value) {
    const language = String(value || '').trim().toLowerCase();
    if (!/^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(language)) return null;
    return language.split('-')[0];
}

function extractGoogle(data) {
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    const translated = data[0].map(part => part?.[0] || '').join('').trim();
    return translated || null;
}

function extractMyMemory(data) {
    const translated = data?.responseData?.translatedText?.trim();
    if (String(data?.responseStatus) !== '200' || !translated) return null;
    return translated;
}

async function translate(text, targetLanguage) {
    const source = String(text || '').trim();
    const target = normalizeLanguage(targetLanguage);
    if (!source) throw new Error('No text to translate');
    if (!target) throw new Error('Invalid target language');

    const failures = [];
    const googleUrl = process.env.TRANSLATION_GOOGLE_URL || 'https://translate.googleapis.com/translate_a/single';
    try {
        const response = await axios.get(googleUrl, {
            params: { client: 'gtx', sl: 'auto', tl: target, dt: 't', q: source },
            timeout: 12_000,
            validateStatus: status => status >= 200 && status < 300
        });
        const translated = extractGoogle(response.data);
        if (translated) return { translated, from: response.data?.[2] || 'auto' };
        failures.push('Google returned no translation');
    } catch (error) {
        failures.push(`Google: ${error.message}`);
    }

    const memoryUrl = process.env.TRANSLATION_MEMORY_URL || 'https://api.mymemory.translated.net/get';
    try {
        const response = await axios.get(memoryUrl, {
            params: { q: source, langpair: `autodetect|${target}` },
            timeout: 12_000,
            validateStatus: status => status >= 200 && status < 300
        });
        const translated = extractMyMemory(response.data);
        if (translated) {
            return { translated, from: response.data?.responseData?.detectedLanguage || 'auto' };
        }
        failures.push('MyMemory returned no translation');
    } catch (error) {
        failures.push(`MyMemory: ${error.message}`);
    }

    const detail = process.env.DEBUG_TRANSLATION === 'true' ? ` (${failures.join('; ')})` : '';
    throw new Error(`Translation service unavailable${detail}`);
}

module.exports = { normalizeLanguage, extractGoogle, extractMyMemory, translate };
