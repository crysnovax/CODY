// comcpp.js – Create a C++ file from raw code (no compression)
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'comc++',
    alias: ['compresscpp', 'minifycpp'],
    desc: 'Create a C++ file from raw code (reply to .cpp document or text message)',
    category: 'Tools',
    usage: '.comcpp <filename.cpp> (reply to a .cpp file or code text)  OR  .comcpp <filename.cpp> <code>',

    execute: async (sock, m, { args, reply , prefix}) => {
        // Get custom filename from user
        let customFileName = args[0]?.trim();
        if (customFileName && !customFileName.endsWith('.cpp')) customFileName += '.cpp';

        const quoted = m.quoted;
        let code = '';
        let sourceFileName = 'code.cpp';
        let isDocument = false;

        if (quoted) {
            const mtype = quoted.mtype || '';
            // Case: replied to a .cpp document
            if (mtype === 'documentMessage' && quoted.fileName?.endsWith('.cpp')) {
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
            // Case: replied to a text message
            else if (mtype === 'conversation' || mtype === 'extendedTextMessage') {
                code = quoted.text || quoted.body || '';
                if (!code.trim()) return reply('_✘ No C++ code found in the replied message._');
            } else {
                return reply('_✘ Reply to a .cpp document or a text message containing C++ code._');
            }
        } else {
            // Case: code provided directly in command
            if (!customFileName) return reply('_Provide a filename. Example: .comcpp main.cpp cout << "Hello";_');
            code = args.slice(1).join(' ').trim();
            if (!code) return reply('_No code provided after the filename._');
        }

        // Determine final filename
        let finalFileName = customFileName || (isDocument ? sourceFileName : '£.cpp');
        if (!finalFileName.endsWith('.cpp')) finalFileName += '.cpp';

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
                mimetype: 'text/x-c++src',   // Recognized as C++ source by most editors
                caption: `❏ *C++ File Created*\n\n⎙ Filename: ${finalFileName}\n⎙ Size: ${stats.size} bytes (${sizeKB} KB)\n\n_⚉ CRYSNOVA Tools_`
            }, { quoted: m });

            fs.unlinkSync(outPath);
            await sock.sendMessage(m.chat, { react: { text: '🧑‍💻', key: m.key } });

        } catch (err) {
            console.error('[COMCPP ERROR]', err.message);
            reply(`${prefix}✘ *Failed to create C++ file*\n⎙ _${errmessage}_`);
        }
    }
};
