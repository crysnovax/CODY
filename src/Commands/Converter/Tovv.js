const { downloadContentFromMessage } = require('plogme')

function getQuotedText(quoted) {
    if (!quoted) return ''
    const message = quoted.msg || quoted.message || quoted
    const messageText = message.conversation ||
        message.extendedTextMessage?.text ||
        message.textMessage?.text
    if (typeof messageText === 'string' && messageText.trim()) return messageText

    const mtype = quoted.mtype || quoted.type || ''
    const hasMedia = /image|video|audio|document|sticker/i.test(mtype) ||
        ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
            .some(key => message[key])
    if (hasMedia) return ''
    const candidates = [
        quoted.text,
        quoted.body
    ]
    return candidates.find(value => typeof value === 'string' && value.trim()) || ''
}

module.exports = {
    name: "tovv",
    alias: [],
    category: "Converter",
    desc: "Convert media to view once",

    reactions: {
        start: "👁️",
        success: "✨"
    },

    execute: async (sock, m, { reply }) => {

        try {

            // ── Detect Media ─────────────────────────
            const quoted = m.quoted ? m.quoted : m
            const mime = (quoted.msg || quoted).mimetype || ""
            const quotedText = m.quoted ? getQuotedText(quoted) : ''

            if (quotedText) {
                await sock.sendMessage(m.chat, {
                    react: { text: "👁️", key: m.key }
                })

                await sock.sendMessage(
                    m.chat,
                    { text: quotedText, viewOnce: true },
                    { quoted: m }
                )

                await sock.sendMessage(m.chat, {
                    react: { text: "✨", key: m.key }
                })
                return
            }

            if (!/image|video/.test(mime)) {
                return reply(
`╭─❍ *TOVV*
│ ⚠️ Reply to text, image,
│ or video to convert
│ into view once
╰─ 𓄄`
                )
            }

            await sock.sendMessage(m.chat, {
                react: { text: "👁️", key: m.key }
            })

            // ── Download Media ───────────────────────
            const type = mime.startsWith("video") ? "video" : "image"

            const stream = await downloadContentFromMessage(
                quoted.msg || quoted,
                type
            )

            let buffer = Buffer.from([])

            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }

            // ── Send as View Once ────────────────────
            if (type === "image") {

                await sock.sendMessage(
                    m.chat,
                    {
                        image: buffer,
                        viewOnce: true,
                        caption: quoted.text || ""
                    },
                    { quoted: m }
                )

            } else {

                await sock.sendMessage(
                    m.chat,
                    {
                        video: buffer,
                        viewOnce: true,
                        caption: quoted.text || ""
                    },
                    { quoted: m }
                )

            }

            await sock.sendMessage(m.chat, {
                react: { text: "✨", key: m.key }
            })

        } catch (err) {

            console.error("TOVV ERROR:", err)

            reply(
`╭─❍ *ERROR*
│ ❌ Failed to convert
│ media to view once
╰─ 𓄄`
            )
        }
    }
}

module.exports.getQuotedText = getQuotedText
