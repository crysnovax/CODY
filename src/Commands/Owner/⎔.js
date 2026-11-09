// =============================================
// src/Commands/Owner/⏔.js — SSCMD TRIGGER (STANDALONE)
// Uses the SAME download method as your working .savestatus
// =============================================

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'database', 'sscmd.json');
let triggers = {};

try {
    if (fs.existsSync(DB_PATH)) {
        triggers = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
} catch {}

function saveDB() {
    if (!fs.existsSync(path.dirname(DB_PATH))) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(triggers, null, 2));
}

function getOwnerJid() {
    const num = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
    return num ? `${num}@s.whatsapp.net` : null;
}

// ═══════════════════════════════════════════════
// REPLY TRIGGER (copy of .savestatus download method)
// ═══════════════════════════════════════════════
async function handleSSReply(sock, m) {
    try {
        const sender = m.sender;
        const trigger = triggers[sender];
        if (!trigger) return;

        // Text extraction (same as vvcmd)
        const text = (
            m.message?.conversation ||
            m.message?.extendedTextMessage?.text ||
            ''
        ).trim();

        if (text !== trigger) return;

        // Must reply to a media message
        if (!m.quoted) return;
        const quoted = m.quoted;
        const mtype = quoted.mtype;
        const validTypes = [
            'imageMessage',
            'videoMessage',
            'audioMessage',
            'stickerMessage',
            'documentMessage'
        ];
        if (!validTypes.includes(mtype)) return;

        // Prefer Baileys' status-aware media path; preserve old deployments as a fallback.
        const buffer = typeof sock.downloadStatus === 'function'
            ? await sock.downloadStatus(quoted, 'buffer')
            : await quoted.download();
        if (!buffer || !buffer.length) return;

        const caption = quoted.text || quoted.caption || '';
        const target = getOwnerJid() || sender;

        // Send to DM
        if (mtype === 'imageMessage') {
            await sock.sendMessage(target, {
                image: buffer,
                caption: caption || 'ಥ⁠‿⁠ಥ 📸 _Saved status_'
            });
        } else if (mtype === 'videoMessage') {
            await sock.sendMessage(target, {
                video: buffer,
                caption: caption || '☞⁠ ͡⁠°⁠ ͜⁠ʖ⁠ ͡⁠°⁠)☞ 🎥 _Saved status_',
                mimetype: 'video/mp4'
            });
        } else if (mtype === 'audioMessage') {
            await sock.sendMessage(target, {
                audio: buffer,
                mimetype: 'audio/mpeg',
                ptt: false
            });
        } else if (mtype === 'stickerMessage') {
            await sock.sendMessage(target, { sticker: buffer });
        } else if (mtype === 'documentMessage') {
            await sock.sendMessage(target, {
                document: buffer,
                mimetype: quoted.mimetype || 'application/octet-stream',
                fileName: quoted.fileName || 'status_file'
            });
        }

        // Delete the trigger reply to keep things clean
        await sock.sendMessage(m.chat, { delete: m.key }).catch(() => {});

        console.log(`[SSCMD] Status saved → ${target.split('@')[0]} via "${trigger}"`);

    } catch (err) {
        console.error('[SSCMD ERROR]', err.message);
    }
}

// ═══════════════════════════════════════════════
// SSCMD COMMAND
// ═══════════════════════════════════════════════
module.exports = {
    name: 'sscmd',
    alias: ['setss', 'sstrigger'],
    desc: 'Set emoji trigger to save status to your DM',
    category: 'Owner',
    reactions: { start: '📥', success: '👀' },

    execute: async (sock, m, { args, reply }) => {
        const sender = m.sender;
        const input = args[0];

        // SET trigger
        if (input && input !== 'off' && input !== 'status') {
            triggers[sender] = input;
            saveDB();
            return reply(
                `╭─❍ *SS Trigger Set* ✦\n` +
                `│ Emoji: ${input}\n` +
                `│\n` +
                `│ Reply to any status with\n` +
                `│ ${input} → saves to DM\n` +
                `╰──────────────────`
            );
        }

        // REMOVE
        if (input === 'off') {
            delete triggers[sender];
            saveDB();
            return reply(`╭─❍ *SS Trigger*\n│ ✘ Removed\n╰──────────────────`);
        }

        // CHECK
        if (input === 'status') {
            const current = triggers[sender];
            return reply(
                `╭─❍ *SS Trigger Status*\n` +
                `│ Trigger: ${current || '✘ Not set'}\n` +
                `╰──────────────────`
            );
        }

        // HELP
        return reply(
            `╭─❍ *Status Save Trigger*\n` +
            `│\n` +
            `│ ✦ .sscmd ❔     → set emoji\n` +
            `│ ✦ .sscmd off    → remove\n` +
            `│ ✦ .sscmd status → check\n` +
            `│\n` +
            `│ Reply to any status with\n` +
            `│ your emoji → saves to DM\n` +
            `╰──────────────────`
        );
    }
};

// Export the reply handler for your message handler
module.exports.handleSSReply = handleSSReply;
