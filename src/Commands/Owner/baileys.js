// ── BAILEYS SOCKET METHODS AS COMMANDS ──────────────────────────────────────
module.exports = [

    // ── GET USER STATUS ──────────────────────────────────────────────────────
    {
        name: 'getstatus',
        alias: ['userstatus', 'statuscheck'],
        desc: 'Get a user\'s WhatsApp About/status text',
        category: 'Owner',
        ownerOnly: true,
        usage: `${prefix}getstatus <@user or phone>`,
        reactions: { start: '👁️', success: '✓', error: '❌' },

        execute: async (sock, m, { args, reply, prefix }) => {
            let target;
            if (m.mentionedJid?.[0]) {
                target = m.mentionedJid[0];
            } else if (m.quoted?.sender) {
                target = m.quoted.sender;
            } else if (args[0]) {
                target = args[0].replace(/[^\d]/g, '') + '@s.whatsapp.net';
            }

            if (!target) {
                return reply(`${prefix}⊘ *Usage:* getstatus <@user or phone>`);
            }

            try {
                if (typeof sock.fetchStatus !== 'function') {
                    throw new Error('This Plogme version does not provide fetchStatus()');
                }
                const statusList = await sock.fetchStatus(target);
                const targetNumber = target.split('@')[0];
                const statusEntry = (Array.isArray(statusList) ? statusList : [])
                    .find(item => item?.id === target || item?.jid === target
                        || String(item?.id || item?.jid || '').split('@')[0] === targetNumber)
                    || (Array.isArray(statusList) ? statusList[0] : undefined);
                const statusValue = statusEntry?.status;
                const statusText = typeof statusValue === 'string'
                    ? statusValue
                    : typeof statusValue?.status === 'string'
                        ? statusValue.status
                        : typeof statusEntry?.text === 'string'
                            ? statusEntry.text
                            : '';
                return reply(
                    `👁️ *Status for* @${target.split('@')[0]}\n\n` +
                    `${statusText || 'No status set or unavailable'}`
                );
            } catch (err) {
                return reply(`${prefix}⊘ Error: ${err.message}`);
            }
        }
    },

    // ── SET GROUP ICON (HD Flag) ─────────────────────────────────────────────
    {
        name: 'setgroupicon',
        alias: ['setgrouppp', 'setgppicon', 'groupicon', 'setgpphd'],
        desc: 'Set group profile picture with HD full-size upload',
        category: 'Owner',
        owner: true,
        usage: `${prefix}setgroupicon (reply to image)`,
        reactions: { start: '🖼️', success: '✓', error: '❌' },

        execute: async (sock, m, { reply, prefix }) => {
            if (!m.isGroup) {
                return reply(`${prefix}⊘ *Usage:* Only works in groups`);
            }

            if (!m.quoted?.mimetype?.startsWith('image/')) {
                return reply(`${prefix}⊘ *Usage:* Reply to an image`);
            }

            try {
                const image = await m.quoted.download();
                // Use HD full-size upload flag
                await sock.updateGroupPicture(m.chat, image, { quality: 'full' });
                return reply(`✓ *Group icon updated (HD)*`);
            } catch (err) {
                return reply(`${prefix}⊘ Error: ${err.message}`);
            }
        }
    },

    // ── JOIN GROUP ───────────────────────────────────────────────────────────
    {
        name: 'joingroup',
        alias: ['join', 'joingc', 'inviteaccept', 'acceptinvite'],
        desc: 'Join a group using invite code',
        category: 'Owner',
        owner: true,
        usage: 'joingroup <invite_code>',
        reactions: { start: '🔗', success: '✓', error: '❌' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const code = args[0];

            if (!code) {
                return reply(`${prefix}⊘ *Usage:* joingroup <invite_code>`);
            }

            try {
                const result = await sock.groupAcceptInviteCode(code);
                return reply(`✓ *Joined group:* ${result}`);
            } catch (err) {
                return reply(`${prefix}⊘ Error: ${err.message}`);
            }
        }
    },

    // ── EDIT MESSAGE ─────────────────────────────────────────────────────────
    {
        name: 'editmsg',
        alias: ['edit', 'editmessage', 'msgupdate'],
        desc: 'Edit a previously sent message',
        category: 'Owner',
        owner: true,
        usage: 'editmsg <new_text> (reply to message)',
        reactions: { start: '✏️', success: '✓', error: '❌' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const newText = args.join(' ');

            if (!newText) {
                return reply(`${prefix}⊘ *Usage:* editmsg <new_text>`);
            }

            if (!m.quoted?.key) {
                return reply(`${prefix}⊘ *Usage:* Reply to a message to edit it`);
            }

            try {
                await sock.editMessage(m.chat, m.quoted.key, { text: newText });
                return reply(`✓ *Message edited*`);
            } catch (err) {
                return reply(`${prefix}⊘ Error: ${err.message}`);
            }
        }
    },

    // ── CHECK WHATSAPP VERSION ───────────────────────────────────────────────
    {
        name: 'waversion',
        alias: ['version', 'waver', 'botversion', 'checkversion'],
        desc: 'Check WhatsApp and bot version info',
        category: 'Owner',
        owner: true,
        usage: `${prefix}waversion`,
        reactions: { start: '📱', success: '✓', error: '❌' },

        execute: async (sock, m, { reply, prefix }) => {
            try {
                const wa = await sock.getWAVersionInfo?.();
                const info = {
                    version: wa?.version || 'Unknown',
                    connected: sock.state?.connection || 'Unknown',
                    platform: wa?.platform || 'WhatsApp',
                };

                return reply(
                    `📱 *Version Information*\n\n` +
                    `Platform: ${info.platform}\n` +
                    `WhatsApp: ${info.version}\n` +
                    `Bot Status: ${info.connected}`
                );
            } catch (err) {
                return reply(`${prefix}⊘ Error: ${err.message}`);
            }
        }
    },

    // ── CREATE NEWSLETTER ────────────────────────────────────────────────────
    {
        name: 'createnewsletter',
        alias: ['mkchannels', 'createchannel', 'newabc'],
        desc: 'Create a new newsletter/channel',
        category: 'Owner',
        owner: true,
        usage: 'createnewsletter <channel_name>',
        reactions: { start: '📰', success: '✓', error: '❌' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const name = args.join(' ');

            if (!name) {
                return reply(`${prefix}⊘ *Usage:* createnewsletter <name>`);
            }

            try {
                const channel = await sock.newsletterCreate(name);
                return reply(
                    `✓ *Newsletter created*\n\n` +
                    `ID: ${channel.id}\n` +
                    `Name: ${name}`
                );
            } catch (err) {
                return reply(`${prefix}⊘ Error: ${err.message}`);
            }
        }
    },

    // ── LEAVE NEWSLETTER ────────────────────────────────────────────────────
    {
        name: 'leavesubscription',
        alias: ['leavenewsletter', 'leavechannel', 'unsubnews'],
        desc: 'Leave a newsletter/channel subscription',
        category: 'Owner',
        owner: true,
        usage: `${prefix}leavesubscription (reply in newsletter)`,
        reactions: { start: '🚪', success: '✓', error: '❌' },

        execute: async (sock, m, { reply, prefix }) => {
            if (!m.chat.endsWith('@newsletter')) {
                return reply(`${prefix}⊘ *Usage:* Use this command in a newsletter`);
            }

            try {
                await sock.newsletterLeave(m.chat);
                return reply(`✓ *Left the newsletter*`);
            } catch (err) {
                return reply(`${prefix}⊘ Error: ${err.message}`);
            }
        }
    },

    // ── UPDATE NEWSLETTER SETTINGS ───────────────────────────────────────────
    {
        name: 'updatechannel',
        alias: ['updatenewsletter', 'editchannel', 'channelsettings'],
        desc: 'Update newsletter/channel settings',
        category: 'Owner',
        owner: true,
        usage: `${prefix}updatechannel <setting> <value>`,
        reactions: { start: '⚙️', success: '✓', error: '❌' },

        execute: async (sock, m, { args, reply, prefix }) => {
            if (!m.chat.endsWith('@newsletter')) {
                return reply(`${prefix}⊘ *Usage:* Use this command in a newsletter`);
            }

            const setting = args[0]?.toLowerCase();
            const value = args.slice(1).join(' ');

            if (!setting || !value) {
                return reply(
                    `${prefix}⊘ *Usage:* updatechannel <setting> <value>\n\n` +
                    `Settings:\n` +
                    `• name - Change channel name\n` +
                    `• description - Update description`
                );
            }

            try {
                const updates = {};
                if (setting === 'name') updates.name = value;
                if (setting === 'description') updates.description = value;

                await sock.newsletterUpdateSettings(m.chat, updates);
                return reply(`✓ *${setting} updated*`);
            } catch (err) {
                return reply(`${prefix}⊘ Error: ${err.message}`);
            }
        }
    }

];
