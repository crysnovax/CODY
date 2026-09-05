// ── bizcover.js ──────────────────────────────────────────────────
const config = require('../../../settings/config');
const fs = require('fs');
const path = require('path');

const BOT_NAME = config.botname || process.env.BOTNAME || 'CRYSNOVA';
const STORE_PATH = path.join(__dirname, '../../../data/bizcover.json');
const S_WHATSAPP_NET = '@s.whatsapp.net';

const loadStore = () => {
    try {
        if (fs.existsSync(STORE_PATH)) return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    } catch {}
    return {};
};

const saveStore = (data) => {
    try {
        fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
        fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch {}
};

const USAGE = `\`\`\`🖼️ BUSINESS COVER\`\`\`

ⓘ  *.bizcover* — show this guide
❒ • *.bizcover set* — reply/quote an image to set cover photo
❒ • *.bizcover get* — extract current cover photo
❒ • *.bizcover delete* — remove cover photo`;

module.exports = {
    name: 'bizcover',
    alias: ['coverphoto', 'bizcov'],
    desc: 'Manage your WhatsApp Business cover photo',
    category: 'Business',
    owner: true,
    usage: '.bizcover [set|get|delete]',

    execute: async (sock, m, { args, reply }) => {
        const action = args[0]?.toLowerCase();
        if (!action) return reply(USAGE);

        try {
            await sock.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } });

            // ── set ────────────────────────────────────────────────
            if (action === 'set') {
                const quoted = m.quoted;
                const msg = quoted || m;
                const imgMsg = msg?.message?.imageMessage;

                if (!imgMsg) {
                    return reply('✘ Send or quote an image with *.bizcover set*');
                }

                const { downloadMediaMessage } = await import('plogme');
                const buffer = await downloadMediaMessage(
                    { message: msg.message, key: msg.key },
                    'buffer',
                    {}
                );

                const fbid = await sock.updateCoverPhoto(buffer);

                const store = loadStore();
                store.fbid = String(fbid);
                store.updatedAt = new Date().toISOString();
                saveStore(store);

                return await sock.sendMessage(m.chat, {
                    text: `\`\`\`🖼️ BUSINESS COVER\`\`\`\n\n❒ - *Action* ⇆ Set\n✆ - *Status* ⇆ Updated\nⓘ - *ID* ⇆ ${fbid}`,
                    footer: `⚉ ${BOT_NAME} Business`
                }, { quoted: m });
            }

            // ── get ────────────────────────────────────────────────
            if (action === 'get') {
                let rawResult = null;
                let queryError = null;

                try {
                    rawResult = await sock.query({
                        tag: 'iq',
                        attrs: {
                            to: S_WHATSAPP_NET,
                            type: 'get',
                            xmlns: 'w:biz'
                        },
                        content: [{
                            tag: 'business_profile',
                            attrs: { v: '3' },
                            content: [{
                                tag: 'cover_photo',
                                attrs: {}
                            }]
                        }]
                    });
                } catch (e) {
                    queryError = e.message;
                }

                // Debug: log raw result so we can see WA's response structure
                console.log('[BIZCOVER GET] raw result:', JSON.stringify(rawResult, null, 2));
                if (queryError) console.log('[BIZCOVER GET] query error:', queryError);

                // Try to parse cover_photo URL
                let url = null;
                if (rawResult) {
                    const content = rawResult?.content || [];
                    const profile = content.find?.(n => n?.tag === 'business_profile');
                    const coverContent = profile?.content || [];
                    const cover = coverContent.find?.(n => n?.tag === 'cover_photo');
                    url = cover?.attrs?.url || cover?.attrs?.id || null;

                    // Send raw response as debug info
                    await reply(
                        `_Raw response (debug):_\n\`\`\`${JSON.stringify(rawResult, null, 2).slice(0, 800)}\`\`\``
                    );
                }

                if (queryError) {
                    return reply(`✘ Query failed: ${queryError}`);
                }

                if (url) {
                    return await sock.sendMessage(m.chat, {
                        image: { url },
                        caption: `\`\`\`🖼️ BUSINESS COVER\`\`\`\n\n❒ - *Action* ⇆ Get\n✆ - *Status* ⇆ Found`,
                        footer: `⚉ ${BOT_NAME} Business`
                    }, { quoted: m });
                }

                return reply('✘ Could not extract cover photo URL from response.');
            }

            // ── delete ─────────────────────────────────────────────
            if (action === 'delete') {
                const store = loadStore();
                const id = args[1] || store.fbid;

                if (!id) {
                    return reply('✘ No cover photo ID found.\n_Use *.bizcover delete [id]* or set a cover photo first._');
                }

                await sock.removeCoverPhoto(id);

                delete store.fbid;
                delete store.updatedAt;
                saveStore(store);

                return await sock.sendMessage(m.chat, {
                    text: `\`\`\`🖼️ BUSINESS COVER\`\`\`\n\n❒ - *Action* ⇆ Delete\n𓃵 - *ID* ⇆ ${id}\n✆ - *Status* ⇆ Removed`,
                    footer: `⚉ ${BOT_NAME} Business`
                }, { quoted: m });
            }

            return reply(USAGE);

        } catch (err) {
            console.error('[BIZCOVER]', err.message);
            reply(`${prefix}✘ ${err?.message || err}`);
        }
    }
};

