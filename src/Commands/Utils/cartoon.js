const sharp = require('sharp');
const { Jimp } = require('jimp');

module.exports = {
    name: 'comic2',
    alias: ['cartoon2', 'toon2', 'anime'],
    desc: 'Real comic book style filter (light version)',
    category: 'image',
    usage: `.comic2 (reply to image)`,

    execute: async (sock, m, { reply }) => {

        if (!m.quoted || !m.quoted.mtype?.includes('image')) {
            return reply('❌ Reply to an image');
        }

        try {

            await reply('🎨 Applying lighter comic filter...');

            const buffer = await m.quoted.download();
            if (!buffer) return reply('❌ Failed to download image');

            // Resize and mild smoothing
            const resized = await sharp(buffer)
                .resize({ width: 900, withoutEnlargement: true })
                .median(2)
                .toBuffer();

            // Jimp processing: flat colors with lighter feel
            const img = await Jimp.read(resized);

            img.posterize(8);
            // img.brightness(0.1);    // optional – uncomment to lighten further
            // img.contrast(0.15);     // optional – adjust as needed
            img.color([{ apply: 'saturate', params: [20] }]); // less saturation

            const quantized = await img.getBuffer('image/png');

            // Generate bold outlines
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

            // Composite with soft-light (hyphenated) and low opacity
            const finalImage = await sharp(quantized)
                .composite([{
                    input: edges,
                    blend: 'soft-light',  // ✅ fixed: 'soft-light' not 'softlight'
                    opacity: 0.4
                }])
                .sharpen()
                .png()
                .toBuffer();

            await sock.sendMessage(
                m.chat,
                {
                    image: finalImage,
                    caption: '🎨 *Lighter Comic Style Applied!*'
                },
                { quoted: m }
            );

        } catch (err) {
            console.error('[COMIC2 ERROR]', err);
            reply('❌ Error: ' + err.message);
        }
    }
};