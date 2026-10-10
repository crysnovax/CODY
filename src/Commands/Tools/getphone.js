'use strict';
const {
    cleanNumber,
    identityVariants,
    isPhoneJid,
    normalizeJid,
    resolvePhoneJid,
    resolvePhoneJidWithMetadata,
} = require('../../Plugin/identityUtils');

const PHONE_JID = '@s.whatsapp.net';
const ALLOWED_SUFFIXES = ['@s.whatsapp.net', '@c.us', '@lid'];
const isGroupChat = (m) => Boolean(m?.isGroup || String(m?.chat || '').endsWith('@g.us'));

function parseUserJid(value) {
    const input = String(value || '').trim();
    if (!input.includes('@')) return null;
    const jid = normalizeJid(input);
    if (!ALLOWED_SUFFIXES.some(suffix => jid.endsWith(suffix))) return null;
    if (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us')) {
        const local = jid.slice(0, jid.lastIndexOf('@'));
        const digits = cleanNumber(local);
        if (digits.length < 7 || digits.length > 15) return null;
        return `${digits}${PHONE_JID}`;
    }
    if (!/^\d+(?::\d+)?@lid$/.test(jid)) return null;
    return jid;
}

function contactPhone(sock, target) {
    const contacts = sock?.store?.contacts;
    if (!contacts) return null;
    const entries = contacts instanceof Map ? [...contacts.entries()] : Object.entries(contacts);
    const wanted = new Set([normalizeJid(target)]);
    for (const [key, value] of entries) {
        const ids = [key, value?.id, value?.jid, value?.lid].filter(Boolean).map(normalizeJid);
        if (!ids.some(id => wanted.has(id))) continue;
        const phoneKey = ids.find(isPhoneJid);
        if (phoneKey) return phoneKey;
        const raw = value?.phoneNumber;
        if (raw) {
            const normalized = normalizeJid(raw);
            if (isPhoneJid(normalized)) return normalized;
            if (normalized.includes('@')) continue;
            const digits = cleanNumber(raw);
            if (digits.length >= 7 && digits.length <= 15) return `${digits}${PHONE_JID}`;
        }
    }
    return null;
}

async function numberFromResult(result) {
    for (const value of [result?.phoneNumber, result?.pn, result?.jid]) {
        if (!value) continue;
        const normalized = normalizeJid(value);
        if (isPhoneJid(normalized)) {
            const digits = cleanNumber(normalized.split('@')[0]);
            if (digits.length >= 7 && digits.length <= 15) return digits;
            continue;
        }
        // Only bare phoneNumber/pn fields are trusted as digits. A bare jid
        // or an @lid value must never be converted by stripping its suffix.
        if (value === result?.jid || String(value).includes('@')) continue;
        const digits = cleanNumber(value);
        if (digits.length >= 7 && digits.length <= 15) return digits;
    }
    return null;
}

async function resolveRealPhone(sock, target, chat) {
    const normalized = normalizeJid(target);
    if (isPhoneJid(normalized)) {
        const digits = cleanNumber(normalized.split('@')[0]);
        return digits.length >= 7 && digits.length <= 15 ? digits : null;
    }

    let phoneJid = await resolvePhoneJidWithMetadata(sock, chat, [normalized]);
    if (!phoneJid) phoneJid = contactPhone(sock, normalized);
    if (phoneJid) {
        const digits = cleanNumber(phoneJid.split('@')[0]);
        if (digits.length >= 7 && digits.length <= 15) return digits;
    }

    if (typeof sock?.findUserId === 'function') {
        try {
            const found = await sock.findUserId(normalized);
            const number = await numberFromResult(found);
            if (number) return number;
        } catch {}
    }
    return null;
}

async function participantVariants(sock, participant) {
    const variants = new Set();
    for (const [field, raw] of Object.entries({
        id: participant?.id,
        jid: participant?.jid,
        lid: participant?.lid,
        phoneNumber: participant?.phoneNumber,
    })) {
        if (!raw) continue;
        const normalized = normalizeJid(raw);
        if (normalized.includes('@')) {
            for (const jid of await identityVariants(sock, normalized)) variants.add(jid);
        } else if (field === 'phoneNumber') {
            const digits = cleanNumber(normalized);
            if (digits.length >= 7 && digits.length <= 15) variants.add(`${digits}${PHONE_JID}`);
        }
    }
    return variants;
}

