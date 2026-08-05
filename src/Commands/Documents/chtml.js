// comhtml.js – Create an HTML file from raw code (no compression)
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'comhtml',
    alias: ['compresshtml', 'minifyhtml'],
    desc: 'Create an HTML file from raw code (reply to .html document or text message)',
    category: 'Tools',
    usage: '.comhtml <filename.html> (reply to a .html file or code text)  OR  .comhtml <filename.html> <code>',

    execute: async (sock, m, { args, reply , prefix}) => {
        // 获取用户自定义文件名
        let customFileName = args[0]?.trim();
        if (customFileName && !customFileName.endsWith('.html')) customFileName += '.html';

        const quoted = m.quoted;
        let code = '';
        let sourceFileName = 'code.html';
        let isDocument = false;

        if (quoted) {
            const mtype = quoted.mtype || '';
            // 回复了 .html 文档
            if (mtype === 'documentMessage' && quoted.fileName?.endsWith('.html')) {
                isDocument = true;
                sourceFileName = quoted.fileName;
                try {
                    const buffer = await quoted.download();
                    if (!buffer || buffer.length === 0) return reply('✘ Failed to download file');
                    code = buffer.toString('utf8');
                } catch (err) {
                    return reply('✘ Failed to read document');
                }
            }
            // 回复了文本消息
            else if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
                code = quoted.text || quoted.body || '';
                if (!code.trim()) return reply('_✘ No HTML code found in the replied message._');
            } else {
                return reply('_✘ Reply to a .html document or a text message containing HTML code._');
            }
        } else {
            // 直接从命令参数提取代码
            if (!customFileName) return reply('_Provide a filename. Example: .comhtml index.html <h1>Hello</h1>_');
            code = args.slice(1).join(' ').trim();
            if (!code) return reply('_No code provided after the filename._');
        }

        // 确定最终文件名
        let finalFileName = customFileName || (isDocument ? sourceFileName : '⚉.html');
        if (!finalFileName.endsWith('.html')) finalFileName += '.html';

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
                mimetype: 'text/html',   // 若想避免自动打开浏览器，可改为 'text/plain'
                caption: `❏ *HTML File Created*\n\n⎙ Filename: ${finalFileName}\n⎙ Size: ${stats.size} bytes (${sizeKB} KB)\n\n_⚉ CRYSNOVA Tools_`
            }, { quoted: m });

            fs.unlinkSync(outPath);
            await sock.sendMessage(m.chat, { react: { text: '👾', key: m.key } });

        } catch (err) {
            console.error('[COMHTML ERROR]', err.message);
            reply(`${prefix}✘ *Failed to create HTML file*\n⎙ _${errmessage}_`);
        }
    }
};
