const axios = require('axios');
const FormData = require('form-data');
const config = require('../../../settings/config');

const CDN_URL = process.env.CDN_URL || config.api?.cdn || '';

module.exports = {
    name: 'raw',
    alias: ['paste', 'textcdn', 'bin'],
    category: 'Tools',
    desc: 'Upload raw text/code to CRYSNOVA CDN and get a raw link',
    usage: '.raw <text or reply to text/code>',

    execute: async (sock, m, { reply, text, quoted }) => {
        let content = '';

        // Priority 1: replied text/code message
        const target = quoted || m.quoted;
        if (target && (target.text || target.body || target.message?.conversation)) {
            content = target.text || target.body || target.message?.conversation || '';
        }
        // Priority 2: text after command
        else if (text && text.trim().length > 0) {
            content = text.trim();
        }
        else {
            return reply(
                `⚉ _*Usage:*_\n\n` +
                `_*➊. Reply to a text/code message:*_\n` +
                `   .raw\n\n` +
                `_*➋. Type directly:*_\n` +
                `   .raw console.log("hello world");\n\n` +
                `_*➌. For multi-line code:*_\n` +
                `   .raw \`\`\`js\n   const x = 1;\n   console.log(x);\n   \`\`\``
            );
        }

        // Clean up markdown code blocks if present
        let cleanContent = content;
        if (content.startsWith('```') && content.endsWith('```')) {
            // Remove ```lang\n and trailing ```
            cleanContent = content.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
        }

        if (!cleanContent.trim()) {
            return reply('`✘ No content to upload`');
        }

        try {
            await sock.sendMessage(m.chat, { react: { text: '📤', key: m.key } });

            const form = new FormData();
            form.append('file', Buffer.from(cleanContent), {
                filename: 'paste.txt',
                contentType: 'text/plain',
            });

            const res = await axios.post(`${CDN_URL}/upload`, form, {
                headers: form.getHeaders(),
                timeout: 60000,
            });

            const url = res.data?.url;
            if (!url) return reply('`✘ No URL returned`');

            // Ensure raw link (add /raw if your CDN supports it)
            const rawUrl = url.replace(/\/(upload|file)\//, '/raw/').replace(/\.html?$/, '.txt');

            await sock.sendMessage(m.chat, {
                text: `⎙ *Pasted!*\n\n▽ ❏ _Tap button below to copy URL_`,
                nativeFlow: [{
                    text: '📋 Copy URL',
                    copy: rawUrl
                }]
            }, { quoted: m });

        } catch (err) {
            console.error('[RAW]', err.message);
            reply('✘ Upload failed — CDN might not support text uploads');
        }
    }
};
