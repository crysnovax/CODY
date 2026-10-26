const normalizeJid = (jid = '') => String(jid).replace(/:\d+@/, '@');
const cleanNumber = (value = '') => String(value).replace(/[^0-9]/g, '');
const isPhoneJid = (jid = '') => normalizeJid(jid).endsWith('@s.whatsapp.net');

function participantJids(participant) {
    if (!participant || typeof participant !== 'object') return [];
    const ids = [participant.id, participant.jid, participant.lid]
        .filter(value => typeof value === 'string' && value.includes('@'))
        .map(normalizeJid);
    const phoneNumber = String(participant.phoneNumber || '').trim();
    if (phoneNumber) {
        const normalized = normalizeJid(phoneNumber);
        if (normalized.includes('@')) ids.push(normalized);
        else if (/^\+?[\d\s().-]+$/.test(phoneNumber)) {
            const digits = cleanNumber(phoneNumber);
            if (digits) ids.push(`${digits}@s.whatsapp.net`);
        }
    }
    return [...new Set(ids.filter(Boolean))];
}

async function resolvePhoneJid(sock, candidates = []) {
    const values = [...new Set(candidates.filter(Boolean).map(normalizeJid))];
    const direct = values.find(isPhoneJid);
    if (direct) return direct;

    const mapper = sock?.signalRepository?.lidMapping;
    if (mapper?.getPNForLID) {
        for (const jid of values.filter(value => value.endsWith('@lid'))) {
            try {
                const mapped = normalizeJid(await mapper.getPNForLID(jid) || '');
                if (isPhoneJid(mapped)) return mapped;
            } catch {}
        }
    }

    return null;
}

async function resolvePhoneJidWithMetadata(sock, chatId, candidates = []) {
    const direct = await resolvePhoneJid(sock, candidates);
    if (direct) return direct;

    if (!String(chatId).endsWith('@g.us')) return null;
    const metadata = await sock.groupMetadata?.(chatId)?.catch?.(() => null) || null;
    if (!metadata?.participants) return null;

    const wanted = new Set(candidates.filter(Boolean).map(normalizeJid));
    for (const participant of metadata.participants) {
        const ids = [participant.id, participant.lid, participant.jid].filter(Boolean).map(normalizeJid);
        if (ids.some(jid => wanted.has(jid))) {
            const phone = [participant.phoneNumber, participant.id, participant.jid]
                .filter(Boolean).map(normalizeJid).find(isPhoneJid);
            if (phone) return phone;
        }
    }
    return null;
}

async function identityVariants(sock, jid) {
    const normalized = normalizeJid(jid);
    const variants = new Set(normalized ? [normalized] : []);
    const mapper = sock?.signalRepository?.lidMapping;

    try {
        if (normalized.endsWith('@lid') && mapper?.getPNForLID) {
            const pn = await mapper.getPNForLID(normalized);
            if (pn) variants.add(normalizeJid(pn));
        } else if (normalized.endsWith('@s.whatsapp.net') && mapper?.getLIDForPN) {
            const lid = await mapper.getLIDForPN(normalized);
            if (lid) variants.add(normalizeJid(lid));
        }
    } catch {}

    return variants;
}

async function identitiesOverlap(sock, left, right) {
    const [leftVariants, rightVariants] = await Promise.all([
        identityVariants(sock, left),
        identityVariants(sock, right),
    ]);
    return [...leftVariants].some(jid => rightVariants.has(jid));
}

function getContextInfo(m) {
    return m?.msg?.contextInfo
        || m?.message?.extendedTextMessage?.contextInfo
        || m?.message?.imageMessage?.contextInfo
        || m?.message?.videoMessage?.contextInfo
        || {};
}

async function resolveCommandTarget(sock, m, rawValue = '') {
    const contextInfo = getContextInfo(m);
    const explicitNumber = cleanNumber(rawValue);
    if (explicitNumber) return `${explicitNumber}@s.whatsapp.net`;

    const candidates = [
        ...(m?.mentionedJid || []),
        ...(contextInfo.mentionedJid || []),
        m?.quoted?.sender,
        m?.quoted?.key?.participant,
        contextInfo.participantAlt,
        contextInfo.participant,
    ];

    return resolvePhoneJidWithMetadata(sock, m?.chat, candidates);
}

module.exports = {
    cleanNumber,
    getContextInfo,
    identitiesOverlap,
    identityVariants,
    isPhoneJid,
    normalizeJid,
    participantJids,
    resolveCommandTarget,
    resolvePhoneJid,
    resolvePhoneJidWithMetadata,
};
