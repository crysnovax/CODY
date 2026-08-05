module.exports = {
    name: 'resend',
    alias: ['repost'],
    desc: 'Repost a replied message',
    category: 'Tools',

    execute: async (sock, m, { reply, args , prefix}) => {

        if (!m.quoted) {
            return reply('⊘ Reply to a message first.');
        }

        if (!args[0]) {
            return reply(
                '⊘ Provide target chat!\n\n' +
                'Examples:\n' +
                '• .resend 2348xxxx@s.whatsapp.net\n' +
                '• .resend https://chat.whatsapp.com/xxxxx\n' +
                '• .resend https://wa.me/2348xxxx'
            );
        }

        let target = args[0];

        try {
            // GROUP INVITE
            if (target.includes('chat.whatsapp.com')) {
                const code = target.split('chat.whatsapp.com/')[1].split('?')[0];
                const info = await sock.groupGetInviteInfo(code);
                target = info.id;
                if (!target) return reply('⊘ Could not resolve group JID.');
            }
            // WA.ME
            else if (target.includes('wa.me/')) {
                const num = target.split('wa.me/')[1].split('?')[0];
                target = `${num}@s.whatsapp.net`;
            }
            // RAW NUMBER
            else if (!target.includes('@')) {
                target = `${target}@s.whatsapp.net`;
            }
        } catch (e) {
            return reply('⊘ Invalid link or expired invite.');
        }

        const q = m.quoted;
        const mtype = q.mtype || '';

        const text = q.text || q.caption || q.body || q.conversation || '';

        // ── Download media if needed ────────────────────────────
        let media = null;
        const hasMedia = /image|video|audio|sticker|document/.test(mtype);

        if (hasMedia) {
            try {
                media = await sock.downloadMediaMessage(q);
            } catch (e) {
                return reply('⊘ Failed to download media.');
            }

            if (!media || !media.length) {
                return reply('⊘ Media download returned empty buffer.');
            }
        }

        // ── Send ────────────────────────────────────────────────
        try {
            if (mtype === 'imageMessage') {
                await sock.sendMessage(target, {
                    image: media,
                    caption: q.caption || ''
                });
            //    return reply('🔁 Reposted image');
            }

            if (mtype === 'videoMessage') {
                await sock.sendMessage(target, {
                    video: media,
                    caption: q.caption || ''
                });
            //    return reply('🔁 Reposted video');
            }

            if (mtype === 'audioMessage') {
                await sock.sendMessage(target, {
                    audio: media,
                    ptt: q.ptt || false
                });
        //        return reply('🔁 Reposted audio');
            }

            if (mtype === 'stickerMessage') {
                // Auto-upgrade stickers to premium 💎
                await sock.sendMessage(target, {
                    sticker: media,
                    premium: 1
                });
     //           return reply('🔁 Reposted sticker 💎');
            }

            if (mtype === 'documentMessage') {
                await sock.sendMessage(target, {
                    document: media,
                    mimetype: q.mimetype || 'application/octet-stream',
                    fileName: q.fileName || 'repost-file'
                });
              //  return reply('🔁 Reposted document');
            }

            // TEXT ONLY
            if (text) {
                await sock.sendMessage(target, { text });
              //  return reply('🔁 Reposted text');
            }

          //  return reply('⊘ Unsupported message type.');

        } catch (e) {
            console.error('REPOST ERROR:', e);
            return reply(`${prefix}⊘ Failed to repost: ${emessage}`);
        }
    }
};
