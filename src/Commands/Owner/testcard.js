const MENU_IMAGE = 'https://cdn.crysnovax.link/files/1786913837400-12ad05cc-468a-4d71-8de8-1e5a11b48f3b.jpeg';

const card = (title, buttons) => ({
    title,
    image: { url: MENU_IMAGE },
    buttons
});

const testcard = {
    name: 'testcard',
    alias: ['cardtest'],
    desc: 'Send a Meta AI-style rich button grid test card',
    category: 'Owner',
    execute: async (sock, m, { reply }) => {
        if (typeof sock.sendRichButtonGrid !== 'function') {
            return reply('sendRichButtonGrid is unavailable. Install the upgraded @crysnovax/plug runtime and restart CODY.');
        }

        const payload = {
            text: 'MENU · gen4',
            footer: 'Meta AI-style menu',
            cards: [
                card('Menu 1', [
                    { id: 'ping', text: 'Ping' },
                    { id: 'menu2', text: 'Menu2' },
                    { id: 'tsm_cards', text: 'Tsm Cards' },
                    { id: 'refresh', text: 'Refresh' },
                    { id: 'restart', text: 'Restart' },
                    { id: 'safe', text: 'Safe' }
                ]),
                card('Menu 2', [
                    { id: 'tsmll', text: 'tsmll' },
                    { id: 'adinv', text: 'Adinv' },
                    { id: 'adinv2', text: 'Adinv2' },
                    { id: 'hexa', text: 'Hexa' },
                    { id: 'rpic', text: 'Rpic' },
                    { id: 'rpic2', text: 'Rpic2' }
                ])
            ]
        };

        try {
            const result = await sock.sendRichButtonGrid(m.chat, payload);
            const messageId = result?.key?.id || result?.messageId;
            const renderedCards = result?.message?.cards || result?.cards;
            const cardCount = Array.isArray(renderedCards) ? renderedCards.length : 0;
            const buttonCount = Array.isArray(renderedCards)
                ? renderedCards.reduce((total, item) => total + (Array.isArray(item?.nativeFlow) ? item.nativeFlow.length : Array.isArray(item?.buttons) ? item.buttons.length : 0), 0)
                : 0;
            if (!messageId) throw new Error('rich-grid sender returned no message key');
            if (cardCount !== payload.cards.length || buttonCount < payload.cards.reduce((n, card) => n + card.buttons.length, 0)) {
                return reply(`Rich-grid relay returned message ${messageId}, but the returned payload was incomplete (${cardCount}/${payload.cards.length} cards, ${buttonCount} buttons). WhatsApp may not render this grid.`);
            }
            return reply(`Rich-grid payload verified and relayed (message ${messageId}; ${cardCount} cards, ${buttonCount} buttons). This confirms CODY handed WhatsApp a complete grid; client rendering still depends on WhatsApp support.`);
        } catch (error) {
            return reply(`testcard failed: ${error?.message || error}`);
        }
    }
};

module.exports = testcard;
