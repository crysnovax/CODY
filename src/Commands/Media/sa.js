'use strict'

const fs = require('fs')
const { exec } = require('child_process')
const util = require('util')
const execAsync = util.promisify(exec)

// Drafts are intentionally scoped to the chat and sender so one user's add
// workflow cannot accidentally consume another user's sticker or audio.
const saudioDrafts = new Map()

function getInnerMessage(target) {
    const qmsg = target?.message || {}
    return qmsg.viewOnceMessage?.message
        || qmsg.viewOnceMessageV2?.message
        || qmsg.ephemeralMessage?.message
        || qmsg
        || {}
}

function mediaKind(target) {
    const inner = getInnerMessage(target)
    const type = String(target?.mtype || target?.type || target?.mimetype || '').toLowerCase()
    return {
        sticker: Boolean(inner.stickerMessage) || type.includes('sticker'),
        image: Boolean(inner.imageMessage) || type.includes('image'),
        video: Boolean(inner.videoMessage) || type.includes('video'),
        audio: Boolean(inner.audioMessage) || type.includes('audio')
    }
}

function tempName(prefix, stamp, extension) {
    return `/tmp/${prefix}-${stamp}.${extension}`
}

async function encodeAudioBuffer(audioBuffer, stamp, extension = 'mpeg') {
    if (!audioBuffer?.length) throw new Error('Downloaded audio is empty')
    if (audioBuffer.subarray(0, 4).toString() === 'OggS') {
        return { url: `data:audio/ogg;base64,${audioBuffer.toString('base64')}` }
    }
    const inPath = tempName('saudio-in', stamp, extension)
    const outPath = tempName('saudio-out', stamp, 'ogg')
    fs.writeFileSync(inPath, audioBuffer)
    try {
        await execAsync(`ffmpeg -y -i "${inPath}" -c:a libopus -b:a 32k -ar 48000 -ac 1 -t 3 "${outPath}"`)
        const converted = fs.readFileSync(outPath)
        return { url: `data:audio/ogg;base64,${converted.toString('base64')}` }
    } finally {
        try { fs.unlinkSync(inPath) } catch {}
        try { fs.unlinkSync(outPath) } catch {}
    }
}

function draftKey(m) {
    return `${m?.chat || 'unknown'}:${m?.sender || m?.participant || 'unknown'}`
}

function saudioHelp(prefix = '.') {
    return [
        '╭─❍ *🔊 SAUDIO*',
        '│',
        `│ ${prefix}saudio add — reply to a sticker or audio`,
        `│ ${prefix}saudio push — send the saved sticker with audio`,
        `│ ${prefix}saudio <audio-url> — reply to a sticker/image`,
        `│ ${prefix}saudio — reply to a video to make a sticker with its sound`,
        '│',
        '│ Add one sticker and one audio, then use push.',
        '╰──────────────────'
    ].join('\n')
}

