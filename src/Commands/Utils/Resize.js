const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

function runFfmpeg(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = {
    name: 'resize',
    alias: ['resize', 'scale', 'fit', 'crop', 'square', 'widen', 'heighten', 'compress', 'optimize'],
    desc: 'Resize, scale, crop, and optimize images with various modes. .resize also supports GIFs/video.',
    category: 'tools',
    usage: 'Reply to image + .resize 1920x1080 | .scale 200% | .fit 800x600 | .crop 1:1 | .square | .compress 80\nReply to GIF + .resize 640x360',
    owner: false,

    execute: async (sock, m, { args, reply , prefix}) => {
        // Must reply to a message
        if (!m.quoted) {
            return reply('*𓉤 Reply to an image to resize it!*');
        }

        const quoted = m.quoted;
        const mtype = quoted.mtype || quoted.type || '';
        const cmd = m.body.toLowerCase().split(/\s+/)[0].slice(1); // remove .

        // ── GIF / VIDEO PATH ──
        // WhatsApp GIFs are videoMessage with gifPlayback: true, not real .gif files.
        // sharp cannot read video at all, so this goes through ffmpeg instead.
        const isVideoType = mtype.includes('video');
        const isGifPlayback = !!(quoted.gifPlayback || quoted.msg?.gifPlayback);

        if (isVideoType) {
            if (!isGifPlayback) {
                return reply('⚉ This looks like a regular video, not a GIF. Resize currently supports GIFs and images only.');
            }

            if (cmd !== 'resize') {
                return reply(`${prefix}⚉ *${cmd}* isn't supported for GIFs yet — only *.resize WIDTHxHEIGHT* works on GIFs right now (e.g. .resize 640x360).`);
            }

            const arg = args[0] || '';
            if (!arg || !arg.includes('x')) {
                return reply('⚉ Usage: .resize 640x360 (reply to a GIF)');
            }

            const [gifW, gifH] = arg.split('x').map(v => parseInt(v));
            if (!gifW || !gifH || gifW < 2 || gifH < 2 || gifW > 4000 || gifH > 4000) {
                return reply('𓄄 Invalid dimensions. Use something like .resize 640x360');
            }

            try {
                await reply('_*✪ Processing GIF...*_');

                const buffer = await quoted.download();
                if (!buffer || buffer.length < 100) {
                    return reply('_*✘ Failed to download GIF*_');
                }

                const tempDir = path.join(__dirname, '../../temp');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                const stamp = Date.now();
                const input = path.join(tempDir, `gifin_${stamp}.mp4`);
                const output = path.join(tempDir, `gifout_${stamp}.mp4`);

                fs.writeFileSync(input, buffer);

                // scale to the requested size, then force even dimensions
                // (H.264 rejects odd width/height — user-typed sizes aren't guaranteed even)
                const cmdStr = `ffmpeg -y -i "${input}" -vf "scale=${gifW}:${gifH},scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos" -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an "${output}"`;

                await runFfmpeg(cmdStr);

                const outBuffer = fs.readFileSync(output);

                await sock.sendMessage(m.chat, {
                    video: outBuffer,
                    gifPlayback: true,
                    caption: `𓉤 Resized GIF → ${gifW}x${gifH}`
                }, { quoted: m });

                fs.unlinkSync(input);
                fs.unlinkSync(output);
                return;

            } catch (err) {
                console.error('[RESIZE GIF ERROR]', err.message || err);
                return reply('𓄄 Failed to resize GIF\n' + (err.message || 'Unknown error'));
            }
        }

        // ── IMAGE PATH (unchanged from original) ──
        if (!mtype.includes('image')) {
            return reply('⚉ Reply to an *image* or *GIF* (not video/sticker/doc)');
        }

        try {
            await reply('_*✪ Processing image...*_');

            // Download image
            const buffer = await m.quoted.download();
            if (!buffer || buffer.length < 100) {
                return reply('_*✘ Failed to download image*_');
            }

            let image = sharp(buffer);
            const metadata = await image.metadata();
            const origWidth = metadata.width;
            const origHeight = metadata.height;

            const arg = args[0] || '';
            let outputBuffer;
            let caption = '';

            switch (cmd) {
                case 'resize':
                    // Absolute resize: .resize 1920x1080 or .resize 1920 (auto height)
                    if (!arg) {
                        return reply('⚉ Usage: .resize 1920x1080 or .resize 1920');
                    }
                    
                    let width, height;
                    if (arg.includes('x')) {
                        [width, height] = arg.split('x').map(v => v ? parseInt(v) : null);
                    } else {
                        width = parseInt(arg);
                        height = null; // auto
                    }

                    if (!width || width < 1 || width > 10000) {
                        return reply('𓄄 Invalid width. Use: .resize 1920x1080');
                    }

                    image = image.resize(width, height, {
                        fit: 'fill',
                        kernel: sharp.kernel.lanczos3
                    });
                    caption = `𓉤 Resized: ${origWidth}x${origHeight} → ${width}${height ? 'x'+height : 'x?'}`;
                    break;

                case 'scale':
                    // Percentage scale: .scale 200% or .scale 0.5
                    if (!arg) {
                        return reply('⚉ Usage: .scale 200% or .scale 0.5');
                    }

                    let factor = arg.includes('%') ? parseFloat(arg) / 100 : parseFloat(arg);
                    if (isNaN(factor) || factor <= 0 || factor > 10) {
                        return reply('𓄄 Scale must be between 1% and 1000%');
                    }

                    const newWidth = Math.round(origWidth * factor);
                    const newHeight = Math.round(origHeight * factor);

                    image = image.resize(newWidth, newHeight, {
                        kernel: sharp.kernel.lanczos3
                    });
                    caption = `☬ Scaled: ${Math.round(factor * 100)}% (${origWidth}x${origHeight} → ${newWidth}x${newHeight})`;
                    break;

                case 'fit':
                    // Fit within bounds: .fit 800x600
                    if (!arg || !arg.includes('x')) {
                        return reply('⚉ Usage: .fit 800x600');
                    }

                    const [fitW, fitH] = arg.split('x').map(v => parseInt(v));
                    if (!fitW || !fitH) {
                        return reply('𓄄 Invalid dimensions');
                    }

                    image = image.resize(fitW, fitH, {
                        fit: 'inside',
                        withoutEnlargement: false
                    });
                    caption = `亗 Fit within: ${fitW}x${fitH}`;
                    break;

                case 'crop':
                    // Crop to aspect ratio: .crop 1:1 or .crop 16:9
                    if (!arg || !arg.includes(':')) {
                        return reply('⚉ Usage: .crop 1:1 or .crop 16:9');
                    }

                    const [ratioW, ratioH] = arg.split(':').map(v => parseInt(v));
                    if (!ratioW || !ratioH) {
                        return reply('𓄄 Invalid ratio');
                    }

                    const targetRatio = ratioW / ratioH;
                    const currentRatio = origWidth / origHeight;
                    let cropWidth, cropHeight, left, top;

                    if (currentRatio > targetRatio) {
                        // Image is wider, crop width
                        cropHeight = origHeight;
                        cropWidth = Math.round(origHeight * targetRatio);
                        left = Math.round((origWidth - cropWidth) / 2);
                        top = 0;
                    } else {
                        // Image is taller, crop height
                        cropWidth = origWidth;
                        cropHeight = Math.round(origWidth / targetRatio);
                        left = 0;
                        top = Math.round((origHeight - cropHeight) / 2);
                    }

                    image = image.extract({
                        left: left,
                        top: top,
                        width: cropWidth,
                        height: cropHeight
                    });
                    caption = `⚉ Cropped to ${ratioW}:${ratioH} (${cropWidth}x${cropHeight})`;
                    break;

                case 'square':
                    // Quick 1:1 center crop
                    const size = Math.min(origWidth, origHeight);
                    const leftPos = Math.round((origWidth - size) / 2);
                    const topPos = Math.round((origHeight - size) / 2);

                    image = image.extract({
                        left: leftPos,
                        top: topPos,
                        width: size,
                        height: size
                    });
                    caption = `𓄄 Squared: ${size}x${size}`;
                    break;

                case 'widen':
                    // Stretch width only: .widen 1920
                    const targetW = parseInt(arg) || origWidth * 2;
                    image = image.resize(targetW, origHeight, {
                        fit: 'fill'
                    });
                    caption = `乂 Widened: ${origWidth} → ${targetW}px`;
                    break;

                case 'heighten':
                    // Stretch height only: .heighten 1080
                    const targetH = parseInt(arg) || origHeight * 2;
                    image = image.resize(origWidth, targetH, {
                        fit: 'fill'
                    });
                    caption = `乂 Heightened: ${origHeight} → ${targetH}px`;
                    break;

                case 'compress':
                case 'optimize':
                    // Compress with quality: .compress 80 (default 85)
                    const quality = parseInt(arg) || 85;
                    if (quality < 1 || quality > 100) {
                        return reply('Quality must be 1-100');
                    }

                    // Resize to reasonable max if too large
                    if (origWidth > 4000 || origHeight > 4000) {
                        image = image.resize(4000, 4000, { fit: 'inside' });
                    }

                    outputBuffer = await image.jpeg({ 
                        quality: quality, 
                        progressive: true,
                        mozjpeg: true 
                    }).toBuffer();
                    
                    const origKB = Math.round(buffer.length / 1024);
                    const newKB = Math.round(outputBuffer.length / 1024);
                    const saved = Math.round((1 - outputBuffer.length / buffer.length) * 100);
                    
                    caption = `☬ Compressed: ${origKB}KB → ${newKB}KB (${saved}% saved)`;
                    break;

                default:
                    return reply('Unknown command. Use: .resize | .scale | .fit | .crop | .square | .widen | .heighten | .compress');
            }

            // Default output if not already set (compress sets its own)
            if (!outputBuffer) {
                outputBuffer = await image.png({ compressionLevel: 9 }).toBuffer();
            }

            // Send resized image
            await sock.sendMessage(m.key.remoteJid, {
                image: outputBuffer,
                mimetype: 'image/png',
                caption: `✨ ${caption}\n𓉤 Original: ${origWidth}x${origHeight}`
            }, { quoted: m });

        } catch (err) {
            console.error('[RESIZE ERROR]', err.message || err);
            await reply('𓄄 Failed to resize image\n' + (err.message || 'Unknown error'));
        }
    }
};
                                                          
