// savemode.js — when on, any unsaved contact that DMs the bot gets blocked
// automatically. "Saved" comes from the synced address book, with a
// SAVED_NUMBERS var as fallback. @crysnovax—FIX06-08-26
const { getVar, setVar } = require('../../Plugin/configManager');

module.exports = {
    name: 'savemode',
    alias: ['savedmode', 'abu', 'autoblockunknown'],
    desc: 'Block unsaved contacts that DM you',
    category: 'Owner',
    ownerOnly: true,
    reactions: { start: '🛡️', success: '🚫' },

    execute: async (sock, m, { args, reply }) => {
        const sub = (args[0] || '').toLowerCase();

        if (sub === 'on' || sub === 'true' || sub === '1') {
            setVar('SAVE_MODE', true);
            return reply('_✓ SAVE_MODE on — unsaved contacts that DM you get blocked_');
        }
        if (sub === 'off' || sub === 'false' || sub === '0') {
            setVar('SAVE_MODE', false);
            return reply('_✘ SAVE_MODE off_');
        }

        const current = getVar('SAVE_MODE', false);
        return reply(`_SAVE_MODE is currently ${current ? 'ON ✓' : 'OFF ✘'}_\n\nUsage:\n.savemode on|off\n\n_Saved list fallback: .setvar SAVED_NUMBERS=2348xxx,2349xxx_`);
    }
};

// Saved contact check — address book first, SAVED_NUMBERS as fallback.
function isSavedContact(sock, jid) {
    try {
        const store = sock.store;
        if (store?.contacts) {
            const contacts = store.contacts instanceof Map
                ? store.contacts
                : new Map(Object.entries(store.contacts || {}));

            const direct = contacts.get(jid) || contacts.get(jid.replace(/:\d+@/, '@')) || contacts.get(jid.split('@')[0]);
            if (direct && (direct.name || direct.notify || direct.verifiedName || direct.phoneNumber)) return true;

            // match by phone number across the whole book
            const phone = jid.split('@')[0].replace(/\D/g, '');
            if (phone) {
                for (const c of contacts.values()) {
                    if (c?.phoneNumber && String(c.phoneNumber).replace(/\D/g, '') === phone) return true;
                }
            }
        }
    } catch {}

    // fallback list when the address book isn't synced
    const saved = String(getVar('SAVED_NUMBERS') || process.env.SAVED_NUMBERS || '')
        .split(',').map(n => n.replace(/\D/g, '')).filter(Boolean);
    if (saved.length) return saved.includes(jid.split('@')[0].replace(/\D/g, ''));

    // can't tell if it's saved → leave it alone
    return true;
}

// Returns true when the sender was blocked (caller stops processing).
module.exports.handleSaveMode = async (sock, m, store) => {
    try {
        if (!m || m.key?.fromMe) return false;
        if (!getVar('SAVE_MODE', false)) return false;

        const jid = m.key?.remoteJid;
        if (!jid || jid.includes('@g.us') || jid === 'status@broadcast') return false;

        const senderNum = (m.sender || '').split('@')[0].replace(/\D/g, '');
        const ownerRaw = process.env.OWNER_NUMBER || getVar('OWNER_NUMBER', '');
        const ownerNum = String(ownerRaw).replace(/\D/g, '');

        // never block the owner or sudo users
        if (ownerNum && (senderNum === ownerNum || senderNum.endsWith(ownerNum) || ownerNum.endsWith(senderNum))) return false;
        const sudo = String(getVar('SUDO_NUMBERS') || process.env.SUDO_NUMBERS || '').split(',').map(n => n.replace(/\D/g, '')).filter(Boolean);
        if (sudo.includes(senderNum)) return false;

        if (isSavedContact(sock, jid)) return false;

        if (typeof sock.updateBlockStatus === 'function') {
            await sock.updateBlockStatus(jid, 'block');
        } else {
            console.error('[SAVEMODE] updateBlockStatus unavailable');
            return false;
        }

        console.log(`[SAVEMODE] blocked unsaved contact ${jid}`);
        try {
            if (ownerNum) {
                await sock.sendMessage(`${ownerNum}@s.whatsapp.net`, {
                    text: `🚫 *Unsaved contact blocked*\n\nNumber : ${senderNum}\nJID    : ${jid}\n\n_They DMed you while SAVE_MODE was on._`
                }).catch(() => {});
            }
        } catch {}
        return true;
    } catch (err) {
        console.error('[SAVEMODE]', err.message);
        return false;
    }
};
