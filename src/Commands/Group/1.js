const activePins = new Map()

module.exports = {
    name: "gmpin",
    alias: ["msgpingc"],
    desc: "Pin a message for a specific duration",
    category: "group",
    usage: `.msgpin 24hr | 7d | 30d`,
    groupOnly: true,
    adminOnly:  true,

    execute: async (sock, m, { args, reply }) => {

        const PREFIX = "."

        if (!m.quoted) {
            return reply(
`╭─❍ *CRYSNOVA AI V2.0*
│ ✘ Reply to a message
│
│ Example:
│ ${PREFIX}msgpin 24hr
│ ${PREFIX}msgpin 7d
│ ${PREFIX}msgpin 30d
╰──────────────────`)
        }

        const timeInput = args[0]?.toLowerCase()

        if (!timeInput) {
            return reply(
`╭─❍ *CRYSNOVA AI V2.0*
│ ✘ Provide duration
│
│ ${PREFIX}msgpin 24hr
│ ${PREFIX}msgpin 7d
│ ${PREFIX}msgpin 30d
╰──────────────────`)
        }

        const validTimes = ["24hr","7d","30d"]

        if (!validTimes.includes(timeInput)) {
            return reply(
`╭─❍ *CRYSNOVA AI V2.0*
│ ✘ Invalid time
│
│ Use:
│ ${PREFIX}msgpin 24hr
│ ${PREFIX}msgpin 7d
│ ${PREFIX}msgpin 30d
╰──────────────────`)
        }

        let duration = 0
        let display = ""

        if (timeInput === "24hr") {
            duration = 86400
            display = "24 hours"
        }

        if (timeInput === "7d") {
            duration = 604800
            display = "7 days"
        }

        if (timeInput === "30d") {
            duration = 2592000
            display = "30 days"
        }

        try {

            const messageKey = m.quoted.key
            const pinId = `${m.chat}-${messageKey.id}`

            await sock.sendMessage(m.chat, {
                react: { text: "📌", key: m.key }
            })

            await sock.sendMessage(m.chat, {
                pin: messageKey,
                type: 1,
                time: duration
            })

            activePins.set(pinId,{
                key: messageKey,
                chat: m.chat,
                expires: Date.now() + duration * 1000
            })

            reply(
`╭─❍ *CRYSNOVA AI V2.0*
│ ✓ Message pinned
│
│ Duration: ${display}
╰──────────────────`
            )

            setTimeout(async () => {

                try {

                    await sock.sendMessage(m.chat,{
                        pin: messageKey,
                        type: 1,
                        time: 0
                    })

                    activePins.delete(pinId)

                    await sock.sendMessage(m.chat,{
                        react:{ text:"⏰", key:m.key }
                    })

                } catch {}

            }, duration * 1000)

        } catch (err) {

            await sock.sendMessage(m.chat,{
                react:{ text:"⭕", key:m.key }
            })

            reply(
`╭─❍ *CRYSNOVA AI V2.0*
│ ✘ Failed to pin message
│
│ ${err.message}
╰──────────────────`)
        }
    }
}
