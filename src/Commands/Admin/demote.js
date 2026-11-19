const { normalizeJid, resolvePhoneJidWithMetadata } = require('../../Plugin/identityUtils');

module.exports = {
    name: 'demote',
    alias: ['unadmin'],
    desc: 'Demote user(s) from admin',
    category: 'Admin',
    groupOnly: true,
    adminOnly: true,
    botAdmin: false,
    reactions: { start: '♾️', success: '😤' },

    execute: async (sock, m, { args, reply }) => {

        const meta     = await sock.groupMetadata(m.chat).catch(() => null)
        if (!meta) return reply('✘ Could not fetch group info')

        const participants = meta.participants || []
        const participantJid = async participant =>
            await resolvePhoneJidWithMetadata(
                sock,
                m.chat,
                [participant?.phoneNumber, participant?.id, participant?.jid, participant?.lid],
                meta
            ) || normalizeJid(participant?.id || participant?.jid || participant?.lid || '')
        const admins       = (await Promise.all(participants.filter(p => p.admin).map(participantJid))).filter(Boolean)
        const botJid       = (sock.user?.id || '').replace(/:\d+@/, '@')

        // ── @all — demote everyone who IS admin except bot ────
        if (args[0]?.toLowerCase() === 'all') {
            const targets = (await Promise.all(participants.map(participantJid)))
                .filter(jid => {
                    const norm = normalizeJid(jid)
                    return admins.includes(norm) && norm !== botJid
                })

            if (!targets.length) return reply('✘ No admins to demote')

            await reply(`⚉ Demoting ${targets.length} admins...`)

            let success = 0
            for (const jid of targets) {
                try {
                    await sock.groupParticipantsUpdate(m.chat, [jid], 'demote')
                    await new Promise(r => setTimeout(r, 500))
                    success++
                } catch {}
            }

            const mentions = targets
            await sock.sendMessage(m.chat, {
                text: `✘ Demoted *${success}/${targets.length}* admins\n` +
                      mentions.map(j => `@${j.split('@')[0]}`).join(' '),
                mentions
            })
            return
        }

        // ── Build target list ─────────────────────────────────
        let targets = []

        // Reply to a message
        if (m.quoted?.sender) {
            const resolved = await resolvePhoneJidWithMetadata(sock, m.chat, [m.quoted.sender], meta)
            if (resolved) targets.push(resolved)
        }

        // @mentions
        if (m.mentionedJid?.length) {
            // The singular @user form can arrive with both PN and LID
            // identities for the same person. Only use the first mention;
            // otherwise the action and confirmation run twice.
            const resolved = await resolvePhoneJidWithMetadata(sock, m.chat, [m.mentionedJid[0]], meta)
            if (resolved && !targets.includes(resolved)) targets.push(resolved)
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
                `𓄄 *How to use .demote:*\n\n` +
                `• Reply to a message → demotes that person\n` +
                `• .demote @user\n` +
                `• .demote 2348012345678\n` +
                `• .demote all → demotes all admins`
            )
        }

        // ── Demote each target ────────────────────────────────
        let success = 0
        const demoted = []
        const failed  = []

        for (const jid of targets) {
            const norm = normalizeJid(jid)
            if (!admins.includes(norm)) {
                failed.push(`@${jid.split('@')[0]} (not an admin)`)
                continue
            }
            if (norm === botJid) {
                failed.push(`@${jid.split('@')[0]} (cannot demote myself)`)
                continue
            }
            try {
                await sock.groupParticipantsUpdate(m.chat, [jid], 'demote')
                await new Promise(r => setTimeout(r, 600))
                demoted.push(jid)
                success++
            } catch (err) {
                failed.push(`@${jid.split('@')[0]} (${err.message || 'failed'})`)
            }
        }

        if (demoted.length) {
            await sock.sendMessage(m.chat, {
                text: `✘ *Demoted from admin:*\n` +
                      demoted.map(j => `✦ @${j.split('@')[0]}`).join('\n') +
                      (failed.length ? `\n\n✘ *Failed:*\n${failed.join('\n')}` : ''),
                mentions: demoted
            })
        } else {
            reply(`✘ Could not demote:\n${failed.join('\n')}`)
        }
    }
            }
            
