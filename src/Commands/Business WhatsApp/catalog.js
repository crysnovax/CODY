const config = require('../../../settings/config');

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
    try {
        const result = await sock.getCatalog({ jid, limit });
        if (!Array.isArray(result.products) || result.products.length === 0) return null;
        return result;
    } catch {
        return null;
    }
};

const sendCatalog = async (sock, m, products, nextPageCursor, label, limit, { useEnvPhone = false, ownerPhone = '' } = {}) => {
    const cards = products.slice(0, 10).map(p => {
        const imageUrl = getProductImage(p.imageUrls);
        const price = formatPrice(p.price, p.currency);

        const productUrl = useEnvPhone
            ? `https://wa.me/p/${p.id}/${ownerPhone}`
            : (p.url || `https://wa.me/p/${p.id}/${ownerPhone}`);

        return {
            image: imageUrl
                ? { url: imageUrl, sourceUrl: imageUrl, imageHighResUrl: imageUrl }
                : { url: 'https://placehold.co/400x400/10b981/FFFFFF.png?text=No+Image' },
            body: { text: [
                `*${p.name || 'Unnamed Product'}*`,
                `💰 ${price}`,
                p.description ? `📝 ${p.description}` : null,
                `📦 ${p.availability || 'in stock'}`,
                `🆔 ${p.id}`
            ].filter(Boolean).join('\n') },
            footer: `⚉ ${BOT_NAME} Business`,
            nativeFlow: [{
                text: '🛒 View Product',
                url: productUrl
            }, {
                text: '✉ Inquire',
                copy: `Hi! I'm interested in: ${p.name} (ID: ${p.id})`
            }]
        };
    });

    await sock.sendMessage(m.chat, {
        text: `🛒 *${label}*`,
        footer: `Found ${products.length} product${products.length > 1 ? 's' : ''}`,
        carouselCardType: 'horizontal',
        cards
    }, { quoted: m });

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
