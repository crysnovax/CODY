const { prepareWAMessageMedia, generateMessageIDV2 } = require('@crysnovax/baileys')

module.exports = {
    name: 'invite',
    alias: ['grouplink', 'glink'],
    category: 'Group',
    admin: true,
    group: true,

    execute: async (sock, m, { reply , prefix}) => {
        try {
            if (!m.isGroup) return reply('`⟁⃝GROUP ONLY!℘`')

            const meta = await sock.groupMetadata(m.chat)
            const groupName = meta.subject

            // ── Get invite code ───────────────────────
            let inviteCode
            try {
                inviteCode = await sock.groupInviteCode(m.chat)
            } catch (err) {
                return reply('`—͟͟͞͞𖣘 I need admin rights to generate the group link`')
            }

            const inviteLink = `https://chat.whatsapp.com/${inviteCode}?mode=gi_t`

            // ── Get group photo URL ───────────────────
            let photoUrl = null
            try {
                photoUrl = await sock.profilePictureUrl(m.chat, 'image')
            } catch {}

            // ── Upload via mediaTypeOverride:'thumbnail-link' ──
            // Pass URL directly — Baileys' own HTTP layer fetches it
            // with proper headers, avoiding quality degradation from
            // manual fetch(). jpegThumbnail comes from the upload result
            // itself — no manual extractImageThumb needed.
            let hq = null
            let smallThumb = null
            if (photoUrl) {
                try {
                    const prepared = await prepareWAMessageMedia(
                        { image: { url: photoUrl } },
                        { upload: sock.waUploadToServer, mediaTypeOverride: 'thumbnail-link' }
                    )
                    hq = prepared.imageMessage
                    smallThumb = hq?.jpegThumbnail ? Buffer.from(hq.jpegThumbnail) : null
                } catch (err) {
                    console.error('HQ THUMB UPLOAD ERROR:', err)
                }
            }

            // ── Build proto and relay directly ────────
            const message = {
                extendedTextMessage: {
                    text: inviteLink,
                    matchedText: inviteLink,
                    canonicalUrl: inviteLink,
                    title: groupName,
                    description: `${meta.participants.length} members · WhatsApp Group Invite`,
                    previewType: 5, // IMAGE
                    jpegThumbnail: smallThumb || undefined,
                    ...(hq
                        ? {
                            thumbnailDirectPath: hq.directPath,
                            mediaKey: hq.mediaKey,
                            mediaKeyTimestamp: hq.mediaKeyTimestamp,
                            thumbnailWidth: hq.width,
                            thumbnailHeight: hq.height,
                            thumbnailSha256: hq.fileSha256,
                            thumbnailEncSha256: hq.fileEncSha256
                        }
                        : {})
                }
            }

            const messageId = generateMessageIDV2(sock.user.id)
            await sock.relayMessage(m.chat, message, { messageId })

        } catch (e) {
            console.error('GLINK ERROR:', e)
            reply(`${prefix}𓆉 Error: ${emessage}`)
        }
    }
}