async function createStickerAudioPayload(target, audioUrl = '') {
    if (!target) throw new Error('Reply to a video, sticker, or image')

    const kinds = mediaKind(target)
    if (!kinds.sticker && !kinds.image && !kinds.video) throw new Error('Reply to a video, sticker, or image')

    const rawBuffer = await target.download()
    if (!rawBuffer?.length) throw new Error('Download empty')

    let stickerBuffer
    let stickerAudio
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    if (kinds.video) {
        const inPath = tempName('saudio-vid', stamp, 'mp4')
        const webpPath = tempName('saudio-vid', stamp, 'webp')
        fs.writeFileSync(inPath, rawBuffer)
        try {
            // Match .sticker: centered 512x512 crop, not letterbox padding.
            await execAsync(`ffmpeg -y -i "${inPath}" -t 3 -vf "fps=12,scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v 70 -loop 0 -an "${webpPath}"`)
            stickerBuffer = fs.readFileSync(webpPath)

            let audioBuffer
            if (audioUrl) {
                const ar = await fetch(audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
                if (!ar.ok) throw new Error('Audio URL na 404')
                audioBuffer = Buffer.from(await ar.arrayBuffer())
                stickerAudio = await encodeAudioBuffer(audioBuffer, stamp)
            } else {
                const oggPath = tempName('saudio-vid-sound', stamp, 'ogg')
                try {
                    await execAsync(`ffmpeg -y -i "${inPath}" -vn -c:a libopus -b:a 32k -ar 48000 -ac 1 -t 3 "${oggPath}"`)
                    audioBuffer = fs.readFileSync(oggPath)
                    stickerAudio = { url: `data:audio/ogg;base64,${audioBuffer.toString('base64')}` }
                } finally {
                    try { fs.unlinkSync(oggPath) } catch {}
                }
            }
        } finally {
            try { fs.unlinkSync(inPath) } catch {}
            try { fs.unlinkSync(webpPath) } catch {}
        }
    } else {
        if (!audioUrl) throw new Error('Reply to a sticker/image with an audio URL, or use `.saudio add`')
        if (kinds.sticker) {
            stickerBuffer = rawBuffer
        } else {
            const inPath = tempName('saudio-img', stamp, 'jpg')
            const outPath = tempName('saudio-img', stamp, 'webp')
            fs.writeFileSync(inPath, rawBuffer)
            try {
                // Match the regular sticker image conversion exactly.
                await execAsync(`ffmpeg -y -i "${inPath}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512:(iw-ow)/2:(ih-oh)/2,format=yuva420p" -c:v libwebp -lossless 0 -q:v 80 -an "${outPath}"`)
                stickerBuffer = fs.readFileSync(outPath)
            } finally {
                try { fs.unlinkSync(inPath) } catch {}
                try { fs.unlinkSync(outPath) } catch {}
            }
        }

        const ar = await fetch(audioUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (!ar.ok) throw new Error('Audio URL na 404')
        const audioBuffer = Buffer.from(await ar.arrayBuffer())
        stickerAudio = audioUrl.toLowerCase().split('?')[0].endsWith('.ogg')
            ? { url: audioUrl }
            : await encodeAudioBuffer(audioBuffer, stamp, audioUrl.toLowerCase().split('?')[0].split('.').pop() || 'mpeg')
    }

    return { stickerBuffer, stickerAudio }
}

async function addDraftMedia(m, target) {
    if (!target) throw new Error('Reply to a sticker or audio with `.saudio add`')
    const kinds = mediaKind(target)
    const buffer = await target.download()
    if (!buffer?.length) throw new Error('Downloaded media is empty')
    const key = draftKey(m)
    const draft = saudioDrafts.get(key) || {}

    if (kinds.sticker) {
        draft.stickerBuffer = buffer
    } else if (kinds.audio) {
        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        draft.stickerAudio = await encodeAudioBuffer(buffer, stamp, 'mpeg')
    } else {
        throw new Error('`.saudio add` only accepts a replied sticker or audio')
    }

    saudioDrafts.set(key, draft)
    return draft
}

module.exports = {
    name: 'saudio',
    alias: ['sa'],
    desc: 'Create sticker audio directly or build one with add and push',
    category: 'Tools',
    adminOnly: false,
    groupOnly: false,
    usage: '.saudio | .saudio add | .saudio push | .saudio <audio url>',
    reactions: { start: '🔊', success: '💐', error: '❔' },

    execute: async (sock, m, { reply, args = [], prefix = '.' }) => {
        const action = String(args[0] || '').toLowerCase()
        try {
            if (!args.length) {
                if (!m.quoted) return reply(saudioHelp(prefix))
                const kinds = mediaKind(m.quoted)
                // Preserve the existing video -> sticker-with-video-audio shortcut.
                if (!kinds.video) return reply(saudioHelp(prefix))
            }

            if (action === 'add') {
                const draft = await addDraftMedia(m, m.quoted)
                const added = draft.stickerBuffer && draft.stickerAudio ? 'sticker and audio' : draft.stickerBuffer ? 'sticker' : 'audio'
                return reply(`✓ Saved ${added}. ${draft.stickerBuffer && draft.stickerAudio ? 'Use .saudio push.' : 'Add the other media, then use .saudio push.'}`)
            }

            if (action === 'push') {
                const draft = saudioDrafts.get(draftKey(m))
                if (!draft?.stickerBuffer || !draft?.stickerAudio) return reply('Add both a sticker and audio first: reply to each with `.saudio add`, then use `.saudio push`.')
                await sock.sendMessage(m.chat, { sticker: draft.stickerBuffer, stickerAudio: draft.stickerAudio }, { quoted: m })
                saudioDrafts.delete(draftKey(m))
                return
            }

            const audioUrl = (args[0] || '').trim()
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

    createStickerAudioPayload,
    addDraftMedia,
    saudioHelp,
    mediaKind,
    _drafts: saudioDrafts
}
