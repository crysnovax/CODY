const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

module.exports = {
    name: 'zip',
    alias: ['tozip', 'archive'],
    category: 'Documents',
    desc: 'Build .zip file: add files one by one then push',

    execute: async (sock, m, { args, reply, prefix }) => {
        const sender = m.sender
        if (!global.zipQueues) global.zipQueues = {}
        if (!global.zipQueues[sender]) global.zipQueues[sender] = []

        const queue = global.zipQueues[sender]
        const cmd = args[0]?.toLowerCase()

        // ── HELP / LIST ────────────────────────────────────────
        if (!cmd || cmd === 'list') {
            let msg = `𓉤 *Zip Builder*  (by ${sender.split('@')[0]})\n\n`
            msg += `Items in queue: ${queue.length}\n\n`

            if (queue.length === 0) {
                msg += 'Queue empty.\n\n'
            } else {
                queue.forEach((item, i) => {
                    msg += `${i + 1}. ${item.name || 'unnamed.' + item.ext}\n`
                })
                msg += '\n'
            }

            msg += `Commands:\n`
            msg += `• ${prefix}zip 1 → add replied media as #1\n`
            msg += `• ${prefix}zip 2 → add as #2 (etc)\n`
            msg += `• ${prefix}zip push → create & send .zip\n`
            msg += `• ${prefix}zip list → show queue\n`
            msg += `• ${prefix}zip clear → empty queue\n`
            msg += `• ${prefix}zip remove <number> → remove item\n`

            return reply(msg)
        }

        // ── CLEAR QUEUE ────────────────────────────────────────
        if (cmd === 'clear') {
            global.zipQueues[sender] = []
            return reply('✦ Queue cleared!')
        }

        // ── REMOVE ITEM ────────────────────────────────────────
        if (cmd === 'remove') {
            const num = parseInt(args[1])
            if (!num || num < 1 || num > queue.length) {
                return reply(`Invalid number! Current items: ${queuelength}`)
            }
            queue.splice(num - 1, 1)
            return reply(`✦ Item ${num} removed Queue now has ${queue.length} items.`)
        }

        // ── PUSH / CREATE ZIP ──────────────────────────────────
        if (cmd === 'push') {
            if (queue.length === 0) {
                return reply('Queue is empty! Add files first with .zip 1, .zip 2 etc.')
            }

            await reply('_✦ Zipping files..._')

            const tempDir = path.join(__dirname, '../../temp')
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

            const zipName = `archive_${Date.now()}.zip`
            const zipPath = path.join(tempDir, zipName)
            const output = fs.createWriteStream(zipPath)
            const archive = archiver('zip', { zlib: { level: 6 } })

            archive.pipe(output)

            for (const item of queue) {
                archive.append(item.buffer, { name: item.name })
            }

            await new Promise((resolve, reject) => {
                output.on('close', resolve)
                archive.on('error', reject)
                archive.finalize()
            })

            if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000) {
                fs.unlinkSync(zipPath)
                return reply('_*✘ Zipping failed - empty or invalid zip*_')
            }

            const zipBuffer = fs.readFileSync(zipPath)

            await sock.sendMessage(m.chat, {
                document: zipBuffer,
                mimetype: 'application/zip',
                fileName: zipName,
                caption: `𓉤 Zipped ${queue.length} file(s)\nName: ${zipName}`
            }, { quoted: m })

            reply('_*✦ Zip file sent! Tap to download.*_')

            // Cleanup
            fs.unlinkSync(zipPath)
            global.zipQueues[sender] = [] // auto clear after push

            return
        }

        // ── ADD ITEM ( .zip 1 , .zip 2 , etc ) ──────────────────
        const index = parseInt(cmd)
        if (isNaN(index) || index < 1) {
            return reply('_*⚉ Use .zip <number> (e.g. .zip 1) to add replied file*_')
        }

        const quoted = m.quoted
        if (!quoted) {
            return reply('_*𓄄 Reply to a media/file when using .zip <number>*_')
        }

        const downloadable = 
            quoted.mimetype ||
            quoted.isSticker ||
            quoted.isAnimated ||
            quoted.mtype === 'documentMessage' ||
            quoted.mtype === 'imageMessage' ||
            quoted.mtype === 'videoMessage' ||
            quoted.mtype === 'audioMessage'

        if (!downloadable) {
            return reply('_*Replied message has no downloadable media/file*_')
        }

        let buffer
        try {
            buffer = await quoted.download()
        } catch {
            return reply('_*✘ Failed to download replied file*_')
        }

        if (!buffer || buffer.length < 100) {
            return reply('_*✘ Downloaded file is empty/corrupted*_')
        }

        let ext = 'file'
        const mime = quoted.mimetype || ''
        if (mime.startsWith('image/')) ext = mime.split('/')[1] || 'jpg'
        else if (mime.startsWith('video/')) ext = 'mp4'
        else if (mime.startsWith('audio/')) ext = 'mp3'
        else if (mime === 'image/webp') ext = 'webp'
        else if (mime.includes('pdf')) ext = 'pdf'
        else if (mime.includes('octet-stream')) ext = 'bin'

        const item = {
            buffer,
            name: `file_\( {index}. \){ext}`,
            ext
        }

        // If position already exists, overwrite
        queue[index - 1] = item

        reply(`✦ Added as item #\( {index} ( \){itemname})\nQueue now has ${queue.length} items.\n\nUse .zip push to create zip`)
    }
}