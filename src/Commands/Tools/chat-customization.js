'use strict';

const THEME_IDS = Object.freeze({
    default: 'Default-Blue@Minimal',
    blue: 'Default-Blue@Minimal',
    'default-blue': 'Default-Blue@Minimal',
    'default-blue-minimal': 'Default-Blue@Minimal',
    'default-blue-tonal': 'Default-Blue@Tonal@Minimal',
    'blue-tonal': 'Default-Blue@Tonal@Minimal',
    emerald: 'Emerald@Minimal',
    'emerald-tonal': 'Emerald@Tonal@Minimal',
    pink: 'Pink@Minimal',
    red: 'Red@Minimal',
    'royal-blue': 'Royal-Blue@Minimal',
    royalblue: 'Royal-Blue@Minimal',
    purple: 'Tyrian-Purple@Minimal',
    'tyrian-purple': 'Tyrian-Purple@Minimal',
    green: 'WhatsApp-Green@Minimal',
    whatsapp: 'WhatsApp-Green@Minimal',
    'whatsapp-green': 'WhatsApp-Green@Minimal'
});

const BUBBLE_PRESETS = Object.freeze({
    default: { colorLight: '#FFFFFFFF', colorDark: '#FF101010', doodleColorLight: '#FFCCE8FF', doodleColorDark: 0xFF202020, isDoodleEnabled: true },
    light: { colorLight: '#FFFFFFFF', colorDark: '#FF101010', doodleColorLight: '#FFCCE8FF', doodleColorDark: 0xFF202020, isDoodleEnabled: true },
    dark: { colorLight: '#FF202124', colorDark: '#FF000000', doodleColorLight: '#FF3A4652', doodleColorDark: 0xFF111111, isDoodleEnabled: true },
    blue: { colorLight: '#FFE3F2FD', colorDark: '#FF0D47A1', doodleColorLight: '#FFBBDEFB', doodleColorDark: 0xFF1565C0, isDoodleEnabled: true },
    emerald: { colorLight: '#FFE8F5E9', colorDark: '#FF0B3D2E', doodleColorLight: '#FFC8E6C9', doodleColorDark: 0xFF1B5E20, isDoodleEnabled: true },
    pink: { colorLight: '#FFFCE4EC', colorDark: '#FF4A102A', doodleColorLight: '#FFF8BBD0', doodleColorDark: 0xFF880E4F, isDoodleEnabled: true },
    purple: { colorLight: '#FFF3E5F5', colorDark: '#FF311B42', doodleColorLight: '#FFE1BEE7', doodleColorDark: 0xFF4A148C, isDoodleEnabled: true },
    red: { colorLight: '#FFFFEBEE', colorDark: '#FF4A1010', doodleColorLight: '#FFFFCDD2', doodleColorDark: 0xFFB71C1C, isDoodleEnabled: true }
});

function normalizeChoice(value) {
    return String(value || '').trim().toLowerCase().replace(/^['"]|['"]$/g, '').replace(/[\s_]+/g, '-');
}

function resolveTheme(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const normalized = normalizeChoice(raw);
    return THEME_IDS[normalized] || (raw.includes('@') ? raw : null);
}

function resolveBubble(value) {
    const normalized = normalizeChoice(value || 'default');
    return BUBBLE_PRESETS[normalized] ? { ...BUBBLE_PRESETS[normalized] } : null;
}

function parseBubbleCustomization(args = []) {
    const tokens = args.map(String);
    const presetToken = tokens.find(token => !token.includes('='));
    const result = resolveBubble(presetToken || 'default');
    if (!result) return null;
    const keys = {
        light: 'colorLight', dark: 'colorDark',
        doodlelight: 'doodleColorLight', doodledark: 'doodleColorDark',
        colorlight: 'colorLight', colordark: 'colorDark'
    };
    for (const token of tokens.filter(item => item.includes('='))) {
        const [rawKey, ...rawValue] = token.split('=');
        const key = normalizeChoice(rawKey).replace(/-/g, '');
        const value = rawValue.join('=').trim();
        if (key === 'doodles' || key === 'doodle') {
            result.isDoodleEnabled = !['off', 'false', '0', 'no'].includes(value.toLowerCase());
        } else if (keys[key]) {
            result[keys[key]] = /^0x[0-9a-f]+$/i.test(value) ? Number(value) : value;
        }
    }
    return result;
}

function isImageMessage(message) {
    return Boolean(message?.imageMessage || message?.mtype === 'imageMessage' || message?.type === 'image');
}

async function uploadImage(buffer, filename = 'chat-wallpaper.jpg') {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('The replied image could not be downloaded.');
    const axios = require('axios');
    const FormData = require('form-data');
    const config = (() => { try { return require('../../../settings/config'); } catch { return {}; } })();
    const base = String(process.env.CDN_URL || config.api?.cdn || 'https://cdn.crysnova.qzz.io').replace(/\/$/, '');
    const form = new FormData();
    form.append('file', buffer, { filename, contentType: 'image/jpeg' });
    const response = await axios.post(`${base}/upload`, form, { headers: form.getHeaders(), timeout: 45000 });
    const url = response.data?.url || response.data?.link || response.data?.file;
    if (!url) throw new Error('The image upload service returned no URL.');
    return String(url);
}

async function getWallpaperUrl(m, args = [], uploader = uploadImage) {
    const explicit = args.find(value => /^https?:\/\//i.test(String(value || '').trim()));
    if (explicit) return explicit.trim();
    const quoted = m?.quoted;
    if (!quoted || !isImageMessage(quoted)) return null;
    if (typeof quoted.download !== 'function') throw new Error('Reply to an image with a downloadable WhatsApp image.');
    const buffer = await quoted.download();
    return uploader(buffer);
}

function themePayload(colorSchemeId) {
    return { chatTheme: { colorSchemeId } };
}

function bubblePayload(solidColor) {
    return { chatTheme: { solidColor } };
}

module.exports = {
    BUBBLE_PRESETS,
    THEME_IDS,
    bubblePayload,
    getWallpaperUrl,
    normalizeChoice,
    parseBubbleCustomization,
    resolveBubble,
    resolveTheme,
    themePayload,
    uploadImage
};
