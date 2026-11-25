module.exports = {
    name: 'saudio',
    alias: ['sa'],
    desc: 'Reply to video = auto make animated sticker with video sound. Reply to sticker/image + /saudio <audio url> = sticker with that audio',
    category: 'Tools',
    usage: '.saudio [audio url]',
    reactions: { start: '🔊', success: '💐', error: '❔' },

    execute: async (sock, m, { reply, args }) => {
        const audioUrl = (args[0] || '').trim()
        const target = m.quoted
        if (!target) return reply('`𓉤 Reply to a video / sticker / image`')

        const qmsg = target.message || {}
        const inner = qmsg.viewOnceMessage?.message || qmsg.viewOnceMessageV2?.message || qmsg.ephemeralMessage?.message || qmsg || {}
        const isSticker = !!inner.stickerMessage || (target.mtype || '').includes('sticker')
        const isImage = !!inner.imageMessage || (target.mtype || '').includes('image')
        const isVideo = !!inner.videoMessage || (target.mtype || '').includes('video')
        if (!isSticker && !isImage && !isVideo) return reply('`⚉ Reply to a video / sticker / image`')

        try {
            const fs = require('fs')
            const { exec } = require('child_process')
            const util = require('util')
            const execAsync = util.promisify(exec)

            const rawBuffer = await target.download()
            if (!rawBuffer?.length) return reply('`✘ Download empty`')

            let stickerBuffer
            let stickerAudio

            if (isVideo) {
                // VIDEO ALONE = do everything at once, no audio URL needed
                const inPath = `/tmp/saudio-vid-${Date.now()}.mp4`
                fs.writeFileSync(inPath, rawBuffer)

                // 1. video -> animated webp sticker (3s, 512x512)
                const webpPath = `/tmp/saudio-vid-${Date.now()}.webp`
                await execAsync(`ffmpeg -y -i "${inPath}" -t 3 -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse" -loop 0 "${webpPath}"`)
                stickerBuffer = fs.readFileSync(webpPath)

                // 2. video sound -> ogg (take sound inside the video itself)
                let audioBuffer
                if (audioUrl) {
                    // if you still give audio URL, use that one instead
                    const ar = await fetch(audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
                    audioBuffer = Buffer.from(await ar.arrayBuffer())
                    if (!audioUrl.toLowerCase().split('?')[0].endsWith('.ogg')) {
                        const tmpIn = `/tmp/saudio-aud-${Date.now()}.mpeg`
                        const tmpOut = `/tmp/saudio-aud-${Date.now()}.ogg`
                        fs.writeFileSync(tmpIn, audioBuffer)
                        await execAsync(`ffmpeg -y -i "${tmpIn}" -c:a libopus -b:a 32k -ar 48000 -ac 1 -t 3 "${tmpOut}"`)
                        audioBuffer = fs.readFileSync(tmpOut)
                        try { fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut) } catch (e) {}
                    }
                } else {
                    // NO audio URL - extract sound from video itself
                    const oggPath = `/tmp/saudio-vid-sound-${Date.now()}.ogg`
                    await execAsync(`ffmpeg -y -i "${inPath}" -vn -c:a libopus -b:a 32k -ar 48000 -ac 1 -t 3 "${oggPath}"`)
                    audioBuffer = fs.readFileSync(oggPath)
                    try { fs.unlinkSync(oggPath) } catch (e) {}
                }

                stickerAudio = { url: `data:audio/ogg;base64,${audioBuffer.toString('base64')}` }
                try { fs.unlinkSync(inPath); fs.unlinkSync(webpPath) } catch (e) {}

            } else {
                // STICKER / IMAGE - need audio URL
                if (!audioUrl) return reply('`𓉤 Reply to sticker/image need: .saudio <audio url>`')

                if (isSticker) {
                    stickerBuffer = rawBuffer
                } else if (isImage) {
                    const inPath = `/tmp/saudio-img-${Date.now()}.jpg`
                    const outPath = `/tmp/saudio-img-${Date.now()}.webp`
                    fs.writeFileSync(inPath, rawBuffer)
                    await execAsync(`ffmpeg -y -i "${inPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" -loop 0 "${outPath}"`)
                    stickerBuffer = fs.readFileSync(outPath)
                    try { fs.unlinkSync(inPath); fs.unlinkSync(outPath) } catch (e) {}
                }

                const ar = await fetch(audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
                if (!ar.ok) return reply('`✘ Audio URL na 404`')
                let audioBuffer = Buffer.from(await ar.arrayBuffer())
                const isOgg = audioUrl.toLowerCase().split('?')[0].endsWith('.ogg')
                if (isOgg) {
                    stickerAudio = { url: audioUrl }
                } else {
                    const inExt = audioUrl.toLowerCase().split('?')[0].split('.').pop() || 'mpeg'
                    const inPath = `/tmp/saudio-in-${Date.now()}.${inExt}`
                    const outPath = `/tmp/saudio-out-${Date.now()}.ogg`
                    fs.writeFileSync(inPath, audioBuffer)
                    await execAsync(`ffmpeg -y -i "${inPath}" -c:a libopus -b:a 32k -ar 48000 -ac 1 -t 3 "${outPath}"`)
                    audioBuffer = fs.readFileSync(outPath)
                    try { fs.unlinkSync(inPath); fs.unlinkSync(outPath) } catch (e) {}
                    stickerAudio = { url: `data:audio/ogg;base64,${audioBuffer.toString('base64')}` }
                }
            }

            await sock.sendMessage(m.chat, {
                sticker: stickerBuffer,
                stickerAudio: stickerAudio
            }, { quoted: m })
        } catch (err) {
            console.error('[SAUDIO]', err)
            reply(`\`✘ ${err.message}\``)
        }
    }
}
