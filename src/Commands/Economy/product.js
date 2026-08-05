const { randomUUID } = require('crypto');
const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage, getContentType } = require('@crysnovax/baileys');

const CDN_URL = 'https://cdn.crysnovax.link';

async function uploadToCDN(buffer) {
    const form = new FormData();
    form.append('file', buffer, { filename: 'product.jpg', contentType: 'image/jpeg' });
    const res = await axios.post(`${CDN_URL}/upload`, form, {
        headers: form.getHeaders(),
        timeout: 30000
    });
    return res.data?.url || res.data?.link || res.data?.file || null;
}

async function downloadQuoted(quoted) {
    try {
        // Method 1: Try built-in download if available
        if (typeof quoted.download === 'function') return await quoted.download();
    } catch (e) {}

    try {
        // Method 2: Extract the actual message content from the quoted object
        // The quoted message structure varies - it could be:
        // quoted.message.imageMessage OR quoted.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage
        let messageContent = quoted.message;
        
        // Handle ephemeral messages wrapper
        if (messageContent?.ephemeralMessage?.message) {
            messageContent = messageContent.ephemeralMessage.message;
        }
        
        // Handle viewOnce messages wrapper
        if (messageContent?.viewOnceMessage?.message) {
            messageContent = messageContent.viewOnceMessage.message;
        }
        
        // Get the actual message type
        const messageType = getContentType(messageContent);
        
        if (!messageType || !messageType.includes('image')) {
            // Check if it's in a quoted context (message was quoted inside an extendedTextMessage)
            const quotedMsg = messageContent?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quotedMsg) {
                const quotedType = getContentType(quotedMsg);
                if (quotedType?.includes('image')) {
                    messageContent = quotedMsg;
                }
            }
        }

        const imageMessage = messageContent?.imageMessage;
        if (!imageMessage) return null;

        const stream = await downloadContentFromMessage(imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return Buffer.concat(chunks);
    } catch (error) {
        console.error('[DOWNLOAD QUOTED ERROR]', error.message);
        return null;
    }
}

module.exports = {
    name: 'product',
    alias: ['shop', 'sell', 'catalog'],
    desc: 'Create a product listing with purchase button',
    category: 'Shop',
    usage: `.product <title> | <price> | <description> | <url> (reply to image)`,
    reactions: { start: '🛍️', success: '🥏', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const fullText = args.join(' ').trim();
        
        if (!fullText) {
            return reply(
                `╭─❍ *PRODUCT LISTING*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}product <title> | <price> | <desc> | <url>\n│\n` +
                `│ ✪ *Example:*\n` +
                `│ 💱${prefix}product Sticker Pack | 5000 | Premium stickers | https://...\n│\n` +
                `│ 🔖 *Reply to product image!*\n` +
                `╰──────────────────`
            );
        }

        // Parse parameters
        const parts = fullText.split('|').map(p => p.trim());
        const title = parts[0] || 'Product';
        const priceAmount = parseInt(parts[1]?.replace(/[^0-9]/g, '') || '0');
        const description = parts[2] || 'No description';
        const productUrl = parts[3] || 'https://whatsapp.com/channel/0029Vb6pe77K0IBn48HLKb38';

        // Check if message is a reply to an image
        // m.quoted is set when the user replies to a message
        if (!m.quoted) {
            return reply('`✘ Reply to a product image`');
        }

        // Verify the quoted message actually contains an image
        const quotedBuffer = await downloadQuoted(m.quoted);
        if (!quotedBuffer) {
            return reply('`✘ Reply to a product image`');
        }

        await sock.sendMessage(m.chat, { react: { text: '🛍️', key: m.key } });
        await reply(`\`🛍️ Creating product\``);

        try {
            // Upload product image
            const imageUrl = await uploadToCDN(quotedBuffer);
            if (!imageUrl) return reply('`✘ Failed to upload image`');

            const productId = randomUUID();

            await sock.sendMessage(m.chat, {
                image: { url: imageUrl },
                body: `🛍️ *${title}*\n\n${description}`,
                footer: 'Tap button to purchase',
                product: {
                    currencyCode: 'NGN',
                    description: description,
                    priceAmount1000: priceAmount * 1000,
                    productId: productId,
                    productImageCount: 1,
                    salePriceAmount1000: priceAmount * 1000,
                    signedUrl: productUrl,
                    title: title,
                    url: productUrl
                },
                businessOwnerJid: '0@s.whatsapp.net'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🥏', key: m.key } });

        } catch (error) {
            console.error('[PRODUCT ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply(`\`✘ ${error.message || 'Failed to create product'}\``);
        }
    }
};
