const { createCanvas } = require('canvas')
const sharp = require('sharp')
// PACK_NAME branding — ⚉ • <PACK_NAME> (@crysnovax—FIX09-08-26)
const { addExif } = require('../../../library/exif')
const { getStickerBranding } = require('../../Plugin/packname')

module.exports = {
    name: 'ttp',
    alias: ['text2sticker', 'textsticker', 'ttp'],
    category: 'Media',
    desc: 'Text to transparent sticker or large image (supports + for newline, --bg, --large, --color)',

    execute: async (sock, m, { args, reply, prefix }) => {
        // Defaults
        let text = ''
        let textColor = '#ffffff' // default white
        let backgroundColor = null // null = transparent
        let isLarge = false

        // If no args but quoted message, use quoted text
        if (args.length === 0 && m.quoted) {
            text = (m.quoted.text || m.quoted.caption || '').trim()
        } else {
            // Parse flags and text
            const textParts = []
            for (let i = 0; i < args.length; i++) {
                const arg = args[i]
                if (arg.startsWith('--')) {
                    const flag = arg.slice(2).toLowerCase()
                    if (flag === 'large') {
                        isLarge = true
                    } else if (flag.startsWith('large=')) {
                        isLarge = true
                        textParts.push(flag.slice(6)) // text after 'large='
                    } else if (flag.startsWith('bg=')) {
                        backgroundColor = flag.slice(3)
                    } else if (flag.startsWith('background=')) {
                        backgroundColor = flag.slice(11)
                    } else if (flag.startsWith('color=')) {
                        textColor = flag.slice(6)
                    } else if (flag.startsWith('textcolor=')) {
                        textColor = flag.slice(10)
                    } else {
                        // Unknown flag, treat as text
                        textParts.push(arg)
                    }
                } else if (arg.startsWith('-') && arg.length > 1) {
                    // Short flag like -l, -bg, -c
                    const short = arg.slice(1).toLowerCase()
                    if (short === 'l') {
                        isLarge = true
                    } else if (short.startsWith('bg')) {
                        const rest = short.slice(2)
                        if (rest.startsWith('=')) {
                            backgroundColor = rest.slice(1)
                        } else {
                            backgroundColor = rest
                        }
                    } else if (short.startsWith('c')) {
                        const rest = short.slice(1)
                        if (rest.startsWith('=')) {
                            textColor = rest.slice(1)
                        } else {
                            textColor = rest
                        }
                    } else {
                        textParts.push(arg)
                    }
                } else {
                    // For backward compatibility: first arg can be a color word like 'red'
                    if (i === 0 && !textColor && !backgroundColor && !isLarge) {
                        const colorWords = {
                            red: '#ff0000', blue: '#0000ff', green: '#00ff00',
                            yellow: '#ffff00', purple: '#800080', orange: '#ffa500',
                            pink: '#ff69b4', cyan: '#00ffff', white: '#ffffff',
                            black: '#000000', gray: '#808080'
                        }
                        const lower = arg.toLowerCase()
                        if (colorWords[lower]) {
                            textColor = colorWords[lower]
                            continue
                        }
                    }
                    textParts.push(arg)
                }
            }
            // Join text parts and replace '+' with newline
            text = textParts.join(' ').replace(/\+/g, '\n')
        }

        if (!text) {
            return reply(
                `⚉ Usage:\n` +
                `• ${prefix}ttp your text\n` +
                `• ${prefix}ttp red Crysnova\n` +
                `• ${prefix}ttp Hello+World --bg=yellow\n` +
                `• ${prefix}ttp --large=Hello+World 🌎 --bg=yellow --color=black`
            )
        }

        // Limit total characters (including newlines)
        if (text.length > 150) text = text.substring(0, 147) + '...'

        try {
            await reply('_*✦ Creating text sticker/image...*_')

            const canvas = createCanvas(512, 512)
            const ctx = canvas.getContext('2d')

            // Background
            if (backgroundColor) {
                ctx.fillStyle = backgroundColor
                ctx.fillRect(0, 0, 512, 512)
            } else {
                ctx.clearRect(0, 0, 512, 512) // transparent
            }

            // Split text by newlines
            const lines = text.split('\n')
            // Auto font size: start large, shrink until longest line fits
            let fontSize = 140
            let maxWidth = 460 // leave margin for stroke
            const fontFamily = 'Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'

            // Function to measure longest line width at a given font size
            const measureLongest = (size) => {
                ctx.font = `bold ${size}px ${fontFamily}`
                let max = 0
                for (const line of lines) {
                    const w = ctx.measureText(line).width
                    if (w > max) max = w
                }
                return max
            }

            while (measureLongest(fontSize) > maxWidth && fontSize > 12) {
                fontSize -= 2
            }

            // Apply final font
            ctx.font = `bold ${fontSize}px ${fontFamily}`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'

            // Outline + shadow
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = Math.max(3, fontSize / 12)
            ctx.shadowColor = 'rgba(0,0,0,0.8)'
            ctx.shadowBlur = 15
            ctx.shadowOffsetX = 5
            ctx.shadowOffsetY = 5

            // Draw each line
            const lineHeight = fontSize * 1.2
            const startY = 256 - ((lines.length - 1) * lineHeight) / 2
            lines.forEach((line, i) => {
                const y = startY + i * lineHeight
                ctx.strokeText(line, 256, y)
                ctx.fillStyle = textColor
                ctx.fillText(line, 256, y)
            })

            const pngBuffer = canvas.toBuffer('image/png')

            if (isLarge) {
                // Send as image
                await sock.sendMessage(m.chat, {
                    image: pngBuffer,
                    mimetype: 'image/png',
                    // caption: `Large text: ${text.replace(/\n/g, ' ')}`
                }, { quoted: m })
            } else {
                // Convert to webp sticker
                let stickerBuffer = await sharp(pngBuffer)
                    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .webp({ quality: 90, lossless: false, effort: 6 })
                    .toBuffer()

                // Apply branding
                try {
                    const { pack, author } = getStickerBranding()
                    stickerBuffer = await addExif(stickerBuffer, pack, author, ['🔥'])
                } catch (e) {
                    console.error('Failed to add exif:', e)
                }

                await sock.sendMessage(m.chat, {
                    sticker: stickerBuffer
                }, { quoted: m })
            }

            reply('✦ *Done!* _Text sticker/image sent 𓄄_')

        } catch (e) {
            console.log('[TTP ERROR]', e.message)
            reply('_*✘ Failed to create text sticker/image*_')
        }
    }
}
