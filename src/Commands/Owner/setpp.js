const { downloadContentFromMessage } = require('plogme')

module.exports = {
    name: "setpp",
    alias: ["setbotpp", "setppbot", "setprofilepic"],
    category: "owner",
    desc: "Change bot profile picture",

    reactions: {
        start: "📸",
        success: "✨"
    },

    execute: async (sock, m, { reply }) => {

        try {

            // ── Detect Image ─────────────────────────
            const quoted = m.quoted ? m.quoted : m
            const mime = (quoted.msg || quoted).mimetype || ""

            if (!/image/.test(mime)) {
                return reply(
`╭─❍ *SETPP*
│ ಥ⁠‿⁠ಥ Reply to an image
│ to set as bot profile
╰─ 𓄄`
                )
            }

            await sock.sendMessage(m.chat, {
                react: { text: "📸", key: m.key }
            })

            // ── Download Image ───────────────────────
            const stream = await downloadContentFromMessage(
                quoted.msg || quoted,
                "image"
            )

            const chunks = []
            for await (const chunk of stream) chunks.push(chunk)
            const buffer = Buffer.concat(chunks)

            // ── Determine Mode ───────────────────────
            // hd = full-size no crop | standard = 720×720 crop
            const args = m.text?.trim().split(/\s+/) || []
            const isHD = args.includes("hd") || args.includes("--hd")

            // ── Update Profile Picture ───────────────
            await sock.updateProfilePicture(
                sock.user.id,
                buffer,
                isHD ? { hd: true } : undefined
            )

            await sock.sendMessage(m.chat, {
                react: { text: "✨", key: m.key }
            })

            reply(
`╭─❍ *PROFILE UPDATED*
│ ( ͡❛ ₃ ͡❛) Bot profile picture
│   changed successfully
│ 📐 Mode: ${isHD ? "HD (full-size)" : "Standard (720×720)"}
╰─ 𓄄`
            )

        } catch (err) {

            console.error("SETPP ERROR:", err)

            reply(
`╭─❍ *ERROR*
│ ಠ_ಠ Failed to update
│ bot profile picture
╰─ 𓄄`
            )
        }
    }
}
