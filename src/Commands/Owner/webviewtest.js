// CODY WebView test command: owner-only local Mini App launch using the published sendRichWebview helper.
const LOCAL_MINI_APP_URL = process.env.CODY_MINIAPP_URL || 'https://3000-i7qaim3ry4869h3torapz-4aeb5eaa.us3.manus.computer/';

module.exports = {
    name: 'webviewtest',
    alias: ['miniapp', 'signalapp', 'wvtest'],
    desc: 'Open the local CODY Signal Arcade Mini App',
    category: 'Owner',
    owner: true,
    reactions: { start: '📡', success: '✅', error: '❔' },

    execute: async (sock, m, { reply }) => {
        try {
            if (typeof sock.sendRichWebview !== 'function') {
                throw new Error('sendRichWebview is unavailable; update plogme first');
            }

            await sock.sendMessage(m.chat, { react: { text: '📡', key: m.key } });
            await sock.sendRichWebview(m.chat, {
                title: 'CODY Signal Arcade',
                text: 'Tap the signal and watch the relay. Local WebView test surface for CODY.',
                buttonText: 'Open Signal Arcade',
                url: LOCAL_MINI_APP_URL,
                useWebview: true,
                toast: 'Opening Signal Arcade…',
                footer: 'Local test / no Worker connected'
            }, { quoted: m });
            await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        } catch (error) {
            console.error('[WEBVIEWTEST ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            return reply(`✘ WebView test failed: ${error.message}`);
        }
    }
};

module.exports.LOCAL_MINI_APP_URL = LOCAL_MINI_APP_URL;
