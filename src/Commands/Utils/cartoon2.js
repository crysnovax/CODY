const sharp = require('sharp');
const { Jimp } = require('jimp');

module.exports = {
    name: 'comic2',
    alias: ['cartoon2', 'toon2', 'anime'],
    desc: 'Real comic book style filter',
    category: 'image',
    usage: `.comic2 (reply to image)`,

    execute: async (sock, m, { reply }) => {

        if (!m.quoted || !m.quoted.mtype?.includes('image')) {
            return reply('❌ Reply to an image');
        }

        try {

            await reply('🎨 Applying comic filter...');

            const buffer = await m.quoted.download();
            if (!buffer) return reply('❌ Failed to download image');

            // Resize
            const resized = await sharp(buffer)
                .resize({ width: 900, withoutEnlargement: true })
                .median(2)
                .toBuffer();

            // ✅ Correct for Jimp v1.6+
            const img = await Jimp.read(resized);

            img.posterize(8);
            img.contrast(0.3);
            img.color([{ apply: 'saturate', params: [40] }]);

            const quantized = await img.getBuffer('image/png');

            const edges = await sharp(quantized)
                .greyscale()
                .convolve({
                    width: 3,
                    height: 3,
                    kernel: [
                        -1, -1, -1,
                        -1,  8, -1,
                        -1, -1, -1
                    ]
                })
                .threshold(40)
                .blur(1.2)
                .threshold(20)
                .toBuffer();

            const finalImage = await sharp(quantized)
                .composite([{ input: edges, blend: 'multiply' }])
                .sharpen()
                .png()
                .toBuffer();

            await sock.sendMessage(
                m.chat,
                {
                    image: finalImage,
                    caption: '🎨 *Comic Style Applied!*'
                },
                { quoted: m }
            );

        } catch (err) {
            console.error('[COMIC2 ERROR]', err);
            reply('❌ Error: ' + err.message);
        }
    }
};