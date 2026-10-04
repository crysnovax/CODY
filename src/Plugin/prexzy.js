const axios = require('axios');

const BASE_URL = 'https://prexzyapis.com';

async function request(path, params = {}, options = {}) {
    const response = await axios.get(`${BASE_URL}${path}`, {
        params,
        timeout: options.timeout || 60000,
        responseType: options.responseType || 'json',
        validateStatus: () => true,
        headers: { Accept: options.responseType === 'arraybuffer' ? 'image/*, application/json' : 'application/json' }
    });
    return response;
}

function pickText(value) {
    if (typeof value === 'string') return value.trim();
    if (!value || typeof value !== 'object') return '';
    for (const key of ['response', 'result', 'reply', 'text', 'output', 'content', 'answer', 'message']) {
        if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
    }
    if (value.data) return pickText(value.data);
    return '';
}

function errorText(response) {
    return pickText(response?.data) || `HTTP ${response?.status || 'unknown'}`;
}

function encodeParams(params) {
    return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}

async function downloadImage(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 90000, validateStatus: () => true });
    if (response.status < 200 || response.status >= 300) throw new Error(`Image download failed (${response.status})`);
    return Buffer.from(response.data);
}

module.exports = { BASE_URL, request, pickText, errorText, encodeParams, downloadImage };

async function uploadImage(buffer) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });
    const response = await axios.post('https://cdn.crysnovax.link/upload', form, { headers: form.getHeaders(), timeout: 45000, validateStatus: () => true });
    return response.data?.url || response.data?.link || response.data?.file || response.data?.data?.url || null;
}
module.exports.uploadImage = uploadImage;
