const fs = require('fs')
const path = require('path')
const { downloadContentFromMessage } = require('plogme')

const DB_PATH = path.join(process.cwd(), 'database', 'vvcmd.json')

let triggers = {}
try {
    if (fs.existsSync(DB_PATH)) triggers = JSON.parse(fs.readFileSync(DB_PATH))
} catch {}

function saveDB() {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    fs.writeFileSync(DB_PATH, JSON.stringify(triggers, null, 2))
}

function makeMessageEnvelope(m, quoted) {
    if (m?.quoted?.fakeObj?.message) return m.quoted.fakeObj
    return {
        key: {
            ...(m?.quoted?.key || {}),
            remoteJid: m?.quoted?.chat || m?.chat,
            id: m?.quoted?.id,
            fromMe: m?.quoted?.fromMe,
            participant: m?.quoted?.sender,
        },
        message: quoted,
        participant: m?.quoted?.sender,
    }
}

async function downloadViewOnce(sock, envelope, media, type) {
    if (typeof sock?.downloadMediaMessage === 'function' && envelope?.message) {
        return sock.downloadMediaMessage(envelope, 'buffer')
    }

    // Compatibility fallback for lightweight test sockets and old integrations.
    const stream = await downloadContentFromMessage(media, type)
    const chunks = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks)
}

// ── Called on every message — exact same flow as .vvp ────────
module.exports.handleVVReply = async function(sock, m) {
    try {
        const sender  = m.sender
        const trigger = triggers[sender]
        if (!trigger) return

        // Text must be exactly the trigger emoji
        const text = (
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            ''
        ).trim()
        if (text !== trigger) return

        // ── EXACT SAME AS .vvp FROM HERE ─────────────────────

        // Must reply to something. Prefer the serialized quote, then fall
        // back to the raw context envelope used by newer Baileys clients.
        let quoted = m.quoted?.fakeObj?.message || m.quoted?.message || m.message?.extendedTextMessage?.contextInfo?.quotedMessage
        if (!quoted) return
        const envelope = makeMessageEnvelope(m, quoted)

        // Unwrap every envelope used by current WhatsApp clients.
        let unwrapped = true
        while (unwrapped && quoted) {
            unwrapped = false
            for (const key of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']) {
                if (quoted[key]?.message) {
                    quoted = quoted[key].message
                    unwrapped = true
                    break
                }
            }
        }

        const type = Object.keys(quoted)[0]

        if (!['imageMessage', 'videoMessage', 'stickerMessage', 'audioMessage'].includes(type)) return

        // Download
        const buffer = await downloadViewOnce(
            sock,
            envelope,
            quoted[type],
            type.replace('Message', '').toLowerCase()
        )

        const sendType =
            type === 'videoMessage'   ? 'video'   :
            type === 'imageMessage'   ? 'image'   :
            type === 'stickerMessage' ? 'sticker' :
            type === 'audioMessage'   ? 'audio'   : null

        if (!sendType) return

        // Send to DM — same as .vvp
        await sock.sendMessage(sender, {
            [sendType]: buffer,
            caption: `╭─❍ *CRYSNOVA AI V2.0*\n│ ✓ View-once saved privately.\n╰──────────────────`
        })

        // Delete the emoji reply to keep chat clean
        await sock.sendMessage(m.chat, { delete: m.key }).catch(() => {})

        console.log(`[VVCMD] Sent to ${sender.split('@')[0]} via "${trigger}"`)

    } catch (err) {
        console.error('[VVCMD ERROR]', err.message)
    }
}

// ── Command ───────────────────────────────────────────────────
module.exports = {
    ...module.exports,
    name: 'vvcmd',
    alias: ['setvv', 'vvtrigger'],
    category: 'Converter',
    reactions: { start: '👁️', success: '🤫' },

    execute: async (sock, m, { args, reply, prefix }) => {

        const sender = m.sender
        const sub    = args[0]
        const cmd = prefix + 'vvcmd'

        // .vvcmd 👌 — set emoji
        if (sub && sub !== 'off' && sub !== 'status') {
            triggers[sender] = sub
            saveDB()
            return reply(
                `╭─❍ *VV Trigger Set* ✦\n` +
                `│ Emoji: ${sub}\n` +
                `│\n` +
                `│ Reply to any view-once\n` +
                `│ with ${sub} → DMs you content\n` +
                `╰──────────────────`
            )
        }

        // .vvcmd off
        if (sub === 'off') {
            delete triggers[sender]
            saveDB()
            return reply('╭─❍ *VV Trigger*\n│ ✘ Removed\n╰──────────────────')
        }

        // .vvcmd status
        if (sub === 'status') {
            const current = triggers[sender]
            return reply(
                `╭─❍ *VV Trigger Status*\n` +
                `│ Trigger: ${current || '✘ Not set'}\n` +
                `╰──────────────────`
            )
        }

        return reply(
            `╭─❍ *VV Reply Trigger*\n` +
            `│\n` +
            `│ ✦ ${cmd} 👌    → set emoji\n` +
            `│ ✦ ${cmd} off   → remove\n` +
            `│ ✦ ${cmd} status → check\n` +
            `│\n` +
            `│ Reply to view-once with\n` +
            `│ your emoji → DMs content\n` +
            `╰──────────────────`
        )
    }
}
