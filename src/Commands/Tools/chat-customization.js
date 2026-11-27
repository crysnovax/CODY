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
    dark: { colorLight: '#FF162E24', colorDark: '#FF04120D', doodleColorLight: '#FF24493A', doodleColorDark: '#FF234E3A', isDoodleEnabled: true },
    blue: { colorLight: '#FFE3F2FD', colorDark: '#FF0D47A1', doodleColorLight: '#FFBBDEFB', doodleColorDark: 0xFF1565C0, isDoodleEnabled: true },
    emerald: { colorLight: '#FFE8F5E9', colorDark: '#FF0B3D2E', doodleColorLight: '#FFC8E6C9', doodleColorDark: 0xFF1B5E20, isDoodleEnabled: true },
    pink: { colorLight: '#FFFCE4EC', colorDark: '#FF4A102A', doodleColorLight: '#FFF8BBD0', doodleColorDark: 0xFF880E4F, isDoodleEnabled: true },
    purple: { colorLight: '#FFF3E5F5', colorDark: '#FF311B42', doodleColorLight: '#FFE1BEE7', doodleColorDark: 0xFF4A148C, isDoodleEnabled: true },
    red: { colorLight: '#FFFFEBEE', colorDark: '#FF4A1010', doodleColorLight: '#FFFFCDD2', doodleColorDark: 0xFFB71C1C, isDoodleEnabled: true },
    orange: { colorLight: '#FFFFF3E0', colorDark: '#FFE65100', doodleColorLight: '#FFFFCC80', doodleColorDark: 0xFFEF6C00, isDoodleEnabled: true },
    yellow: { colorLight: '#FFFFFDE7', colorDark: '#FFF57F17', doodleColorLight: '#FFFFF59D', doodleColorDark: 0xFFF9A825, isDoodleEnabled: true },
    lime: { colorLight: '#FFF1F8E9', colorDark: '#FF33691E', doodleColorLight: '#FFDCEDC8', doodleColorDark: 0xFF558B2F, isDoodleEnabled: true },
    teal: { colorLight: '#FFE0F2F1', colorDark: '#FF004D40', doodleColorLight: '#FFB2DFDB', doodleColorDark: 0xFF00695C, isDoodleEnabled: true },
    cyan: { colorLight: '#FFE0F7FA', colorDark: '#FF006064', doodleColorLight: '#FFB2EBF2', doodleColorDark: 0xFF00838F, isDoodleEnabled: true },
    indigo: { colorLight: '#FFE8EAF6', colorDark: '#FF1A237E', doodleColorLight: '#FFC5CAE9', doodleColorDark: 0xFF303F9F, isDoodleEnabled: true },
    brown: { colorLight: '#FFEFEBE9', colorDark: '#FF3E2723', doodleColorLight: '#FFD7CCC8', doodleColorDark: 0xFF5D4037, isDoodleEnabled: true },
    gray: { colorLight: '#FFF5F5F5', colorDark: '#FF212121', doodleColorLight: '#FFEEEEEE', doodleColorDark: 0xFF424242, isDoodleEnabled: true },
    black: { colorLight: '#FF303030', colorDark: '#FF000000', doodleColorLight: '#FF616161', doodleColorDark: 0xFF101010, isDoodleEnabled: true },
    white: { colorLight: '#FFFFFFFF', colorDark: '#FF424242', doodleColorLight: '#FFFFFFFF', doodleColorDark: 0xFF616161, isDoodleEnabled: true }
});

const DEEP_DARK_SOLID_COLOR = Object.freeze({
    colorLight: '#FF162E24',
    colorDark: '#FF04120D',
    doodleColorLight: '#FF24493A',
    doodleColorDark: '#FF234E3A',
    isDoodleEnabled: true
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
    const presetToken = tokens.find(token => !token.includes('=') && !/^--(?:dark|light)$/i.test(token));
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
    const mode = tokens.find(token => /^--(?:dark|light)$/i.test(token));
    if (mode && mode.toLowerCase() === '--dark') {
        Object.assign(result, DEEP_DARK_SOLID_COLOR);
    } else if (mode && mode.toLowerCase() === '--light') {
        result.colorDark = result.colorLight;
        result.doodleColorDark = result.doodleColorLight;
    }
    return result;
}

function isTargetToken(value) {
    const token = String(value || '').trim();
    return /^https?:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+/i.test(token)
        || /^\d{5,24}@(g\.us|s\.whatsapp\.net|lid)$/i.test(token)
        || /^\d{5,24}$/.test(token);
}

async function resolveChatTarget(sock, m, args = []) {
    const index = args.findIndex(isTargetToken);
    if (index < 0) return { target: m.chat, args: [...args] };
    const raw = String(args[index]).trim();
    let target = raw;
    const link = raw.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/i);
    if (link) {
        if (typeof sock.groupGetInviteInfo !== 'function') throw new Error('This WhatsApp connection cannot resolve group links.');
        const info = await sock.groupGetInviteInfo(link[1]);
        target = info?.id || info?.gid || info?.jid;
    } else if (/^\d{5,24}$/.test(raw)) {
        target = `${raw}@s.whatsapp.net`;
    }
    if (!target || !/@/.test(target)) throw new Error('Invalid target JID, LID, or group link.');
    return { target, args: args.filter((_, i) => i !== index) };
}

function listThemes() {
    return [...new Set(Object.values(THEME_IDS))];
}

function listBubblePresets() {
    return Object.keys(BUBBLE_PRESETS);
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
    isTargetToken,
    listBubblePresets,
    listThemes,
    normalizeChoice,
    parseBubbleCustomization,
    resolveBubble,
    resolveTheme,
    resolveChatTarget,
    themePayload,
    uploadImage
};
