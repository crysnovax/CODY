'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../../database/sreact.json');
const PROTOCOL_FILE = path.join(__dirname, '../../../database/sreact-message.json');

const config = { enabled: false };

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
    } catch (error) {
        console.error('[SREACT] Config load error:', error.message);
    }
    return config;
}

function saveConfig() {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function bufferReplacer(_key, value) {
    if (Buffer.isBuffer(value)) return { type: 'Buffer', data: [...value] };
    if (value instanceof Uint8Array) return { type: 'Buffer', data: [...value] };
    return value;
}

function bufferReviver(_key, value) {
    if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
    return value;
}

function getPayload(target) {
    if (!target) return null;
    const candidates = [
        ['stickerMessage', target.stickerMessage],
        ['lottieStickerMessage', target.lottieStickerMessage],
        ['stickerMessage', target.message?.stickerMessage],
        ['lottieStickerMessage', target.message?.lottieStickerMessage],
        ['stickerMessage', target.msg?.stickerMessage],
        ['lottieStickerMessage', target.msg?.lottieStickerMessage]
    ];
    for (const [type, value] of candidates) {
        if (value) return { type, value };
    }
    if (target.mtype === 'stickerMessage' && target.msg) return { type: 'stickerMessage', value: target.msg };
    if (target.mtype === 'lottieStickerMessage' && target.msg) return { type: 'lottieStickerMessage', value: target.msg };
    return null;
}

function savePayload(payload) {
    fs.mkdirSync(path.dirname(PROTOCOL_FILE), { recursive: true });
    fs.writeFileSync(PROTOCOL_FILE, JSON.stringify(payload, bufferReplacer, 2));
}

function readPayload() {
    if (!fs.existsSync(PROTOCOL_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(PROTOCOL_FILE, 'utf8'), bufferReviver);
    } catch (error) {
        console.error('[SREACT] Sticker load error:', error.message);
        return null;
    }
}

async function sendStickerReaction(sock, jid, parentMessageKey) {
    const payload = readPayload();
    if (!payload || typeof sock.relayMessage !== 'function') return false;
    await sock.relayMessage(jid, {
        messageContextInfo: {
            messageAssociation: {
                associationType: 11,
                parentMessageKey
            }
        },
        [payload.type]: payload.value
    }, {});
    return true;
}

loadConfig();

module.exports = {
    name: 'sreact',
    alias: ['stickerreact'],
    category: 'Owner',
    privilegedOnly: true,
    desc: 'React to messages with a saved sticker or Lottie sticker',
    usage: '.sreact add (reply to a sticker) | .sreact on | .sreact off | .sreact status',
    execute: async (sock, m, { args, reply }) => {
        const option = String(args[0] || '').toLowerCase();
        const target = m.quoted || m;
        if (option === 'add' || option === 'set' || option === 'replace') {
            const payload = getPayload(target);
            if (!payload) return reply('✘ Reply to a sticker or Lottie sticker with .sreact add.');
            savePayload(payload);
            config.enabled = true;
            saveConfig();
            return reply(`✓ Sticker reaction saved (${payload.type === 'lottieStickerMessage' ? 'Lottie' : 'sticker'}) and enabled.`);
        }
        if (option === 'on') {
            if (!readPayload()) return reply('✘ Save a sticker first with .sreact add.');
            config.enabled = true;
            saveConfig();
            return reply('✓ Sticker reactions enabled.');
        }
        if (option === 'off') {
            config.enabled = false;
            saveConfig();
            return reply('✓ Sticker reactions disabled.');
        }
        if (option === 'status') {
            const payload = readPayload();
            return reply(`SREACT: ${config.enabled ? 'ON' : 'OFF'}\nSticker: ${payload ? (payload.type === 'lottieStickerMessage' ? 'Lottie' : 'saved') : 'not configured'}`);
        }
        return reply('Usage:\n.sreact add — reply to a sticker or Lottie sticker\n.sreact on\n.sreact off\n.sreact status');
    },
    isEnabled: () => Boolean(loadConfig().enabled),
    hasSticker: () => Boolean(readPayload()),
    sendStickerReaction
};
