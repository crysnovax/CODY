const fetch = require('node-fetch');

module.exports = {
    name: 'add',
    alias: ['adduser'],
    desc: 'Add user(s) to the group',
    category: 'Admin',
    // Enforced by the command dispatcher (crysMsg.js):
    groupOnly: true,
    adminOnly: true,
    botAdmin: false,
    reactions: { start: '♾️', success: '🎉' },

    execute: async (sock, m, { args, reply , prefix}) => {
        try {
            if (!m.isGroup) return reply('`⟁⃝GROUP ONLY!℘`');

            // ── Build target list (identical parsing to promote/demote) ──
            let targets = [];

            // Reply to a message
            if (m.quoted?.sender) {
                targets.push(m.quoted.sender);
            }

            // @mentions
            if (m.mentionedJid?.length) {
                for (const jid of m.mentionedJid) {
                    if (!targets.includes(jid)) targets.push(jid);
                }
            }

            // Phone numbers from args (only when no mention/reply target)
            if (!targets.length) {
                for (const arg of args) {
                    let number = arg.replace(/[^0-9]/g, '');
                    if (!number) continue;
                    if (number.startsWith('0')) number = '234' + number.slice(1);
                    if (number.length < 7) continue;
                    const jid = number + '@s.whatsapp.net';
                    if (!targets.includes(jid)) targets.push(jid);
                }
            }

            if (!targets.length) {
                return reply(
                    `𓄄 *How to use .add:*\n\n` +
                    `• Reply to a message → adds that person\n` +
                    `• .add @user\n` +
                    `• .add 2348012345678`
                );
            }

            const meta = await sock.groupMetadata(m.chat);
            const groupName = meta.subject;

            const added   = [];
            const invited = [];
            const failed  = [];

            for (const jid of targets) {
                try {
                    const res = await sock.groupParticipantsUpdate(m.chat, [jid], 'add');
                    const status = String(res?.[0]?.status ?? '');

                    if (status === '200') {
                        added.push(jid);
                        continue;
                    }

                    // Privacy block → send invite link in DM
                    if (['403', '401', '409'].includes(status)) {
                        const freshCode  = await sock.groupInviteCode(m.chat);
                        const inviteLink = `https://chat.whatsapp.com/${freshCode}?mode=gi_t`;

                        let thumbnail = null;
                        try {
                            const pp = await sock.profilePictureUrl(m.chat, 'image');
                            thumbnail = await fetch(pp).then(r => r.buffer());
                        } catch {}

                        await sock.sendMessage(jid, {
                            extendedTextMessage: {
                                text: inviteLink,
                                matchedText: inviteLink,
                                canonicalUrl: inviteLink,
                                title: groupName,
                                description: 'WhatsApp Group Invite',
                                previewType: 1,
                                jpegThumbnail: thumbnail
                            },
                            raw: true
                        });

                        invited.push(jid);
                        continue;
                    }

                    failed.push(jid);
                } catch {
                    failed.push(jid);
                }

                await new Promise(r => setTimeout(r, 600));
            }

            // ── Report — mentions render as exactly @user ──
            const mentions = [...added, ...invited, ...failed];
            let text = '';

            if (added.length) {
                text += `_*⟁⃝ Added to the group:*_\n` +
                        added.map(j => `✦ @${j.split('@')[0]}`).join('\n') + '\n\n';
            }
            if (invited.length) {
                text += `_*📩 Invite sent (privacy on):*_\n` +
                        invited.map(j => `✦ @${j.split('@')[0]}`).join('\n') + '\n\n';
            }
            if (failed.length) {
                text += `_*✘ Failed:*_\n` +
                        failed.map(j => `✦ @${j.split('@')[0]}`).join('\n');
            }

            await sock.sendMessage(m.chat, {
                text: text.trim(),
                mentions
            }, { quoted: m });

        } catch (e) {
            console.error('ADD ERROR:', e);
            reply(`${prefix}𓆉 Error: ${emessage}`);
        }
    }
};
