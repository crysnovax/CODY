module.exports = {
    name: 'promote',
    alias: ['admin'],
    desc: 'Promote user(s) to admin',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    botAdmin: false,
    reactions: { start: '♾️', success: '🎉' },

    execute: async (sock, m, { args, reply , prefix}) => {

        const meta     = await sock.groupMetadata(m.chat).catch(() => null)
        if (!meta) return reply('✘ Could not fetch group info')

        const participants = meta.participants
        const admins       = participants.filter(p => p.admin).map(p => p.id.replace(/:\d+@/, '@'))
        const botJid       = (sock.user?.id || '').replace(/:\d+@/, '@')

        // ── @all — promote everyone who is NOT already admin ──
        if (args[0]?.toLowerCase() === 'all') {
            const targets = participants
                .map(p => p.id)
                .filter(id => {
                    const norm = id.replace(/:\d+@/, '@')
                    return !admins.includes(norm) && norm !== botJid
                })

            if (!targets.length) return reply('✘ Everyone is already admin')

            await reply(`${prefix}⚉ Promoting ${targetslength} members...`)

            let success = 0
            for (const jid of targets) {
                try {
                    await sock.groupParticipantsUpdate(m.chat, [jid], 'promote')
                    await new Promise(r => setTimeout(r, 500))
                    success++
                } catch {}
            }

            const mentions = targets
            await sock.sendMessage(m.chat, {
                text: `✪ Promoted *${success}/${targets.length}* members to admin\n` +
                      mentions.map(j => `@${j.split('@')[0]}`).join(' '),
                mentions
            })
            return
        }

        // ── Build target list ─────────────────────────────────
        let targets = []

        // Reply to a message
        if (m.quoted?.sender) {
            targets.push(m.quoted.sender)
        }

        // @mentions
        if (m.mentionedJid?.length) {
            for (const jid of m.mentionedJid) {
                if (!targets.includes(jid)) targets.push(jid)
            }
        }

        // Phone numbers from args
        for (const arg of args) {
            const num = arg.replace(/[^0-9]/g, '')
            if (num.length >= 7) {
                const jid = num + '@s.whatsapp.net'
                if (!targets.includes(jid)) targets.push(jid)
            }
        }

        if (!targets.length) {
            return reply(
                `𓄄 *How to use .promote:*\n\n` +
                `• Reply to a message → promotes that person\n` +
                `• .promote @user\n` +
                `• .promote 2348012345678\n` +
                `• .promote all → promotes everyone`
            )
        }

        // ── Promote each target ───────────────────────────────
        let success = 0
        const promoted = []
        const failed   = []

        for (const jid of targets) {
            const norm = jid.replace(/:\d+@/, '@')
            if (admins.includes(norm)) {
                failed.push(`@${jid.split('@')[0]} (already admin)`)
                continue
            }
            try {
                await sock.groupParticipantsUpdate(m.chat, [jid], 'promote')
                await new Promise(r => setTimeout(r, 600))
                promoted.push(jid)
                success++
            } catch (err) {
                failed.push(`@${jid.split('@')[0]} (${err.message || 'failed'})`)
            }
        }

        if (promoted.length) {
            await sock.sendMessage(m.chat, {
                text: `✪ *Promoted to admin:*\n` +
                      promoted.map(j => `✦ @${j.split('@')[0]}`).join('\n') +
                      (failed.length ? `\n\n✘ *Failed:*\n${failed.join('\n')}` : ''),
                mentions: promoted
            })
        } else {
            reply(`${prefix}✘ Could not promote:\n${failedjoin('\n')}`)
        }
    }
}
