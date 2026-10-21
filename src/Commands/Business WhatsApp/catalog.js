const config = require('../../../settings/config');
const { identityVariants } = require('../../Plugin/identityUtils');

const BOT_NAME = config.botname || process.env.BOTNAME || 'CRYSNOVA';
const MY_NUMBER = config.ownernumber || process.env.OWNER_NUMBER || process.env.OWNER_NUMBERS || '';

const formatPrice = (price, currency) => {
    if (!price || !currency) return 'Contact for price';
    return `${currency} ${(price / 1000).toLocaleString()}`;
};

const getProductImage = (imageUrls) => {
    return imageUrls?.original || imageUrls?.requested || imageUrls?.url || null;
};

const getPhone = (jid) => jid?.split('@')[0]?.split(':')[0] || '';
const isLid = (jid) => jid?.endsWith('@lid');
const isPhone = (val) => /^[0-9]{6,15}$/.test(val);
const isLimit = (val) => /^[0-9]{1,3}$/.test(val);

const fetchCatalog = async (sock, jid, limit) => {
    // WhatsApp can address the same account by PN or LID. Query the supplied
    // identity first, then its mapped counterpart so phone-based lookups also
    // work for LID-first business accounts.
    const candidates = [...await identityVariants(sock, jid)];
    for (const candidate of candidates.length ? candidates : [jid]) {
        try {
            const result = await sock.getCatalog({ jid: candidate, limit });
            if (Array.isArray(result?.products) && result.products.length > 0) return result;
        } catch {}
    }
    return null;
};

const formatProductPrice = (value, currency) => {
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'number') return formatPrice(value, currency);
    return String(value);
};

const sendCatalog = async (sock, m, products, nextPageCursor, label, limit, { useEnvPhone = false, ownerPhone = '' } = {}) => {
    const productCards = products.slice(0, 10).map(p => {
        const image = getProductImage(p.imageUrls) || p.image || null;
        const productUrl = useEnvPhone
            ? `https://wa.me/p/${p.id}/${ownerPhone}`
            : (p.url || `https://wa.me/p/${p.id}/${ownerPhone}`);
        const price = formatProductPrice(p.price, p.currency);
        const salePrice = formatProductPrice(
            p.sale_price ?? p.salePrice ?? p.salePriceMinor,
            p.currency
        );

        return {
            title: p.name || p.title || 'Unnamed Product',
            brand: p.brand || BOT_NAME,
            ...(price ? { price } : {}),
            ...(salePrice ? { sale_price: salePrice } : {}),
            url: productUrl,
            ...(image ? { image } : {})
        };
    });

    if (typeof sock.sendPlogmeMessage === 'function') {
        await sock.sendPlogmeMessage(
            m.chat,
            { products: productCards },
            undefined,
            { renderRichResponse: true }
        );
    } else {
        // Keep a readable fallback for older plogme runtimes.
        await sock.sendMessage(m.chat, {
            text: `🛒 *${label}*\n\n${productCards.map(p => `*${p.title}*${p.price ? ` — ${p.price}` : ''}\n${p.url}`).join('\n\n')}`
        }, { quoted: m });
    }

    if (nextPageCursor) {
        await sock.sendMessage(m.chat, {
            text: `⚉ More available — use *.catalog here ${limit + 10}* to load more`
        });
    }
};

const USAGE = `🛒 *CATALOG USAGE*

☁︎  *.catalog* — show this guide
⌬ • *.catalog me* — browse my own catalog
⌬ • *.catalog here* — browse this contact's catalog
⌬ • *.catalog here 2348012345678* — if contact shows as not found

_Works in DMs only_`;

module.exports = {
    name: 'catalog',
    alias: ['products', 'shop', 'store'],
    desc: 'Browse business product catalog',
    category: 'Business',
    usage: '.catalog [me|here] [phone?] [limit?]',

    execute: async (sock, m, { args, reply }) => {
        const sub = args[0]?.toLowerCase();

        if (!sub) return reply(USAGE);

        if (m.chat.endsWith('@g.us')) {
            return reply('✘ DM only — send me a private message to use this command.');
        }

        // ── Parse args cleanly ─────────────────────────────────────
        // args[1] could be a phone number or a limit
        // args[2] could be a limit if args[1] was a phone
        const arg1 = args[1] || '';
        const arg2 = args[2] || '';

        const manualPhone = isPhone(arg1) ? arg1 : null;
        const limit = parseInt(isLimit(arg2) ? arg2 : isLimit(arg1) ? arg1 : '10') || 10;

        const myJid = sock.user?.id;
        const myPhone = MY_NUMBER || getPhone(myJid);

        await sock.sendMessage(m.chat, { react: { text: '🛒', key: m.key } });

        // ── .catalog me ────────────────────────────────────────────
        if (sub === 'me') {
            const result = await fetchCatalog(sock, myJid, limit);
            if (!result) return reply(`✘ You don't have a catalog yet.\n_Create one in WhatsApp Business settings._`);
            await sendCatalog(sock, m, result.products, result.nextPageCursor, `${BOT_NAME} CATALOG`, limit, {
                useEnvPhone: true,
                ownerPhone: myPhone
            });
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
            return;
        }

        // ── .catalog here [optional phone] ─────────────────────────
        if (sub === 'here') {
            let theirJid = null;

            if (manualPhone) {
                theirJid = `${manualPhone}@s.whatsapp.net`;
            } else if (!isLid(m.chat)) {
                theirJid = m.chat;
            }

            if (!theirJid) {
                return reply(
                    `✘ This contact uses LID — can't fetch automatically.\n\n` +
                    `⚉ Try: *.catalog here 2348012345678*`
                );
            }

            const theirPhone = getPhone(theirJid);

            const theirResult = await fetchCatalog(sock, theirJid, limit);
            if (theirResult) {
                await sendCatalog(sock, m, theirResult.products, theirResult.nextPageCursor, `CATALOG`, limit, {
                    useEnvPhone: false,
                    ownerPhone: theirPhone
                });
                await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
                return;
            }

            // Fallback to mine
            const myResult = await fetchCatalog(sock, myJid, limit);
            if (myResult) {
                await sock.sendMessage(m.chat, {
                    text: `_This contact has no catalog. Showing mine instead._`
                });
                await sendCatalog(sock, m, myResult.products, myResult.nextPageCursor, `${BOT_NAME} CATALOG`, limit, {
                    useEnvPhone: true,
                    ownerPhone: myPhone
                });
                await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
                return;
            }

            return reply(`✘ No catalog found here, and I don't have one either.`);
        }

        return reply(USAGE);
    }
};

module.exports.sendCatalog = sendCatalog;
module.exports.getProductImage = getProductImage;
