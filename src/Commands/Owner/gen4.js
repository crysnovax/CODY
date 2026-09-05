const MENU_IMAGE = 'https://cdn.crysnovax.link/files/1786913837400-12ad05cc-468a-4d71-8de8-1e5a11b48f3b.jpeg';

const gen4 = {
    name: 'gen4',
    alias: ['gen4menu', 'richmenu'],
    desc: 'Send the Gen4 Meta AI-style RichMenu',
    category: 'Owner',
    execute: async (sock, m, { reply }) => {
        if (typeof sock.richMenu !== 'function') {
            return reply('sock.richMenu is unavailable. Install plogme 2.7.11 or newer and restart CODY.');
        }

        const payload = {
            header: {
                title: 'Rich Menu',
                image: { url: MENU_IMAGE, mime_type: 'image/jpeg' }
            },
            body: {
                row: true,
                cards: [
                    {
                        title: 'Menu 1',
                        buttons: [
                            { id: 'menu2', text: 'menu2' },
                            { id: 'menu3', text: 'menu3' },
                            { id: 'rich3', text: 'rich3' }
                        ]
                    },
                    {
                        title: 'Menu 2',
                        buttons: [
                            { id: 'test', text: 'test' },
                            { id: 'me', text: 'me' },
                            { id: 'rich2', text: 'rich2' }
                        ]
                    }
                ]
            },
            footer: {
                text: 'Telegram channel',
                url: 'https://t.me/CRYSNOVA_AI'
            }
        };

        try {
            const result = await sock.richMenu(m.chat, payload);
            const messageId = result?.key?.id || result?.messageId || result?.id;
            return reply(`Gen4 RichMenu requested${messageId ? ` and relayed (message ${messageId})` : ' successfully'}. Client rendering depends on WhatsApp support.`);
        }
        catch (error) {
            return reply(`gen4 failed: ${error?.message || error}`);
        }
    }
};

module.exports = gen4;
