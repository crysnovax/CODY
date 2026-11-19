// ── PAYMENT MESSAGES COMMANDS (NGN) ──────────────────────────────────────
module.exports = [
    // ── PAYMENT INVITE ──────────────────────────────────────────────────
    {
        name: 'payinvite',
        alias: ['paymentinvite', 'invitepayment'],
        desc: 'Send a payment invite (NGN)',
        category: 'Payment',
        owner: true,
        usage: '.payinvite <service_type>',
        examples: ['.payinvite 1', '.payinvite 2', '.payinvite 3'],
        reactions: { start: '💳', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply }) => {
            const type = parseInt(args[0]);
            if (![1, 2, 3].includes(type)) {
                return reply(`⊘ *Usage:* payinvite 1/2/3\n\n• 1 - Service Type 1\n• 2 - Service Type 2\n• 3 - Service Type 3`);
            }

            await sock.sendMessage(m.chat, { react: { text: '💳', key: m.key } });

            try {
                await sock.sendMessage(m.chat, {
                    paymentInviteServiceType: type
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ ${err?.message || err}`);
            }
        }
    },

    // ── INVOICE NOTE ────────────────────────────────────────────────────
    {
        name: 'invoice',
        alias: ['sendinvoice', 'invoicenote'],
        desc: 'Send an invoice note (NGN) - requires image',
        category: 'Payment',
        owner: true,
        usage: `${prefix}invoice <amount> <note> (reply to image)`,
        examples: ['.invoice 5000 Payment for design'],
        reactions: { start: '📄', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply }) => {
            const amount = args[0]?.replace(/[^0-9]/g, '');
            const note = args.slice(1).join(' ').trim() || 'Invoice';

            if (!amount || isNaN(amount)) {
                return reply(`⊘ *Usage:* Reply to an image with invoice <amount> <note>\n\nExample: .invoice 5000 Payment for design`);
            }

            if (!m.quoted) {
                return reply(`⊘ *Reply to an image message*`);
            }

            const isImage = m.quoted.mtype === 'imageMessage' || m.quoted.message?.imageMessage;
            if (!isImage) {
                return reply(`⊘ *Reply to an image message*`);
            }

            await sock.sendMessage(m.chat, { react: { text: '📄', key: m.key } });

            try {
                const media = await sock.downloadMediaMessage(m.quoted);

                await sock.sendMessage(m.chat, {
                    image: media,
                    invoiceNote: `💰 NGN ${amount} - ${note}`
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
           //     return reply(`✓ *Invoice sent:* NGN ${amount}\n📝 ${note}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ ${err?.message || err}`);
            }
        }
    },

    // ── ORDER MESSAGE ───────────────────────────────────────────────────
    {
        name: 'order',
        alias: ['sendorder', 'ordertext'],
        desc: 'Send an order message with thumbnail (reply to image)',
        category: 'Payment',
        owner: true,
        usage: `${prefix}order <text> (reply to an image)`,
        examples: ['.order Order #1234'],
        reactions: { start: '🛍️', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply }) => {
            const orderText = args.join(' ').trim() || '🛍️ Order';

            if (!m.quoted) {
                return reply(`⊘ *Usage:* Reply to an image with order <text>\n\nExample: .order Order #1234`);
            }

            const isImage = m.quoted.mtype === 'imageMessage' || m.quoted.message?.imageMessage;
            if (!isImage) {
                return reply(`⊘ *Reply to an image message*`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🛍️', key: m.key } });

            try {
                const thumbnail = await sock.downloadMediaMessage(m.quoted);

                await sock.sendMessage(m.chat, {
                    orderText: orderText,
                    thumbnail: thumbnail
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
              //  return reply(`✓ *Order sent:* ${orderText}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ ${err?.message || err}`);
            }
        }
    },

    // ── REQUEST PAYMENT ──────────────────────────────────────────────────
    {
        name: 'requestpay',
        alias: ['reqpay', 'paymentrequest'],
        desc: 'Request payment from a user (NGN)',
        category: 'Payment',
        owner: true,
        usage: '.requestpay @user or reply to user',
        examples: ['.requestpay @user', '.requestpay (reply to user)'],
        reactions: { start: '💰', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply }) => {
            let targetJid = null;

            if (m.quoted) {
                targetJid = m.quoted.sender || m.quoted.participant || m.quoted.key?.participant;
            } else if (m.mentionedJid?.length) {
                targetJid = m.mentionedJid[0];
            }

            if (!targetJid) {
                return reply(`⊘ *Usage:* requestpay @user or reply to a user\n\nExample: .requestpay @user`);
            }

            await sock.sendMessage(m.chat, { react: { text: '💰', key: m.key } });

            try {
                await sock.sendMessage(m.chat, {
                    text: '💳 Request Payment (NGN)',
                    requestPaymentFrom: targetJid
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
               // return reply(`✓ *Payment request sent to:* ${targetJidsplit('@')[0]}\n💵 *Currency:* NGN (Naira)`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ ${err?.message || err}`);
            }
        }
    },

    // ── PRODUCT MESSAGE ──────────────────────────────────────────────────
    {
        name: 'product',
        alias: ['sendproduct', 'productmsg'],
        desc: 'Send a product message with customizable price (NGN)',
        category: 'Payment',
        owner: true,
        usage: `${prefix}product <name> <price> (reply to image)`,
        examples: ['.product Premium Package 5000'],
        reactions: { start: '📦', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply }) => {
            const price = args[args.length - 1]?.replace(/[^0-9]/g, '');
            const name = args.slice(0, -1).join(' ').trim() || 'Product';

            if (!price || isNaN(price)) {
                return reply(`⊘ *Usage:* product <name> <price> (reply to image)\n\nExample: .product Premium Package 5000`);
            }

            if (!m.quoted) {
                return reply(`⊘ *Reply to an image message*`);
            }

            const isImage = m.quoted.mtype === 'imageMessage' || m.quoted.message?.imageMessage;
            if (!isImage) {
                return reply(`⊘ *Reply to an image message*`);
            }

            await sock.sendMessage(m.chat, { react: { text: '📦', key: m.key } });

            try {
                const media = await sock.downloadMediaMessage(m.quoted);

                await sock.sendMessage(m.chat, {
                    image: media,
                    product: {
                        title: `${name} — NGN ${parseInt(price).toLocaleString()}`,
                        currency: 'NGN',
                        price: parseInt(price)
                    },
                    businessOwnerJid: '0@s.whatsapp.net'
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                //return reply(`✓ *Product sent:* ${name}\n💰 NGN ${parseInt(price)toLocaleString()}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ ${err?.message || err}`);
            }
        }
    }
];
