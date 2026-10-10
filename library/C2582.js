/**
 * ╔══════════════════════════════════════════════════╗
 * ║   C2582.js — CODY AI Event Handlers              ║
 * ║   Connection Success Message & Group Events      ║
 * ║   Powered by CRYSNOVA AI                         ║
 * ╚══════════════════════════════════════════════════╝
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { getVar } = require('../src/Plugin/configManager');

// Default images for welcome/goodbye (fallback when profile picture fails)
const DEFAULT_WELCOME_IMG = 'https://cdn.crysnova.qzz.io/files/1787959847091-f53824e7-a40f-4e47-b77a-5be1d89045f1.jpeg';
const DEFAULT_GOODBYE_IMG = 'https://cdn.crysnova.qzz.io/files/1787959847091-f53824e7-a40f-4e47-b77a-5be1d89045f1.jpeg';

// Group invite link
const GROUP_INVITE_LINK = 'https://chat.whatsapp.com/J0AOI40QZNhBeTTt9nSLPb?mode=gi_t';
const GROUP_JID = '120363410281907240@g.us';
// This image is used for the connection message (ALWAYS, ignoring config.thumbUrl)
const GROUP_BUTTON_IMG = 'https://cdn.crysnova.qzz.io/files/1787959605771-ab0d9124-b281-4b45-988e-dfc894d83f2e.jpeg';

function resolveOwnerJid({ envOwner = process.env.OWNER_NUMBER, runtimeOwner = getVar('OWNER_NUMBER') } = {}) {
    // Read OWNER_NUMBER when the connection opens, not from the config object
    // captured at module load; Railway/.env initialization can happen later.
    const raw = String(envOwner ?? '').trim() || String(runtimeOwner ?? '').trim();
    if (!raw) return null;

    let phone = raw;
    if (raw.endsWith('@s.whatsapp.net') || raw.endsWith('@c.us')) {
        phone = raw.slice(0, raw.lastIndexOf('@'));
    } else if (raw.includes('@')) {
        return null;
    }
    if (!/^[+\d\s().-]+$/.test(phone)) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return null;
    return `${digits}@s.whatsapp.net`;
}

// ── Send Connected Message to Owner (with Group Button) ──
const sendConnectedMessage = async (sock, config, port, options = {}) => {
    const ownerJid = resolveOwnerJid(options);
    if (!ownerJid) {
        console.warn('[Connected msg skipped] OWNER_NUMBER is missing or invalid; no recipient used.');
        return false;
    }
    // ALWAYS use the hardcoded GROUP_BUTTON_IMG, ignore config.thumbUrl
    const thumbUrl = GROUP_BUTTON_IMG;

    try {
        // Fetch the image as buffer
        let thumbnail = null;
        try {
            if (typeof options.fetchThumbnail === 'function') {
                thumbnail = await options.fetchThumbnail(thumbUrl);
            } else {
                const fetch = require('node-fetch');
                thumbnail = await fetch(thumbUrl).then(r => r.buffer());
            }
        } catch (e) {
            console.log(chalk.yellow('[Thumbnail fetch failed]'), e.message);
        }

        // Build caption
        const caption = 
            `┏━〔 ✦𓂋⃝⃟⃟⃝⃪⃔ *CODY AI* 〕━━\n\n` +
            `❏▸ *⟁⃝𓋎 Status* ⇆ *ONLINE* ×͜×☠︎︎\n` +
            `❏▸ *彡 Prefix* ⇆ [ ${config.settings?.prefix || '.'} ]\n` +
            `❏▸ *⎔ Mode* ⇆ ${config.status?.public ? 'Public' : 'Private'}\n` +
            `❏▸ *ⓘ Version* ⇆ CODY AI v2.0.0\n` +
            `❏▸ *℘ Owner* ⇆ ${config.settings?.ownerName || 'CRYSNOVA'}\n` +
            `❏▸ *ஃ𖠃 Dashboard* ⇆ http://localhost:${port}\n\n` +
            `⃠⃝⃪⃔⃕ *BOT IS LIVE!* ✧\n` +
            `𓋴 Type *${config.settings?.prefix || '.'}menu* to get started\n\n`;

        // Send with externalAdReply
        if (thumbnail) {
            try {
                await sock.sendMessage(ownerJid, {
                    text: caption,
                    externalAdReply: {
                        title: 'ஃ𖠃 JOIN CODY AI GROUP',
                       body: '╰┈➤ Click to join official group\n𓋴 Get support & updates',
                        thumbnail: thumbnail,
                        largeThumbnail: true,
                        url: GROUP_INVITE_LINK,
                        showAdAttribution: true,
                        mediaType: 1
                    }
                });
                console.log(chalk.green('✅ Connected message sent to owner (with custom image thumbnail)'));
            } catch (e) {
                console.log(chalk.red('[ExternalAdReply failed]'), e.message);
                await sock.sendMessage(ownerJid, { text: caption });
            }
        } else {
            await sock.sendMessage(ownerJid, { text: caption });
            console.log(chalk.green('✅ Connected message sent to owner (text only)'));
        }
        return true;

    } catch (e) {
        console.log(chalk.red('[Connected msg failed]'), e.message);
        return false;
    }
};

// ── Get Group Profile Picture ──
const getGroupProfilePic = async (sock, groupId) => {
    try {
        const ppUrl = await sock.profilePictureUrl(groupId, 'image');
        return ppUrl;
    } catch (err) {
        return DEFAULT_WELCOME_IMG;
    }
};

// ── Get User Profile Picture ──
const getUserProfilePic = async (sock, userId) => {
    try {
        const ppUrl = await sock.profilePictureUrl(userId, 'image');
        return ppUrl;
    } catch (err) {
        return DEFAULT_WELCOME_IMG;
    }
};

// ── Setup Group Welcome/Goodbye Events ──
const setupGroupEvents = async (sock, ignoredErrors = []) => {
    require('../src/Commands/Admin/antiraid').restoreTemporaryApprovals(sock).catch(error => {
        console.error('[ANTIRAID RESTORE ERROR]', error?.stack || error?.message || error);
    });
    sock.ev.on('group-participants.update', async (update) => {
        try {
            await require('../src/Commands/Admin/antiraid').handleParticipantUpdate(sock, update);
        } catch (error) {
            console.error('[ANTIRAID JOIN EVENT]', error?.stack || error?.message || error);
        }
        try {
            require('../src/Commands/Admin/antinewcomer').handleParticipantUpdate(update);
        } catch (error) {
            console.error('[ANTINEWCOMER JOIN EVENT]', error?.message || error);
        }
        try {
            const evDBPath = path.join(process.cwd(), 'database/groupEvents.json');
            if (!fs.existsSync(evDBPath)) return;
            
            const evDB = JSON.parse(fs.readFileSync(evDBPath, 'utf8'));
            if (!evDB[update.id]?.enabled) return;
            
            const meta = await sock.groupMetadata(update.id);
            const count = meta.participants.length;
            const subject = meta.subject;
            
            // Get group profile picture for background
            const groupPic = await getGroupProfilePic(sock, update.id);
            
            for (const participant of update.participants) {
                const jid = typeof participant === 'string' ? participant : participant.id;
                const jidNum = jid.split('@')[0];
                
                // Get user profile picture
                const userPic = await getUserProfilePic(sock, jid);
                
                // ── WELCOME MESSAGE ──
                if (update.action === 'add') {
                    const welcomeMsg = evDB[update.id].welcome || 'Welcome to the group!';
                    
                    await sock.sendMessage(update.id, {
                        image: { url: userPic || groupPic },
                        caption: `┏━〔 ✦𓂋⃝⃟⃟⃝⃪⃔ *WELCOME* 〕━━\n\n` +
                                 `❏┃ @${jidNum}\n` +
                                 `❏┃ ⓘ Joined *${subject}*\n` +
                                 `❏┃ *ஃ𖠃 Members:* ${count}\n` +
                                 `❏┃ 𓀀 ${welcomeMsg}\n\n` +
                                 ` Enjoy your stay! ✧‎\n` +
                                 `( ͡❛ ₃ ͡❛)\n` +
                                 `━━━━━━━━━━━━━━━━━`,
                        mentions: [jid]
                    });
                }
                
                // ── GOODBYE MESSAGE ──
                if (update.action === 'remove') {
                    const goodbyeMsg = evDB[update.id].goodbye || 'Goodbye!';
                    
                    await sock.sendMessage(update.id, {
                        image: { url: userPic || groupPic },
                        caption: `┏━〔 ✦⃠⃝⃪⃔⃕ *GOODBYE* 〕━━\n\n` +
                                 `❏┃ @${jidNum}\n` +
                                 `❏┃ ⓘ Left *${subject}*\n` +
                                 `❏┃ *ஃ𖠃 Members:* ${count}\n` +
                                 `❏┃ 𓀀 ${goodbyeMsg}\n\n` +
                                 ` We'll miss you! ✧‎\n` +
                                 `( ͡❛ ₃ ͡❛)\n` +
                                 `━━━━━━━━━━━━━━━━━`,
                        mentions: [jid]
                    });
                }
            }
        } catch (e) {
            if (!ignoredErrors.some(ie => e.message?.includes(ie)))
                console.log('[Group Events Error]', e.message);
        }
    });
    
    console.log(chalk.green('✅ Group welcome/goodbye events loaded (styled)'));
};

module.exports = { sendConnectedMessage, setupGroupEvents, resolveOwnerJid };
