const axios = require('axios');
const phoneResolver = require('../Tools/getphone');

function isGroupChat(m) {
    return Boolean(m?.isGroup || String(m?.chat || '').endsWith('@g.us'));
}

async function resolvePhoneInfoTarget(sock, m, args = [], context = {}) {
    const input = Array.isArray(args) ? args.join(' ').trim() : String(args || '').trim();
    if (input) {
        if (input.includes('@')) {
            const jid = phoneResolver.parseUserJid(input);
            if (!jid) return { error: 'Enter a valid phone number or WhatsApp user JID.' };
            if (isGroupChat(m)) {
                const metadata = typeof sock?.groupMetadata === 'function'
                    ? await sock.groupMetadata(m.chat).catch(() => null)
                    : null;
                if (!metadata) return { error: 'Could not read this group’s member list.' };
                if (!await phoneResolver.isGroupAdmin(sock, metadata, m, context)) {
                    return { error: 'Only group admins can look up a group member’s phone number.' };
                }
                if (!await phoneResolver.isGroupMember(sock, metadata, jid)) {
                    return { error: 'That JID/LID is not a member of this group.' };
                }
            }
            const phone = await phoneResolver.resolveRealPhone(sock, jid, m?.chat);
            return phone ? { phone } : { error: 'Could not resolve a real phone number for that JID/LID.' };
        }
        return { phone: input.replace(/[^0-9]/g, '') };
    }

    const quotedJid = m?.quoted?.sender
        || m?.quoted?.key?.participant
        || m?.quoted?.key?.participantAlt
        || m?.msg?.contextInfo?.participant
        || m?.message?.extendedTextMessage?.contextInfo?.participant;
    if (!quotedJid) return { phone: null };

    const jid = phoneResolver.parseUserJid(quotedJid);
    if (!jid) return { error: 'Could not identify the user in the replied-to message.' };

    if (isGroupChat(m)) {
        const metadata = typeof sock?.groupMetadata === 'function'
            ? await sock.groupMetadata(m.chat).catch(() => null)
            : null;
        if (!metadata) return { error: 'Could not read this group’s member list.' };
        if (!await phoneResolver.isGroupAdmin(sock, metadata, m, context)) {
            return { error: 'Only group admins can look up a replied-to group member.' };
        }
        if (!await phoneResolver.isGroupMember(sock, metadata, jid)) {
            return { error: 'The replied-to user is not a member of this group.' };
        }
    }

    const phone = await phoneResolver.resolveRealPhone(sock, jid, m?.chat);
    return phone ? { phone } : { error: 'Could not resolve a real phone number for that user. CODY will not use LID digits as a phone number.' };
}

module.exports = {
    name: 'phoneinfo',
    alias: ['phone', 'number', 'whoiscalling'],
    desc: 'Get phone number information by number or by replying to a user',
    category: 'Search',
    usage: `${prefix}phoneinfo <number> | reply to a user's message with ${prefix}phoneinfo`,
    reactions: { start: '📞', success: '📡', error: '🏗️' },

    execute: async (sock, m, { args, reply, prefix, isAdmin, isOwner, isSudo, isDual } = {}) => {
        const result = await resolvePhoneInfoTarget(sock, m, args, { isAdmin, isOwner, isSudo, isDual });
        const phone = result.phone;

        if (!phone) {
            if (result.error) return reply(`\`✘ ${result.error}\``);
            return reply(
                `╭─❍ *PHONE INFO*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}phoneinfo <number> or reply to a user's message with ${prefix}phoneinfo\n│\n` +
                `│ ✪ *Examples:*\n` +
                `│ ${prefix}phoneinfo 2348077528901\n` +
                `│ ${prefix}phoneinfo 12025551234\n│\n` +
                `│ 📞 *Include country code!* For a replied LID, CODY must be able to resolve its phone number.\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '📞', key: m.key } });

        try {
            // phone-number-api.com — free endpoint, no API key required
            // Limit: 5 requests/minute per IP. Non-commercial use only.
            const res = await axios.get('http://phone-number-api.com/json/', {
                params: { number: phone },
                timeout: 10000
            });

            const data = res.data;

            if (data.status !== 'success') {
                await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } });
                return reply(`\`✘ Lookup failed: ${data.message || 'invalid number'}\``);
            }

            await sock.sendMessage(m.chat, {
                headerText: `## 📞 Phone Info`,
                contentText: '---',
                title: '📊 Number Details',
                table: [
                    ['📞 Number', data.formatE164 || phone],
                    ['🌍 Country', data.countryName || 'N/A'],
                    ['🏛️ Code', `+${data.numberCountryCode ?? 'N/A'}`],
                    ['📍 Region', [data.city, data.regionName].filter(Boolean).join(', ') || 'N/A'],
                    ['📡 Carrier', data.carrier || 'N/A'],
                    ['📱 Line Type', data.numberType || 'N/A'],
                    ['🕐 Timezone', data.timezone || 'N/A'],
                    ['✅ Valid', data.numberValid ? 'Yes 🔖' : 'No 🏗️']
                ],
                footerText: '💡 Include country code for accurate results'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🎭', key: m.key } });

        } catch (error) {
            if (error.response?.status === 429) {
                console.error('phoneinfo rate limited:', error.message);
                await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } });
                return reply('`✘ Rate limit hit — try again in a minute.`');
            }
            console.error('API Error:', error.message);
            await sock.sendMessage(m.chat, { react: { text: '🏗️', key: m.key } });
            reply('`✘ Failed to lookup number. Please try with country code.`');
        }
    }
};
