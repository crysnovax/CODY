'use strict';

const { cleanNumber, normalizeJid, resolvePhoneJid } = require('./identityUtils');

function entryJids(entry) {
    if (typeof entry === 'string' || typeof entry === 'number') return [String(entry)];
    if (!entry || typeof entry !== 'object') return [];
    return [entry.id, entry.jid, entry.lid, entry.phoneNumber, entry.pn]
        .filter(value => typeof value === 'string' || typeof value === 'number')
        .map(String);
}

function getContacts(sock, store = null) {
    const contacts = store?.contacts || sock?.store?.contacts;
    if (contacts instanceof Map) return [...contacts.entries()];
    if (contacts && typeof contacts === 'object') return Object.entries(contacts);
    return [];
}

function comparableIds(value) {
    const raw = String(value || '').trim();
    const ids = raw ? [normalizeJid(raw)] : [];
    if (/^\+?[0-9\s().-]+$/.test(raw)) {
        const digits = cleanNumber(raw);
        if (digits) ids.push(`${digits}@s.whatsapp.net`);
    }
    return ids;
}

function matchingStoreContacts(sock, identifiers, store = null) {
    const wanted = new Set(identifiers.flatMap(comparableIds));
    return getContacts(sock, store)
        .filter(([key, contact]) => {
            const ids = [key, ...entryJids(contact)];
            return ids.some(id => comparableIds(id).some(candidate => wanted.has(candidate)));
        })
        .map(([, contact]) => contact);
}

function escapeVcard(value) {
    return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

async function createContactCards(sock, entries, { displayName = 'Contacts', store = null } = {}) {
    const contacts = [];
    const seenNumbers = new Set();
    let unresolved = 0;

    for (const entry of entries || []) {
        const identifiers = entryJids(entry).map(value => value.trim()).filter(Boolean);
        const storeContacts = matchingStoreContacts(sock, identifiers, store);
        const candidates = [...identifiers];
        for (const contact of storeContacts) candidates.push(...entryJids(contact));

        // Bare digits in these owner lists/contact records are saved phone
        // numbers. Never use digits from an @lid JID; resolve those via Baileys.
        for (const candidate of [...candidates]) {
            if (/^\+?[0-9\s().-]+$/.test(candidate)) {
                const digits = cleanNumber(candidate);
                if (digits) candidates.push(`${digits}@s.whatsapp.net`);
            }
        }

        let phoneJid = await resolvePhoneJid(sock, candidates);
        let digits = cleanNumber(phoneJid?.slice(0, phoneJid.indexOf('@')) || '');
        if ((!digits || digits.length < 7 || digits.length > 15) && typeof sock?.findUserId === 'function') {
            for (const lid of identifiers.filter(value => normalizeJid(value).endsWith('@lid'))) {
                try {
                    const result = await sock.findUserId(normalizeJid(lid));
                    for (const value of [result?.phoneNumber, result?.pn, result?.jid]) {
                        if (!value) continue;
                        const normalized = normalizeJid(value);
                        let candidateDigits = '';
                        if (normalized.endsWith('@s.whatsapp.net')) {
                            candidateDigits = cleanNumber(normalized.slice(0, normalized.indexOf('@')));
                        } else if (value !== result?.jid && !String(value).includes('@')) {
                            candidateDigits = cleanNumber(value);
                        }
                        if (candidateDigits.length >= 7 && candidateDigits.length <= 15) {
                            digits = candidateDigits;
                            phoneJid = `${digits}@s.whatsapp.net`;
                            break;
                        }
                    }
                    if (digits.length >= 7 && digits.length <= 15) break;
                } catch {}
            }
        }
        if (digits.length < 7 || digits.length > 15) {
            unresolved++;
            continue;
        }
        if (seenNumbers.has(digits)) continue;

        seenNumbers.add(digits);
        const savedName = storeContacts
            .map(contact => contact?.name || contact?.notify || contact?.verifiedName || contact?.pushName)
            .find(name => typeof name === 'string' && name.trim());
        const name = escapeVcard(savedName?.trim() || `+${digits}`);
        contacts.push({
            vcard: [
                'BEGIN:VCARD',
                'VERSION:3.0',
                `FN:${name}`,
                `N:;${name};;;`,
                `TEL;TYPE=CELL;waid=${digits}:+${digits}`,
                'END:VCARD',
            ].join('\n'),
        });
    }

    return {
        payload: contacts.length ? { displayName, contacts } : null,
        unresolved,
    };
}

module.exports = { createContactCards, escapeVcard };
