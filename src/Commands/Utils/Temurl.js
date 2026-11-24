const axios = require('axios');
const FormData = require('form-data');

module.exports = {
    name: 'nurl',
    alias: ['tourl', 'upload'],
    desc: 'Upload any media and get a copyable URL',
    category: 'Tools',
    reactions: { start: '📤', success: '🔖', error: '❔' },

    execute: async (sock, m, { reply }) => {
        const target = m.quoted || m
        if (!target) return reply('`𓉤 Reply to any media`')

        const mtype = (target.mtype || '').toLowerCase()
        const qmsg = target.message || {}
        const inner = qmsg.viewOnceMessage?.message || qmsg.viewOnceMessageV2?.message || qmsg || {}

        // pick real media object
        const mediaObj = inner.imageMessage || inner.videoMessage || inner.audioMessage || inner.stickerMessage || inner.documentMessage || inner.gifPlaybackMessage || inner.videoMessage?.gifPlayback || {}
        const isImage = mtype.includes('image') || !!inner.imageMessage
        const isVideo = mtype.includes('video') || !!inner.videoMessage
        const isAudio = mtype.includes('audio') || mtype.includes('ptt') || mtype.includes('voice') || !!inner.audioMessage
        const isSticker = mtype.includes('sticker') || !!inner.stickerMessage
        const isDocument = mtype.includes('document') || !!inner.documentMessage
        const isGif = mtype.includes('gif') || mediaObj.gifPlayback === true

        if (!isImage && !isVideo && !isAudio && !isSticker && !isDocument && !isGif) return reply('`⚉ Reply to any media - image, video, audio, voice note, sticker, gif, document`')

        await sock.sendMessage(m.chat, { react: { text: '📤', key: m.key } })

        try {
            const buffer = await target.download()
            if (!buffer) return reply('`✘ Download failed`')

            let mime = (target.mimetype || mediaObj.mimetype || '').split(';')[0].trim().toLowerCase()
            let origName = mediaObj.fileName || mediaObj.title || ''
            let ext = ''
            let contentType = mime || 'application/octet-stream'
            let label = 'Media'

            // document keeps original name + ext
            if (isDocument && origName && origName.includes('.')) {
                ext = origName.split('.').pop().toLowerCase()
                label = 'Document'
                if (!mime) mime = contentType
            } else if (isSticker) {
                label = 'Sticker'
                ext = 'webp'; contentType = 'image/webp'
            } else if (isImage) {
                label = 'Image'
                if (mime === 'image/png') { ext = 'png'; contentType = 'image/png' }
                else if (mime === 'image/webp') { ext = 'webp'; contentType = 'image/webp' }
                else if (mime === 'image/gif') { ext = 'gif'; contentType = 'image/gif' }
                else if (mime === 'image/bmp') { ext = 'bmp'; contentType = 'image/bmp' }
                else if (mime === 'image/heic' || mime === 'image/heif') { ext = 'heic'; contentType = mime }
                else { ext = 'jpg'; contentType = 'image/jpeg' }
            } else if (isAudio) {
                label = 'Audio'
                if (mime === 'audio/ogg' || mime === 'audio/opus') { ext = 'ogg'; contentType = 'audio/ogg; codecs=opus' }
                else if (mime === 'audio/mpeg' || mime === 'audio/mp3') { ext = 'mp3'; contentType = 'audio/mpeg' }
                else if (mime === 'audio/mp4' || mime === 'audio/x-m4a') { ext = 'm4a'; contentType = 'audio/mp4' }
                else if (mime === 'audio/wav' || mime === 'audio/x-wav') { ext = 'wav'; contentType = 'audio/wav' }
                else if (mime === 'audio/aac') { ext = 'aac'; contentType = 'audio/aac' }
                else if (mime === 'audio/flac') { ext = 'flac'; contentType = 'audio/flac' }
                else if (mime === 'audio/amr') { ext = 'amr'; contentType = 'audio/amr' }
                else if (mime === 'audio/webm') { ext = 'webm'; contentType = 'audio/webm' }
                else if (mime === 'audio/oga') { ext = 'oga'; contentType = 'audio/oga' }
                else {
                    const isPtt = mediaObj.ptt === true || mtype.includes('ptt')
                    if (isPtt) { ext = 'ogg'; contentType = 'audio/ogg; codecs=opus' }
                    else { ext = 'mp3'; contentType = 'audio/mpeg' }
                }
            } else if (isVideo || isGif) {
                label = isGif ? 'Gif' : 'Video'
                if (mime === 'video/mp4') { ext = 'mp4'; contentType = 'video/mp4' }
                else if (mime === 'video/webm') { ext = 'webm'; contentType = 'video/webm' }
                else if (mime === 'video/3gpp') { ext = '3gp'; contentType = 'video/3gpp' }
                else if (mime === 'video/quicktime') { ext = 'mov'; contentType = 'video/quicktime' }
                else if (mime === 'image/gif') { ext = 'gif'; contentType = 'image/gif' }
                else { ext = 'mp4'; contentType = 'video/mp4' }
            } else if (isDocument) {
                label = 'Document'
                if (mime === 'application/pdf') ext = 'pdf'
                else if (mime === 'application/zip') ext = 'zip'
                else if (mime === 'application/x-rar-compressed') ext = 'rar'
                else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') ext = 'docx'
                else if (mime === 'application/msword') ext = 'doc'
                else if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ext = 'xlsx'
                else if (mime === 'application/vnd.ms-excel') ext = 'xls'
                else if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') ext = 'pptx'
                else if (mime === 'text/plain') ext = 'txt'
                else if (mime === 'application/json') ext = 'json'
                else if (mime === 'application/octet-stream' && origName) ext = origName.split('.').pop().toLowerCase()
                else ext = mime.split('/')[1] || 'bin'
                contentType = mime || 'application/octet-stream'
            }

            if (!ext) ext = 'bin'
            const filename = origName && isDocument ? origName : `${Date.now()}.${ext}`
            let url = null

            try {
                const form = new FormData()
                form.append('files[]', buffer, { filename, contentType })
                const res = await axios.post('https://uguu.se/upload.php', form, {
                    headers: { ...form.getHeaders(), 'Origin': 'https://uguu.se', 'Referer': 'https://uguu.se/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
                    timeout: 60000
                })
                url = res.data?.files?.[0]?.url
            } catch (e) { console.log('[NURL] uguu failed, trying quax...') }

            if (!url) {
                try {
                    const form = new FormData()
                    form.append('files[]', buffer, { filename, contentType })
                    const res = await axios.post('https://qu.ax/upload.php', form, {
                        headers: { ...form.getHeaders(), 'Origin': 'https://qu.ax', 'Referer': 'https://qu.ax/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
                        timeout: 60000
                    })
                    url = res.data?.files?.[0]?.url
                } catch (e) { console.log('[NURL] quax failed too...') }
            }

            if (!url) {
                try {
                    const form = new FormData()
                    form.append('reqtype', 'fileupload')
                    form.append('fileToUpload', buffer, { filename, contentType })
                    const res = await axios.post('https://catbox.moe/user/api.php', form, {
                        headers: { ...form.getHeaders(), 'Origin': 'https://catbox.moe', 'Referer': 'https://catbox.moe/', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' },
                        timeout: 60000
                    })
                    url = res.data?.trim()
                    if (url && !url.startsWith('http')) url = null
                } catch (e) { console.log('[NURL] catbox failed too...') }
            }

            if (!url) return reply('`✘ All upload services failed`')

            await sock.sendMessage(m.chat, {
                text: `⎙ *${label} Uploaded!*\n\n▽ ❏ _Tap button below to copy URL_\n\n\`${url}\``,
                nativeFlow: [{ text: '📋 Copy URL', copy: url }]
            }, { quoted: m })

            await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } })

        } catch (err) {
            console.error('[NURL ERROR]', err.message)
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } })
            reply(`\`✘ ${err.message || 'Upload failed'}\``)
        }
    }
                                }
