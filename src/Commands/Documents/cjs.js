// comjs.js – Create a JavaScript file from raw code (no compression)
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'comjs',
    alias: ['compressjs', 'minifyjs'],
    desc: 'Create a JavaScript file from raw code (reply to .js document or text message)',
    category: 'Tools',
    usage: '.comjs <filename.js> (reply to a .js file or code text)  OR  .comjs <filename.js> <code>',

    execute: async (sock, m, { args, reply , prefix}) => {
        let customFileName = args[0]?.trim();
        if (customFileName && !customFileName.endsWith('.js')) customFileName += '.js';

        const quoted = m.quoted;
        let code = '';
        let sourceFileName = 'code.js';
        let isDocument = false;

        if (quoted) {
            const mtype = quoted.mtype || '';
            if (mtype === 'documentMessage' && quoted.fileName?.endsWith('.js')) {
                isDocument = true;
                sourceFileName = quoted.fileName;
                try {
                    const buffer = await quoted.download();
                    if (!buffer || buffer.length === 0) return reply('✘ Failed to download file');
                    code = buffer.toString('utf8');
                } catch (err) {
                    return reply('✘ Failed to read document');
                }
            } else if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
                code = quoted.text || quoted.body || '';
                if (!code.trim()) return reply('_✘ No code found in the replied message._');
            } else {
                return reply('_✘ Reply to a .js document or a text message containing JavaScript code._');
            }
        } else {
            if (!customFileName) return reply('_Provide a filename. Example: .comjs index.js console.log("hi")_');
            code = args.slice(1).join(' ').trim();
            if (!code) return reply('_No code provided after the filename._');
        }

        let finalFileName = customFileName || (isDocument ? sourceFileName : '£.js');
        if (!finalFileName.endsWith('.js')) finalFileName += '.js';

        if (!code.trim()) return reply('_✘ No code to package._');

        try {
            await sock.sendMessage(m.chat, { react: { text: '📄', key: m.key } });
            await reply('`⚉ working...`');

            const tempDir = path.join(__dirname, '../../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const outPath = path.join(tempDir, finalFileName);
            fs.writeFileSync(outPath, code, 'utf8');

            const stats = fs.statSync(outPath);
            const sizeKB = (stats.size / 1024).toFixed(2);

            await sock.sendMessage(m.chat, {
                document: fs.readFileSync(outPath),
                fileName: finalFileName,
                mimetype: 'text/plain',
                caption: `𝌆 *File Created*\n\n⎙ Filename: ${finalFileName}\n⎙ Size: ${stats.size} bytes (${sizeKB} KB)\n\n_⚉ CRYSNOVA Tools_`
            }, { quoted: m });

            fs.unlinkSync(outPath);
            await sock.sendMessage(m.chat, { react: { text: '🕸️', key: m.key } });

        } catch (err) {
            console.error('[COMJS ERROR]', err.message);
            reply(`${prefix}✘ *Failed to create file*\n⎙ _${errmessage}_`);
        }
    }
};
