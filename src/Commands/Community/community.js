const fetch = require('node-fetch');

// ── ALL COMMUNITY MANAGEMENT COMMANDS ──────────────────────────────────────
module.exports = [
    // ── CREATE COMMUNITY ─────────────────────────────────────────────────
    {
        name: 'createcommunity',
        alias: ['ccommunity', 'newcommunity', 'makecommunity'],
        desc: 'Create a new WhatsApp community',
        category: 'Community',
        ownerOnly: true,
        usage: '.createcommunity <name> [description]',
        examples: ['.createcommunity My Community', '.createcommunity Tech Hub Best place for devs'],
        reactions: { start: '🏘️', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const name = args[0];
            const description = args.slice(1).join(' ') || '';

            if (!name) {
                return reply(`⊘ *Usage:* createcommunity <name> [description]\n\nExample: .createcommunity Tech Hub`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🏘️', key: m.key } });

            try {
                const community = await sock.communityCreate(name, description);
                const inviteCode = community?.inviteCode || community?.code;
                const communityLink = `https://chat.whatsapp.com/${inviteCode}`;

                let thumbnail = null;
                try {
                    const pp = await sock.profilePictureUrl(m.chat, 'image');
                    thumbnail = await fetch(pp).then(r => r.buffer());
                } catch {}

                await sock.sendMessage(m.chat, {
                    extendedTextMessage: {
                        text: communityLink,
                        matchedText: communityLink,
                        canonicalUrl: communityLink,
                        title: name,
                        description: description || 'WhatsApp Community Invite',
                        previewType: 1,
                        jpegThumbnail: thumbnail
                    },
                    raw: true
                }, { quoted: m });
                
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });

            } catch (err) {
                console.error('CREATE COMMUNITY ERROR:', err);
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── LEAVE COMMUNITY ─────────────────────────────────────────────────
    {
        name: 'leavecommunity',
        alias: ['lcommunity', 'exitcommunity'],
        desc: 'Leave a WhatsApp community',
        category: 'Community',
        ownerOnly: true,
        usage: '.leavecommunity <community_jid>',
        examples: ['.leavecommunity 1234567890@community'],
        reactions: { start: '🚪', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const jid = args[0];

            if (!jid || !jid.includes('@')) {
                return reply(`⊘ *Usage:* leavecommunity <community_jid>\n\nExample: .leavecommunity 1234567890@community`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🚪', key: m.key } });

            try {
                await sock.communityLeave(jid);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Left community:* ${jid}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── CREATE GROUP INSIDE COMMUNITY ───────────────────────────────────
    {
        name: 'communitygroup',
        alias: ['cgroup', 'addgrouptocommunity'],
        desc: 'Create a new group inside a community',
        category: 'Community',
        ownerOnly: true,
        usage: '.communitygroup <community_jid> <group_name>',
        examples: ['.communitygroup 1234567890@community Announcements'],
        reactions: { start: '👥', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const communityJid = args[0];
            const groupName = args.slice(1).join(' ');

            if (!communityJid || !groupName) {
                return reply(`⊘ *Usage:* communitygroup <community_jid> <group_name>\n\nExample: .communitygroup 1234567890@community Announcements`);
            }

            await sock.sendMessage(m.chat, { react: { text: '👥', key: m.key } });

            try {
                const group = await sock.communityCreateGroup(groupName, [], communityJid);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Group Created Inside Community*\n\n📛 *Group Name:* ${groupName}\n🆔 *Group JID:* ${group?.jid || 'Created'}\n🏘️ *Community:* ${communityJid}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── UPDATE COMMUNITY SUBJECT (NAME) ─────────────────────────────────
    {
        name: 'communityname',
        alias: ['cname', 'updatecommunity', 'communitysubject'],
        desc: 'Update community name/subject',
        category: 'Community',
        ownerOnly: true,
        usage: '.communityname <community_jid> <new_name>',
        examples: ['.communityname 1234567890@community Tech Hub New'],
        reactions: { start: '✏️', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const jid = args[0];
            const newName = args.slice(1).join(' ');

            if (!jid || !newName) {
                return reply(`⊘ *Usage:* communityname <community_jid> <new_name>\n\nExample: .communityname 1234567890@community Tech Hub`);
            }

            await sock.sendMessage(m.chat, { react: { text: '✏️', key: m.key } });

            try {
                await sock.communityUpdateSubject(jid, newName);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Community name updated to:* ${newName}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── LINK GROUP TO COMMUNITY ─────────────────────────────────────────
    {
        name: 'linkgroup',
        alias: ['attachgroup', 'addgroup'],
        desc: 'Link an existing group to a community',
        category: 'Community',
        ownerOnly: true,
        usage: '.linkgroup <community_jid> <group_jid>',
        examples: ['.linkgroup 1234567890@community 1234567890-123456@g.us'],
        reactions: { start: '🔗', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const communityJid = args[0];
            const groupJid = args[1];

            if (!communityJid || !groupJid) {
                return reply(`⊘ *Usage:* linkgroup <community_jid> <group_jid>\n\nExample: .linkgroup 1234567890@community 1234567890-123456@g.us`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🔗', key: m.key } });

            try {
                await sock.communityLinkGroup(groupJid, communityJid);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Group linked to community*\n\n👥 *Group:* ${groupJid}\n🏘️ *Community:* ${communityJid}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── UNLINK GROUP FROM COMMUNITY ─────────────────────────────────────
    {
        name: 'unlinkgroup',
        alias: ['detachgroup', 'removegroup'],
        desc: 'Unlink a group from a community',
        category: 'Community',
        ownerOnly: true,
        usage: '.unlinkgroup <community_jid> <group_jid>',
        examples: ['.unlinkgroup 1234567890@community 1234567890-123456@g.us'],
        reactions: { start: '🔓', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const communityJid = args[0];
            const groupJid = args[1];

            if (!communityJid || !groupJid) {
                return reply(`⊘ *Usage:* unlinkgroup <community_jid> <group_jid>\n\nExample: .unlinkgroup 1234567890@community 1234567890-123456@g.us`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🔓', key: m.key } });

            try {
                await sock.communityUnlinkGroup(groupJid, communityJid);
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Group unlinked from community*\n\n👥 *Group:* ${groupJid}\n🏘️ *Community:* ${communityJid}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── FETCH LINKED GROUPS ─────────────────────────────────────────────
    {
        name: 'linkedgroups',
        alias: ['communitygroups', 'cgroups'],
        desc: 'Get all groups linked to a community',
        category: 'Community',
        ownerOnly: true,
        usage: '.linkedgroups <community_jid>',
        examples: ['.linkedgroups 1234567890@community'],
        reactions: { start: '📋', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const jid = args[0];

            if (!jid) {
                return reply(`⊘ *Usage:* linkedgroups <community_jid>\n\nExample: .linkedgroups 1234567890@community`);
            }

            await sock.sendMessage(m.chat, { react: { text: '📋', key: m.key } });

            try {
                const groups = await sock.communityFetchLinkedGroups(jid);
                
                if (!groups || groups.length === 0) {
                    await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                    return reply(`📋 *Linked Groups*\n\nNo groups linked to this community.`);
                }

                let text = `👥 *LINKED GROUPS*\n\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                for (let i = 0; i < groups.length; i++) {
                    const group = groups[i];
                    text += `${i+1}. ${group.subject || group.name || group.jid}\n`;
                    text += `   🆔 ${group.jid}\n\n`;
                }
                text += `━━━━━━━━━━━━━━━━━━━━━━\nTotal: ${groups.length} groups`;
                
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(text);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── FETCH ALL PARTICIPATING COMMUNITIES ─────────────────────────────
    {
        name: 'mycommunities',
        alias: ['communities', 'allcommunities', 'clist'],
        desc: 'Get all communities you participate in',
        category: 'Community',
        ownerOnly: true,
        usage: '.mycommunities',
        examples: ['.mycommunities'],
        reactions: { start: '🏘️', success: '🍃', error: '🥵' },

        execute: async (sock, m, { reply, prefix }) => {
            await sock.sendMessage(m.chat, { react: { text: '🏘️', key: m.key } });

            try {
                const communities = await sock.communityFetchAllParticipating();
                
                if (!communities || Object.keys(communities).length === 0) {
                    await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                    return reply(`🏘️ *My Communities*\n\nYou are not in any communities.`);
                }

                let text = `🏘️ *MY COMMUNITIES*\n\n━━━━━━━━━━━━━━━━━━━━━━\n`;
                const communityList = Object.values(communities);
                for (let i = 0; i < communityList.length; i++) {
                    const comm = communityList[i];
                    text += `${i+1}. ${comm.subject || comm.name || 'Unnamed'}\n`;
                    text += `   🆔 ${comm.jid}\n`;
                    if (comm.size) text += `   👥 ${comm.size} members\n`;
                    text += `\n`;
                }
                text += `━━━━━━━━━━━━━━━━━━━━━━\nTotal: ${communityList.length} communities`;
                
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(text);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── GET COMMUNITY METADATA ──────────────────────────────────────────
    {
        name: 'communityinfo',
        alias: ['cinfo', 'communitymetadata'],
        desc: 'Get detailed information about a community',
        category: 'Community',
        ownerOnly: true,
        usage: '.communityinfo <community_jid>',
        examples: ['.communityinfo 1234567890@community'],
        reactions: { start: 'ℹ️', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const jid = args[0];

            if (!jid) {
                return reply(`⊘ *Usage:* communityinfo <community_jid>\n\nExample: .communityinfo 1234567890@community`);
            }

            await sock.sendMessage(m.chat, { react: { text: 'ℹ️', key: m.key } });

            try {
                const metadata = await sock.communityMetadata(jid);
                
                if (!metadata) {
                    return reply(`⊘ *Community not found*`);
                }

                await sock.sendMessage(m.chat, {
                    headerText: `## 🏘️ Community Info`,
                    contentText: '---',
                    title: metadata.subject || metadata.name || 'Community',
                    table: [
                        ['📛 Name', metadata.subject || metadata.name || 'N/A'],
                        ['📝 Description', metadata.description || 'N/A'],
                        ['🆔 JID', jid],
                        ['👥 Members', metadata.size || metadata.participants?.length || 'N/A'],
                        ['👑 Owner', metadata.owner || 'N/A'],
                        ['🔗 Linked Groups', metadata.linkedGroups?.length || '0']
                    ],
                    footerText: '💡 Use .linkedgroups to see all groups',
                    raw: true
                }, { quoted: m });

                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });

            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── ADD PARTICIPANT TO COMMUNITY ────────────────────────────────────
    {
        name: 'addtocommunity',
        alias: ['communityadd', 'addcommunity'],
        desc: 'Add a participant to a community',
        category: 'Community',
        ownerOnly: true,
        usage: '.addtocommunity <community_jid> <user_jid>',
        examples: ['.addtocommunity 1234567890@community 2348077134210@s.whatsapp.net'],
        reactions: { start: '👤', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const communityJid = args[0];
            const userJid = args[1];

            if (!communityJid || !userJid) {
                return reply(`⊘ *Usage:* addtocommunity <community_jid> <user_jid>\n\nExample: .addtocommunity 1234567890@community 2348077134210@s.whatsapp.net`);
            }

            await sock.sendMessage(m.chat, { react: { text: '👤', key: m.key } });

            try {
                await sock.communityParticipantsUpdate(communityJid, [userJid], 'add');
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Added user to community*\n\n👤 *User:* ${userJid}\n🏘️ *Community:* ${communityJid}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── REMOVE PARTICIPANT FROM COMMUNITY ───────────────────────────────
    {
        name: 'removefromcommunity',
        alias: ['communityremove', 'removecommunity'],
        desc: 'Remove a participant from a community',
        category: 'Community',
        ownerOnly: true,
        usage: '.removefromcommunity <community_jid> <user_jid>',
        examples: ['.removefromcommunity 1234567890@community 2348077134210@s.whatsapp.net'],
        reactions: { start: '🚫', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const communityJid = args[0];
            const userJid = args[1];

            if (!communityJid || !userJid) {
                return reply(`⊘ *Usage:* removefromcommunity <community_jid> <user_jid>\n\nExample: .removefromcommunity 1234567890@community 2348077134210@s.whatsapp.net`);
            }

            await sock.sendMessage(m.chat, { react: { text: '🚫', key: m.key } });

            try {
                await sock.communityParticipantsUpdate(communityJid, [userJid], 'remove');
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Removed user from community*\n\n👤 *User:* ${userJid}\n🏘️ *Community:* ${communityJid}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    },

    // ── PROMOTE TO COMMUNITY ADMIN ──────────────────────────────────────
    {
        name: 'communityadmin',
        alias: ['promotecommunity', 'communitypromote'],
        desc: 'Promote a user to community admin',
        category: 'Community',
        ownerOnly: true,
        usage: '.communityadmin <community_jid> <user_jid>',
        examples: ['.communityadmin 1234567890@community 2348077134210@s.whatsapp.net'],
        reactions: { start: '👑', success: '🍃', error: '🥵' },

        execute: async (sock, m, { args, reply, prefix }) => {
            const communityJid = args[0];
            const userJid = args[1];

            if (!communityJid || !userJid) {
                return reply(`⊘ *Usage:* communityadmin <community_jid> <user_jid>\n\nExample: .communityadmin 1234567890@community 2348077134210@s.whatsapp.net`);
            }

            await sock.sendMessage(m.chat, { react: { text: '👑', key: m.key } });

            try {
                await sock.communityParticipantsUpdate(communityJid, [userJid], 'promote');
                await sock.sendMessage(m.chat, { react: { text: '🍃', key: m.key } });
                return reply(`✓ *Promoted to community admin*\n\n👤 *User:* ${userJid}\n🏘️ *Community:* ${communityJid}`);
            } catch (err) {
                await sock.sendMessage(m.chat, { react: { text: '🥵', key: m.key } });
                return reply(`⊘ *Error:* ${err.message}`);
            }
        }
    }
];