const sharp = require('sharp');
const { downloadContentFromMessage } = require('@crysnovax/baileys');

// Store collage sessions: key = `${sender}_${chat}` -> { images: Buffer[], layout: string }
const collageSessions = new Map();

module.exports = {
    name:     'collage',
    alias:    ['combine', 'merge'],
    desc:     'Add images then merge them into a collage',
    category: 'Media',
    reactions: { start: '🖼️', success: '🥏' },

    execute: async (sock, m, { args, reply , prefix}) => {
        const subcommand = args[0]?.toLowerCase();
        const sessionKey = `${m.sender}_${m.chat}`;

        // Helper: download image from a message object
        const downloadImg = async (msgObj) => {
            const stream = await downloadContentFromMessage(msgObj, 'image');
            let buf = Buffer.alloc(0);
            for await (const chunk of stream) buf = Buffer.concat([buf, chunk]);
            return buf;
        };

        // Helper: get image from replied message (if any)
        const getRepliedImage = async () => {
            if (!m.quoted) return null;
            if (m.quoted.mtype === 'imageMessage') {
                const rawQuoted = m.msg?.contextInfo?.quotedMessage?.imageMessage;
                if (rawQuoted) return await downloadImg(rawQuoted);
            }
            return null;
        };

        // ── ADD command ─────────────────────────────────────────
        if (subcommand === 'add') {
            await sock.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});

            const imgBuffer = await getRepliedImage();
            if (!imgBuffer) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } }).catch(() => {});
                return reply('✘ Reply to an image with `${prefix}collage add`');
            }

            // Get or create session
            
            let session = collageSessions.get(sessionKey);
    if (!session) {
        session = { images: [], layout: 'grid' };
        collageSessions.set(sessionKey, session);
    }
    session.images.push(imgBuffer);

    await sock.sendMessage(m.chat, { react: { text: '🐾', key: m.key } }).catch(() => {});
    return reply(`\`❏◦ ${session.images.length} image(s) added ✓\``);
        }
        // ── PUSH command (generate collage) ──────────────────────
        if (subcommand === 'push') {
            const session = collageSessions.get(sessionKey);
            if (!session || session.images.length < 2) {
                return reply('✘ Need at least 2 images. Use `${prefix}collage add` on replied images first.');
            }

            // Optional layout argument
            let layout = args[1]?.toLowerCase() || session.layout || 'grid';
            if (!['grid', 'row', 'col', 'column'].includes(layout)) {
                layout = 'grid';
            }

            await sock.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
            await sock.sendMessage(m.chat, { text: '_*⟁⃝⎙ pushing...*_' }, { quoted: m });

            try {
                const images = session.images;
                const SIZE = 512;
                const GAP = 4;
                const count = images.length;
                const isRow = layout === 'row';
                const isCol = layout === 'col' || layout === 'column';
                const isGrid = layout === 'grid';

                // Resize all images
                const resized = await Promise.all(
                    images.map(buf =>
                        sharp(buf)
                            .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
                            .png()
                            .toBuffer()
                    )
                );

                let collageBuffer;

                if (isRow || (isGrid && count === 2)) {
                    const totalW = SIZE * count + GAP * (count - 1);
                    const base = sharp({
                        create: { width: totalW, height: SIZE, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } }
                    });
                    const composites = resized.map((buf, i) => ({
                        input: buf,
                        left: i * (SIZE + GAP),
                        top: 0
                    }));
                    collageBuffer = await base.composite(composites).jpeg({ quality: 92 }).toBuffer();
                } else if (isCol) {
                    const totalH = SIZE * count + GAP * (count - 1);
                    const base = sharp({
                        create: { width: SIZE, height: totalH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } }
                    });
                    const composites = resized.map((buf, i) => ({
                        input: buf,
                        left: 0,
                        top: i * (SIZE + GAP)
                    }));
                    collageBuffer = await base.composite(composites).jpeg({ quality: 92 }).toBuffer();
                } else {
                    const cols = count <= 2 ? count : 2;
                    const rows = Math.ceil(count / cols);
                    const totalW = cols * SIZE + GAP * (cols - 1);
                    const totalH = rows * SIZE + GAP * (rows - 1);
                    const base = sharp({
                        create: { width: totalW, height: totalH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } }
                    });
                    const composites = resized.map((buf, i) => ({
                        input: buf,
                        left: (i % cols) * (SIZE + GAP),
                        top: Math.floor(i / cols) * (SIZE + GAP)
                    }));
                    collageBuffer = await base.composite(composites).jpeg({ quality: 92 }).toBuffer();
                }

                await sock.sendMessage(m.chat, {
                    image: collageBuffer,
                    caption: '`✐ success`'
                }, { quoted: m });

                // Clear session after successful push
                collageSessions.delete(sessionKey);
                await sock.sendMessage(m.chat, { react: { text: '➕', key: m.key } }).catch(() => {});

            } catch (err) {
                console.error('[COLLAGE PUSH ERROR]', err.message);
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } }).catch(() => {});
                reply(`${prefix}✘ Failed: ${errmessage}`);
            }
            return;
        }

        // ── No valid subcommand: show usage ──────────────────────
        reply(
            `╭─❍ *🖼️ COLLAGE*\n│\n` +
            `│ *Usage:*\n` +
            `│ 1. Reply to an image with:\n` +
            `│    _.collage add_\n` +
            `│ 2. Repeat for 2+ images\n` +
            `│ 3. Type _.collage push_ [grid|row|col]\n│\n` +
            `│ *Examples:*\n` +
            `│ .collage add\n` +
            `│ .collage push row\n` +
            `╰──────────────────`
        );
    }
};
