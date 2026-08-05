const axios = require('axios');
const FormData = require('form-data');

module.exports = {
    name: 'scan',
    alias: ['ocr', 'read'],
    category: 'Documents',
    desc: 'Extract text from image (OCR)',
    usage: `.scan (reply to image)`,
     // ⭐ Reaction config
    reactions: {
        start: '💬',
        success: '🔍'
    },
    

    execute: async (sock, m, { reply }) => {

        if (!m.quoted) return reply('𓉤 Reply to an image');

        const quoted = m.quoted;
        const mtype = quoted.mtype || quoted.type || '';

        if (!mtype.includes('image')) {
            return reply('⚉ Reply to an *image*');
        }

        try {

            await reply('_✦ Scanning image for text..._');

            const buffer = await quoted.download();
            if (!buffer) return reply('✘ Failed to download image');

            const form = new FormData();
            form.append('apikey', 'K82707468388957');
            form.append('language', 'eng');
            form.append('isOverlayRequired', 'false');
            form.append('file', buffer, { filename: 'scan.jpg' });

            const res = await axios.post(
                'https://api.ocr.space/parse/image',
                form,
                { headers: form.getHeaders(), timeout: 120000 }
            );

            const data = res.data;

            if (!data?.ParsedResults?.[0]?.ParsedText) {
                return reply('✘ No text detected in image');
            }

            const text = data.ParsedResults[0].ParsedText.trim();

            if (!text) return reply('✘ No readable text found');

            await sock.sendMessage(
                m.chat,
                {
                    text: `╭──────────────\n│ *OCR RESULT*\n╰──────────────\n${text}`
                },
                { quoted: m }
            );

        } catch (err) {
            console.log('[SCAN ERROR]', err.message);
            reply('✘ OCR scan failed');
        }
    }
};
