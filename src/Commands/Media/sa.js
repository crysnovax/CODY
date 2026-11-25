'use strict'

async function createStickerAudioPayload(target, audioUrl = '') {
    if (!target) throw new Error('Reply to a video / sticker / image')

    const qmsg = target.message || {}
    const inner = qmsg.viewOnceMessage?.message || qmsg.viewOnceMessageV2?.message || qmsg.ephemeralMessage?.message || qmsg || {}
    const isSticker = !!inner.stickerMessage || (target.mtype || '').includes('sticker')
    const isImage = !!inner.imageMessage || (target.mtype || '').includes('image')
    const isVideo = !!inner.videoMessage || (target.mtype || '').includes('video')
    if (!isSticker && !isImage && !isVideo) throw new Error('Reply to a video / sticker / image')

    const fs = require('fs')
    const { exec } = require('child_process')
    const util = require('util')
    const execAsync = util.promisify(exec)
    const rawBuffer = await target.download()
    if (!rawBuffer?.length) throw new Error('Download empty')

    let stickerBuffer
    let stickerAudio
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    if (isVideo) {
        const inPath = `/tmp/saudio-vid-${stamp}.mp4`
        fs.writeFileSync(inPath, rawBuffer)
        const webpPath = `/tmp/saudio-vid-${stamp}.webp`
        await execAsync(`ffmpeg -y -i "${inPath}" -t 3 -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse" -loop 0 "${webpPath}"`)
        stickerBuffer = fs.readFileSync(webpPath)

        let audioBuffer
        if (audioUrl) {
            const ar = await fetch(audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
            if (!ar.ok) throw new Error('Audio URL na 404')
            audioBuffer = Buffer.from(await ar.arrayBuffer())
            if (!audioUrl.toLowerCase().split('?')[0].endsWith('.ogg')) {
                const tmpIn = `/tmp/saudio-aud-${stamp}.mpeg`
                const tmpOut = `/tmp/saudio-aud-${stamp}.ogg`
                fs.writeFileSync(tmpIn, audioBuffer)
                await execAsync(`ffmpeg -y -i "${tmpIn}" -c:a libopus -b:a 32k -ar 48000 -ac 1 -t 3 "${tmpOut}"`)
                audioBuffer = fs.readFileSync(tmpOut)
                try { fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut) } catch {}
            }
        } else {
            const oggPath = `/tmp/saudio-vid-sound-${stamp}.ogg`
            await execAsync(`ffmpeg -y -i "${inPath}" -vn -c:a libopus -b:a 32k -ar 48000 -ac 1 -t 3 "${oggPath}"`)
            audioBuffer = fs.readFileSync(oggPath)
            try { fs.unlinkSync(oggPath) } catch {}
        }
        stickerAudio = { url: `data:audio/ogg;base64,${audioBuffer.toString('base64')}` }
        try { fs.unlinkSync(inPath); fs.unlinkSync(webpPath) } catch {}
    } else {
        if (!audioUrl) throw new Error('Reply to sticker/image need: .saudio <audio url>')
        if (isSticker) {
            stickerBuffer = rawBuffer
        } else if (isImage) {
            const inPath = `/tmp/saudio-img-${stamp}.jpg`
            const outPath = `/tmp/saudio-img-${stamp}.webp`
            fs.writeFileSync(inPath, rawBuffer)
            await execAsync(`ffmpeg -y -i "${inPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2" -loop 0 "${outPath}"`)
            stickerBuffer = fs.readFileSync(outPath)
            try { fs.unlinkSync(inPath); fs.unlinkSync(outPath) } catch {}
        }

        const ar = await fetch(audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (!ar.ok) throw new Error('Audio URL na 404')
        let audioBuffer = Buffer.from(await ar.arrayBuffer())
        const isOgg = audioUrl.toLowerCase().split('?')[0].endsWith('.ogg')
        if (isOgg) {
            stickerAudio = { url: audioUrl }
        } else {
            const inExt = audioUrl.toLowerCase().split('?')[0].split('.').pop() || 'mpeg'
            const inPath = `/tmp/saudio-in-${stamp}.${inExt}`
            const outPath = `/tmp/saudio-out-${stamp}.ogg`
            fs.writeFileSync(inPath, audioBuffer)
            await execAsync(`ffmpeg -y -i "${inPath}" -c:a libopus -b:a 32k -ar 48000 -ac 1 -t 3 "${outPath}"`)
            audioBuffer = fs.readFileSync(outPath)
            try { fs.unlinkSync(inPath); fs.unlinkSync(outPath) } catch {}
            stickerAudio = { url: `data:audio/ogg;base64,${audioBuffer.toString('base64')}` }
        }
    }

    return { stickerBuffer, stickerAudio }
}

module.exports = {
    name: 'saudio',
    alias: ['sa'],
    desc: 'Reply to video = auto make animated sticker with video sound. Reply to sticker/image + /saudio <audio url> = sticker with that audio',
    category: 'Tools',
    usage: '.saudio [audio url]',
    reactions: { start: '🔊', success: '💐', error: '❔' },

    execute: async (sock, m, { reply, args }) => {
        const audioUrl = (args[0] || '').trim()
        try {
            const payload = await createStickerAudioPayload(m.quoted, audioUrl)
            await sock.sendMessage(m.chat, {
                sticker: payload.stickerBuffer,
                stickerAudio: payload.stickerAudio
            }, { quoted: m })
        } catch (err) {
            console.error('[SAUDIO]', err)
            reply(`\`✘ ${err.message}\``)
        }
    },

    createStickerAudioPayload
}
