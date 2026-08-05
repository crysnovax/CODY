// dec.js - Voice Note to Text (Using Apex Gateway)
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@crysnovax/baileys');
const config = require('../../../settings/config');

// Use Apex gateway from config with token
const GATEWAY_URL = process.env.GATEWAY_URL || config.api?.gateway || 'https://api.crysnovax.link';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || config.api?.gatewayToken || '';

module.exports = {
    name: 'dec',
    alias: ['decode', 'transcribe', 'vtt'],
    desc: 'Convert voice note to text using CRYSNOVA Gateway',
    category: 'Utils',
    reactions: { start: '🎙️', success: '📑' },

    execute: async (sock, m, { reply , prefix}) => {
        try {
            const isVoiceNote = 
                m.message?.audioMessage?.ptt === true ||
                m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage?.ptt === true;

            if (!isVoiceNote) {
                return reply('✘ Reply to a voice note with `${prefix}dec`');
            }

            await sock.sendMessage(m.chat, { react: { text: '🎙️', key: m.key } });

            let audioMsg = m.message?.audioMessage;
            if (!audioMsg && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
                audioMsg = m.message.extendedTextMessage.contextInfo.quotedMessage.audioMessage;
            }

            if (!audioMsg) return reply('✘ Could not detect voice note.');

            const buffer = await downloadMediaMessage(
                { message: { audioMessage: audioMsg } },
                'buffer',
                {},
                { logger: console }
            );

            // Send to Apex gateway /transcribe endpoint with token
            const form = new FormData();
            form.append('file', buffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });

            const response = await axios.post(
                `${GATEWAY_URL}/transcribe?token=${encodeURIComponent(GATEWAY_TOKEN)}`,
                form,
                {
                    headers: form.getHeaders(),
                    timeout: 60000
                }
            );

            const transcription = response.data?.text;
            if (!transcription?.trim()) {
                return reply('𓄄 Could not understand the audio clearly.');
            }

            await reply(`${prefix}🎙️ *Voice Transcription:*\n\n${transcriptiontrim()}\n\n_⚉ CRYSNOVA Gateway_`);

        } catch (err) {
            console.error('[DEC ERROR]', err.message);
            await reply('𓉤 Transcription failed. Please try again.');
        }
    }
};