async function isGroupAdmin(sock, metadata, m, context) {
    if (context?.isAdmin || context?.isOwner || context?.isSudo || context?.isDual) return true;
    const requesterIds = [m?.sender, m?.key?.participant, m?.key?.participantAlt].filter(Boolean);
    const requesterVariants = new Set();
    for (const id of requesterIds) {
        for (const jid of await identityVariants(sock, id)) requesterVariants.add(jid);
    }
    // Avoid async Array.find predicates; compare each participant's full PN/LID variants.
    for (const person of metadata?.participants || []) {
        const variants = await participantVariants(sock, person);
        if ([...variants].some(id => requesterVariants.has(id))) {
            return person.admin === 'admin' || person.admin === 'superadmin';
        }
    }
    return false;
}

async function isGroupMember(sock, metadata, target) {
    const targetVariants = await identityVariants(sock, target);
    for (const person of metadata?.participants || []) {
        const variants = await participantVariants(sock, person);
        if ([...variants].some(id => targetVariants.has(id))) return true;
    }
    return false;
}

async function targetFromMessage(m, args) {
    const raw = args?.[0];
    if (raw) return parseUserJid(raw);
    const mentioned = m?.mentionedJid?.[0] || m?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quoted = m?.quoted?.sender || m?.quoted?.key?.participant;
    return parseUserJid(mentioned || quoted);
}

async function deliverNumber(sock, m, number, group) {
    if (!group) {
        await sock.sendMessage(m.chat, { text: number }, { quoted: m });
        return true;
    }
    const requester = m.sender || m.key?.participant;
    const recipient = await resolvePhoneJid(sock, [requester]) || requester;
    if (!recipient) return false;
    await sock.sendMessage(recipient, { text: number });
    return true;
}

const plugin = {
    name: 'getphone',
    alias: ['getnumber', 'phoneof'],
    desc: 'Return the verified phone number for yourself or a group member ID',
    category: 'Tools',
    usage: '.getphone (in your DM) | .getphone <JID/LID> (group admin)',
    execute: async (sock, m, context = {}) => {
        const group = isGroupChat(m);
        const rawTarget = await targetFromMessage(m, context.args || []);
        let target = rawTarget;

        if (group) {
            if (!target) {
                return context.reply?.('In a DM, run `.getphone` for your own number. For a group member, use `.getphone <JID/LID>` or reply/mention them; only group admins can request another member’s number.');
            }
            const metadata = await sock.groupMetadata(m.chat).catch(() => null);
            if (!metadata) return context.reply?.('Could not read this group’s member list.');
            if (!await isGroupAdmin(sock, metadata, m, context)) {
                return context.reply?.('Only group admins can look up a member’s phone number.');
            }
            if (!await isGroupMember(sock, metadata, target)) {
                return context.reply?.('That JID/LID is not a member of this group.');
            }
        } else {
            const requester = m?.sender || m?.key?.participant || m?.key?.remoteJid;
            if (target) {
                const requesterVariants = new Set();
                for (const id of [requester, m?.key?.participantAlt].filter(Boolean)) {
                    for (const jid of await identityVariants(sock, id)) requesterVariants.add(jid);
                }
                const targetVariants = await identityVariants(sock, target);
                if (![...targetVariants].some(id => requesterVariants.has(id))) {
                    return context.reply?.('In a private chat, getphone can only return your own number.');
                }
            } else {
                target = parseUserJid(requester);
            }
            if (!target) return context.reply?.('Could not identify your private-chat JID.');
        }

        const number = await resolveRealPhone(sock, target, group ? m.chat : undefined);
        if (!number) {
            return context.reply?.('Could not resolve a real phone number for that JID/LID. CODY will not use the LID digits as a phone-number fallback.');
        }
        try {
            const delivered = await deliverNumber(sock, m, number, group);
            if (!delivered) return context.reply?.('Could not privately deliver the number. Run `.getphone` in your DM with CODY instead.');
        } catch (error) {
            console.error('[GETPHONE DELIVERY ERROR]', error?.stack || error?.message || error);
            return context.reply?.(group
                ? 'Could not privately deliver the number. Open a DM with CODY and run `.getphone` there.'
                : 'Could not send the number in this chat.');
        }
    },
};
plugin.parseUserJid = parseUserJid;
plugin.resolveRealPhone = resolveRealPhone;
plugin.isGroupAdmin = isGroupAdmin;
plugin.isGroupMember = isGroupMember;
module.exports = plugin;
