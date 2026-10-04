'use strict';

/**
 * Send a CODY grid through the current plogme/crysnovax-baileys rich relay.
 *
 * sendRichButtonGrid is retained only as a compatibility fallback for older
 * runtimes. Current plogme exposes sendA2UICommandMenu, which relays the
 * interactive envelope and then performs the type-14 rich edit required by
 * newer WhatsApp clients.
 */
function normalizeRows(grid) {
    return (grid?.cards || []).flatMap(card => {
        const title = String(card?.title || 'Menu');
        return (card?.buttons || card?.nativeFlow || []).map(button => [
            String(button?.text || button?.label || button?.id || 'Command'),
            title,
            String(button?.id || button?.text || 'command')
        ]);
    });
}

function normalizeButtons(grid) {
    return (grid?.cards || []).flatMap(card =>
        (card?.buttons || card?.nativeFlow || [])
            .filter(button => button?.url)
            .map(button => ({ text: button.text || button.label || 'Open', url: button.url }))
    );
}

async function sendRelayRichGrid(sock, jid, grid, options = {}) {
    if (typeof sock?.sendA2UICommandMenu === 'function') {
        return sock.sendA2UICommandMenu(jid, {
            title: grid?.text || grid?.cards?.[0]?.title || 'CODY AI',
            fallback: grid?.footer || grid?.text || 'CODY AI menu',
            rows: normalizeRows(grid),
            buttons: normalizeButtons(grid)
        }, { ...options, forceRichEdit: true });
    }

    // Compatibility path for an older plogme runtime. It is intentionally
    // never selected when the relay/edit API is available.
    if (typeof sock?.sendRichButtonGrid === 'function') {
        return sock.sendRichButtonGrid(jid, grid, options);
    }
    throw new Error('No relay-backed rich menu method is available. Update plogme/crysnovax-baileys.');
}

module.exports = { sendRelayRichGrid, normalizeRows, normalizeButtons };
