// ── ALL PROFILE & PRIVACY COMMANDS ──────────────────────────────────────
const { createContactCards } = require('../../Plugin/contactCards');

module.exports = [

    // ── UPDATE LAST SEEN PRIVACY ─────────────────────────────────────────
    {
        name: 'lastseen',
        alias: ['setlastseen', 'lastseenprivacy'],
        desc: 'Update who can see your last seen',
        category: 'Privacy',
        owner: true,
        usage: '.lastseen <all/contacts/contact_blacklist/none>',
        reactions: { start: '👁️', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const setting = args[0]?.toLowerCase();
            const valid = ['all', 'contacts', 'contact_blacklist', 'none'];

            if (!setting || !valid.includes(setting)) {
                return reply(`⊘ *Usage:* lastseen all/contacts/contact_blacklist/none`);
            }

            await sock.sendMessage(m.chat, { react: { text: '👁️', key: m.key } });

            try {
                await sock.updateLastSeenPrivacy(setting);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Last seen set to:* ${setting}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── UPDATE ONLINE PRIVACY ────────────────────────────────────────────
    {
        name: 'setonline',
        alias: ['onlineprivacy', 'ponline'],
        desc: 'Update who can see when you\'re online',
        category: 'Privacy',
        owner: true,
        usage: '.setonline <all/match_last_seen>',
        reactions: { start: '🟢', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const setting = args[0]?.toLowerCase();
            const valid = ['all', 'match_last_seen'];

            if (!setting || !valid.includes(setting)) {
                return reply(`⊘ *Usage:* setonline all/match_last_seen`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🟢', key: m.key } });

            try {
                await sock.updateOnlinePrivacy(setting);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Online privacy set to:* ${setting}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── UPDATE PROFILE PICTURE PRIVACY ───────────────────────────────────
    {
        name: 'pfpprivacy',
        alias: ['setpfpprivacy', 'profilepicprivacy'],
        desc: 'Update who can see your profile picture',
        category: 'Privacy',
        owner: true,
        usage: '.pfpprivacy <all/contacts/contact_blacklist/none>',
        reactions: { start: '🖼️', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const setting = args[0]?.toLowerCase();
            const valid = ['all', 'contacts', 'contact_blacklist', 'none'];

            if (!setting || !valid.includes(setting)) {
                return reply(`⊘ *Usage:* pfpprivacy all/contacts/contact_blacklist/none`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🖼️', key: m.key } });

            try {
                await sock.updateProfilePicturePrivacy(setting);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Profile picture privacy set to:* ${setting}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── UPDATE STATUS PRIVACY ────────────────────────────────────────────
    {
        name: 'statusprivacy',
        alias: ['setstatusprivacy', 'whocansee'],
        desc: 'Update who can see your status updates',
        category: 'Privacy',
        owner: true,
        usage: '.statusprivacy <all/contacts/contact_blacklist/none>',
        reactions: { start: '📱', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const setting = args[0]?.toLowerCase();
            const valid = ['all', 'contacts', 'contact_blacklist', 'none'];

            if (!setting || !valid.includes(setting)) {
                return reply(`⊘ *Usage:* statusprivacy all/contacts/contact_blacklist/none`);
            }

            await sock.sendMessage(m.chat, { react: { text: '📱', key: m.key } });

            try {
                await sock.updateStatusPrivacy(setting);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Status privacy set to:* ${setting}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── UPDATE GROUPS ADD PRIVACY ────────────────────────────────────────
    {
        name: 'groupprivacy',
        alias: ['setgroupprivacy', 'whocanadd', 'groupadd'],
        desc: 'Update who can add you to groups',
        category: 'Privacy',
        owner: true,
        usage: '.groupprivacy <all/contacts/contact_blacklist/none>',
        reactions: { start: '👥', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const setting = args[0]?.toLowerCase();
            const valid = ['all', 'contacts', 'contact_blacklist', 'none'];

            if (!setting || !valid.includes(setting)) {
                return reply(`⊘ *Usage:* groupprivacy all/contacts/contact_blacklist/none`);
            }

            await sock.sendMessage(m.chat, { react: { text: '👥', key: m.key } });

            try {
                await sock.updateGroupsAddPrivacy(setting);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Groups add privacy set to:* ${setting}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── UPDATE READ RECEIPTS ─────────────────────────────────────────────
    {
        name: 'readreceipts',
        alias: ['setreadreceipts', 'readprivacy', 'bluetick'],
        desc: 'Update read receipts (blue ticks) privacy',
        category: 'Privacy',
        owner: true,
        usage: '.readreceipts <all/none>',
        reactions: { start: '💙', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const setting = args[0]?.toLowerCase();
            const valid = ['all', 'none'];

            if (!setting || !valid.includes(setting)) {
                return reply(`⊘ *Usage:* readreceipts all/none`);
            }

            await sock.sendMessage(m.chat, { react: { text: '💙', key: m.key } });

            try {
                await sock.updateReadReceiptsPrivacy(setting);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Read receipts set to:* ${setting}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── UPDATE CALL PRIVACY ──────────────────────────────────────────────
    // WA only accepts: all | known
    {
        name: 'callsprivacy',
        alias: ['setcallsprivacy', 'whocancall'],
        desc: 'Update who can call you',
        category: 'Privacy',
        owner: true,
        usage: '.callsprivacy <all/known>',
        reactions: { start: '📞', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const setting = args[0]?.toLowerCase();
            const valid = ['all', 'known'];

            if (!setting || !valid.includes(setting)) {
                return reply(`⊘ *Usage:* callsprivacy all/known\n\n• all - Everyone\n• known - Contacts only`);
            }

            await sock.sendMessage(m.chat, { react: { text: '📞', key: m.key } });

            try {
                await sock.updateCallPrivacy(setting);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Call privacy set to:* ${setting}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── UPDATE MESSAGES PRIVACY ──────────────────────────────────────────
    {
        name: 'messagesprivacy',
        alias: ['setmsgprivacy', 'msgprivacy'],
        desc: 'Update who can send you messages',
        category: 'Privacy',
        owner: true,
        usage: '.messagesprivacy <all/contacts/contact_blacklist/none>',
        reactions: { start: '💬', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const setting = args[0]?.toLowerCase();
            const valid = ['all', 'contacts', 'contact_blacklist', 'none'];

            if (!setting || !valid.includes(setting)) {
                return reply(`⊘ *Usage:* messagesprivacy all/contacts/contact_blacklist/none`);
            }

            await sock.sendMessage(m.chat, { react: { text: '💬', key: m.key } });

            try {
                await sock.updateMessagesPrivacy(setting);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Messages privacy set to:* ${setting}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── DISABLE LINK PREVIEWS ────────────────────────────────────────────
    {
        name: 'linkpreview',
        alias: ['setlinkpreview', 'togglelinkpreview'],
        desc: 'Enable or disable link previews',
        category: 'Privacy',
        owner: true,
        usage: '.linkpreview <on/off>',
        reactions: { start: '🔗', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const setting = args[0]?.toLowerCase();
            if (!setting || !['on', 'off'].includes(setting)) {
                return reply(`⊘ *Usage:* linkpreview on/off`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🔗', key: m.key } });

            try {
                // true = previews disabled
                await sock.updateDisableLinkPreviewsPrivacy(setting === 'off');
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Link previews:* ${setting.toUpperCase()}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── UPDATE DEFAULT DISAPPEARING MODE ─────────────────────────────────
    {
        name: 'disappearing',
        alias: ['setdisappearing', 'defaulttimer'],
        desc: 'Set default disappearing message timer for new chats',
        category: 'Privacy',
        owner: true,
        usage: `${prefix}disappearing <seconds>`,
        reactions: { start: '⏳', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const seconds = parseInt(args[0]);

            if (isNaN(seconds) || seconds < 0) {
                return reply(`⊘ *Usage:* disappearing <seconds>\n\n• 0 - Off\n• 86400 - 24 hours\n• 604800 - 7 days\n• 2592000 - 30 days`);
            }

            await sock.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

            try {
                await sock.updateDefaultDisappearingMode(seconds);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });

                const displayTime = seconds === 0 ? 'OFF'
                    : seconds === 86400 ? '24 hours'
                    : seconds === 604800 ? '7 days'
                    : seconds === 2592000 ? '30 days'
                    : `${seconds} seconds`;

                return reply(`✓ *Default disappearing set to:* ${displayTime}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── VIEW ALL PRIVACY SETTINGS ────────────────────────────────────────
    // Keys from fetchPrivacySettings: last, online, profile, status, groupadd, calladd, readreceipts, messages
    {
        name: 'myprivacy',
        alias: ['privacysettings', 'viewprivacy'],
        desc: 'View all your current privacy settings',
        category: 'Privacy',
        owner: true,
        usage: `${prefix}myprivacy`,
        reactions: { start: '🔒', success: '🍃', error: '🥵' },

        execute: async (sock, m, { reply, prefix }) => {
            await sock.sendMessage(m.chat, { react: { text: '🔒', key: m.key } });

            try {
                const s = await sock.fetchPrivacySettings(true);

                if (!s) return reply('⊘ Could not fetch privacy settings');

                await sock.sendMessage(m.chat, {
                    title: '🔒 Privacy Settings',
                    table: [
                        ['👁️ Last Seen',      s.last          || 'N/A'],
                        ['🟢 Online',          s.online        || 'N/A'],
                        ['🖼️ Profile Pic',     s.profile       || 'N/A'],
                        ['📱 Status',          s.status        || 'N/A'],
                        ['👥 Groups Add',      s.groupadd      || 'N/A'],
                        ['📞 Calls',           s.calladd       || 'N/A'],
                        ['💬 Messages',        s.messages      || 'N/A'],
                        ['💙 Read Receipts',   s.readreceipts  || 'N/A'],
                    ]
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── BLOCK USER ───────────────────────────────────────────────────────
    {
        name: 'block',
        alias: ['blockuser'],
        desc: 'Block a user',
        category: 'Moderation',
        owner: true,
        usage: '.block (reply) | .block @user | .block <number>',
        reactions: { start: '🚫', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            let targetJid = null;

            if (m.quoted) {
                targetJid = m.quoted.sender || m.quoted.participant || m.quoted.key?.participant;
            } else if (m.mentionedJid?.length) {
                targetJid = m.mentionedJid[0];
            } else if (args[0]) {
                const n = args[0].replace(/[^0-9]/g, '');
                targetJid = `${n}@s.whatsapp.net`;
            }

            if (!targetJid) return reply('⊘ Reply to a message, mention, or provide a number.');

            await sock.sendMessage(m.chat, { react: { text: '🚫', key: m.key } });

            try {
                await sock.updateBlockStatus(targetJid, 'block');
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply('`⌬ Blocked`');
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── UNBLOCK USER ─────────────────────────────────────────────────────
    {
        name: 'unblock',
        alias: ['unblockuser'],
        desc: 'Unblock a user',
        category: 'Moderation',
        owner: true,
        usage: '.unblock (reply) | .unblock @user | .unblock <number>',
        reactions: { start: '🔓', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            let targetJid = null;

            if (m.quoted) {
                targetJid = m.quoted.sender || m.quoted.participant || m.quoted.key?.participant;
            } else if (m.mentionedJid?.length) {
                targetJid = m.mentionedJid[0];
            } else if (args[0]) {
                const n = args[0].replace(/[^0-9]/g, '');
                targetJid = `${n}@s.whatsapp.net`;
            }

            if (!targetJid) return reply('⊘ Reply to a message, mention, or provide a number.');

            await sock.sendMessage(m.chat, { react: { text: '🔓', key: m.key } });

            try {
                await sock.updateBlockStatus(targetJid, 'unblock');
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply('`✆ Unblocked`');
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── FETCH BLOCKLIST ──────────────────────────────────────────────────
    {
        name: 'blocklist',
        alias: ['blocked', 'blockedlist', 'myblocks'],
        desc: 'Get list of blocked users with their names',
        category: 'Moderation',
        owner: true,
        usage: `${prefix}blocklist`,
        reactions: { start: '📋', success: '🍃', error: '🥵' },

        execute: async (sock, m, { reply, prefix, store }) => {
            await sock.sendMessage(m.chat, { react: { text: '📋', key: m.key } });

            try {
                const blocked = await sock.fetchBlocklist();

                if (!blocked || blocked.length === 0) {
                    await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                    return reply(`📋 *Blocklist*\n\nNo blocked users.`);
                }

                const { payload, unresolved } = await createContactCards(sock, blocked, {
                    displayName: 'Blocked Contacts',
                    store,
                });

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                if (!payload) return reply(`⊘ Could not resolve any real phone numbers in the blocklist.`);
                await sock.sendMessage(m.chat, { contacts: payload }, { quoted: m });
                if (unresolved) {
                    return reply(`🚫 Sent ${payload.contacts.length} blocked contact(s). ${unresolved} entry/entries were skipped because their real phone number could not be resolved.`);
                }
                return;
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── VIDEO CALL LINK ──────────────────────────────────────────────────
    {
        name: 'videocall',
        alias: ['vclink', 'vcallme'],
        desc: 'Generate a WhatsApp video call link',
        category: 'Utility',
        owner: true,
        usage: `${prefix}videocall`,
        reactions: { start: '📹', success: '🏷️', error: '🥵' },

        execute: async (sock, m, { reply, prefix }) => {
            await sock.sendMessage(m.chat, { react: { text: '📹', key: m.key } });

            try {
                const token = await sock.createCallLink('video');
                if (!token) return reply('✘ Failed to generate call link.');

                const link = `https://call.whatsapp.com/video/${token}`;

                await sock.sendMessage(m.chat, {
                    text: `\`\`\`📹 VIDEO CALL LINK\`\`\`\n\n❒ - *Link* ⇆ ${link}\nⓘ - _Anyone with this link can join_`
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '🐜', key: m.key } });
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── META AI BOTS ─────────────────────────────────────────────────────
    {
        name: 'mybots',
        alias: ['metabots', 'aibots', 'botlist'],
        desc: 'List available Meta AI bots on WhatsApp',
        category: 'Utility',
        usage: `${prefix}mybots`,
        reactions: { start: '🤖', success: '🐾', error: '🥵' },

        execute: async (sock, m, { reply, prefix }) => {
            await sock.sendMessage(m.chat, { react: { text: '🤖', key: m.key } });

            try {
                const list = await sock.getBotListV2();

                if (!list || list.length === 0) return reply('✘ No Meta AI bots found.');

                const lines = list.map((b, i) =>
                    `❒ - *Bot ${i + 1}* ⇆ ${b.jid}\nⓘ - *Persona* ⇆ ${b.personaId || 'N/A'}`
                ).join('\n\n');

                await sock.sendMessage(m.chat, {
                    text: `\`\`\`🤖 META AI BOTS\`\`\`\n\n${lines}`,
                    footer: `${list.length} bot${list.length > 1 ? 's' : ''}`
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── FIND USER (PN ↔ LID) ─────────────────────────────────────────────
    {
        name: 'findthisuser',
        alias: ['resolveuser', 'whois', 'lidlookup'],
        desc: 'Resolve a phone number or LID to full user IDs',
        category: 'Utility',
        owner: true,
        usage: `${prefix}finduser <number or LID>`,
        reactions: { start: '🔍', success: '🐾', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const input = args[0]?.trim();
            if (!input) return reply('✘ Usage: *.finduser <number or LID>*');

            await sock.sendMessage(m.chat, { react: { text: '🔍', key: m.key } });

            try {
                const jid = input.includes('@') ? input
                    : `${input.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

                const result = await sock.findUserId(jid);

                await sock.sendMessage(m.chat, {
                    text: `\`\`\`🔍 USER LOOKUP\`\`\`\n\n❒ - *Phone JID* ⇆ ${result.phoneNumber || 'N/A'}\nⓘ - *LID* ⇆ ${result.lid || 'N/A'}`
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── STAR / UNSTAR MESSAGE ─────────────────────────────────────────────
    {
        name: 'star',
        alias: ['starr', 'favourite', 'bookmark', 'unstar'],
        desc: 'Star or unstar a message (reply to it)',
        category: 'Utility',
        usage: '.star | .unstar',
        reactions: { start: '⭐', success: '🍃', error: '🥵' },

        execute: async (sock, m, { reply, prefix }) => {
            const isUnstar = m.text?.toLowerCase().startsWith('/unstar') || m.text?.toLowerCase().startsWith('.unstar');

            if (!m.quoted) return reply(`✘ Reply to a message to ${isUnstar ? 'unstar' : 'star'} it.`);

            await sock.sendMessage(m.chat, { react: { text: isUnstar ? '💫' : '⭐', key: m.key } });

            try {
                await sock.star(m.chat, [{
                    id: m.quoted.key.id,
                    fromMe: m.quoted.key.fromMe
                }], !isUnstar);

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *${isUnstar ? 'Unstarred' : 'Starred'}*`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    },

    // ── ADD / EDIT / REMOVE CONTACT ──────────────────────────────────────
    {
        name: 'newcontact',
        alias: ['addcontact', 'editcontact', 'removecontact'],
        desc: 'Add, edit or remove a contact',
        category: 'Utility',
        owner: true,
        usage: '.contact add <number> <name> | .contact remove <number>',
        reactions: { start: '👤', success: '🐾', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const action = args[0]?.toLowerCase();

            if (!action || !['add', 'remove'].includes(action)) {
                return reply(`⊘ *Usage:*\n• contact add <number> <name>\n• .contact remove <number>`);
            }

            await sock.sendMessage(m.chat, { react: { text: '👤', key: m.key } });

            try {
                if (action === 'add') {
                    const number = args[1];
                    const name = args.slice(2).join(' ').trim();
                    if (!number || !name) return reply('✘ Usage: *.contact add <number> <name>*');

                    const jid = `${number.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
                    await sock.addOrEditContact(jid, { notify: name });

                    await sock.sendMessage(m.chat, { react: { text: '🏷️', key: m.key } });
                    return reply(`✓ *Contact saved:* ${name} (+${numberreplace(/[^0-9]/g, '')})`);
                }

                if (action === 'remove') {
                    const number = args[1];
                    if (!number) return reply('✘ Usage: *.contact remove <number>*');

                    const jid = `${number.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
                    await sock.removeContact(jid);

                    await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                    return reply(`✓ *Contact removed:* +${numberreplace(/[^0-9]/g, '')}`);
                }
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ Error: ${err.message}`);
            }
        }
    }
];
