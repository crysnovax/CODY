const sharp = require('sharp');

module.exports = {
    name: 'sketcher',
    alias: ['sketch', 'pencil', 'draw'],
    desc: 'Convert image to pencil sketch',
    category: 'image',
    usage: `.sketcher (reply to image)`,
    owner: false,
     // ⭐ Reaction config
    reactions: {
        start: '📝',
        success: '💫'
    },
     

    execute: async (sock, m, { reply }) => {
        if (!m.quoted || !m.quoted.mtype?.includes('image')) {
            return reply('⚉ _*Reply to an image*_');
        }

        try {
            await reply('✪ _*Creating pencil sketch...*_');

            const buffer = await m.quoted.download();
            if (!buffer || buffer.length < 1000) {
                return reply('✘ _*Failed to download image*_');
            }

            const metadata = await sharp(buffer).metadata();
            const width = Math.min(metadata.width, 1200);
            const height = Math.round(width * (metadata.height / metadata.width));

            // Step 1: Convert to grayscale
            const grayscale = await sharp(buffer)
                .resize(width, height, { fit: 'inside' })
                .grayscale()
                .toBuffer();

            // Step 2: Invert the image
            const inverted = await sharp(grayscale)
                .negate()
                .toBuffer();

            // Step 3: Apply Gaussian blur (adjust for line thickness)
            const blurred = await sharp(inverted)
                .blur(5) // lower = finer lines, higher = softer/thicker
                .toBuffer();

            // Step 4: Blend using color-dodge to create sketch effect
            const sketch = await sharp(grayscale)
                .composite([{
                    input: blurred,
                    blend: 'color-dodge' // ✅ corrected blend mode
                }])
                .toBuffer();

            await sock.sendMessage(m.chat, {
                image: sketch,
                mimetype: 'image/png',
                caption: '✏️ `Pencil Sketch!`'
            }, { quoted: m });

        } catch (err) {
            console.error('[SKETCHER ERROR]', err);
            await reply('❌ Error: ' + err.message);
        }
    }
};