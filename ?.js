/**
 * ╔══════════════════════════════════════════════════╗
 * ║   - CODY AI          ║
 * ║  Message Routing Engine  
 * ║   This is a property of CRYSNOVA AI/CODY AI all rights reserved 
 * ╚══════════════════════════════════════════════════╝
 */


const chalk = require('chalk');
const { setupStatusHandler } = require('./src/Plugin/statusHandler');
const { getVar }             = require('./src/Plugin/configManager');
const { normalizeDeployButtonMessage } = require('./src/Plugin/deployButtonRouter');

// Polyfill: sock.sendRichText was added as an alias for sock.sendMessage
// to support chatbot responses that call sock.sendRichText(jid, { text }).
const SEND_RICH_TEXT_POLYFILL = function sendRichText(jid, content, opts) {
    return this.sendMessage(jid, content, opts);
};

const styles  = require("./src/Commands/Core/'.js");
const botFont = require('./src/Commands/Bot/botfont.js');

const { translate } = require('./src/Commands/Core/✐.js');
const { getLang }   = require('./src/Commands/Bot/botlang.js');
const { setupMuteSchedules } = require('./src/Commands/Admin/Mute')
//setupMuteSchedules(sock)

// plogme integration — internal processing AI (@crysnovax—FIX08-07-26)
const plogmeCmd = require('./src/Commands/Core/plogme.js');
const legacyChatbot = require('./src/Commands/Core/❚.js');
const { handleChatbotCompatibility } = require('./src/Commands/AI/chatbot-compat.js');

const MARKER = '\u200E';

function configuredNumbers(value) {
    return String(value || '').split(',').map(item => item.replace(/\D/g, '')).filter(Boolean);
}

function directCallbackAuthorization(message) {
    const senderCandidates = [message?.sender, message?.key?.participant, message?.key?.participantAlt, message?.key?.remoteJid].filter(Boolean);
    const senderNumbers = senderCandidates.map(item => String(item).split('@')[0].replace(/\D/g, '')).filter(Boolean);
    const ownerNumbers = configuredNumbers(process.env.OWNER_NUMBER || getVar('OWNER_NUMBER', ''));
    const sudoNumbers = configuredNumbers(process.env.SUDO_NUMBERS || getVar('SUDO_NUMBERS', ''));
    const dualNumbers = configuredNumbers(process.env.DUAL_NUMBERS || getVar('DUAL_NUMBERS', ''));
    const matches = list => senderNumbers.some(sender => list.some(target => sender === target || sender.endsWith(target) || target.endsWith(sender)));
    const isOwner = matches(ownerNumbers);
    return { isOwner, isSudo: isOwner || matches(sudoNumbers), isDual: isOwner || matches(dualNumbers) };
}

// plogme dedupe set
const _plogmeHandled = new Set();
setInterval(() => _plogmeHandled.clear(), 60_000);

const translationCache = new Map();
const CACHE_TTL = 3600000;

// Message TTL: 48 hours in milliseconds
const MESSAGE_TTL = 48 * 60 * 60 * 1000;

const ignoredErrors = [
    'Socket connection timeout', 'EKEYTYPE', 'item-not-found',
    'rate-overlimit', 'Connection Closed', 'Timed Out', 'Value not found',
    'Bad MAC', 'decrypt error', 'Socket closed', 'Session closed',
    'Connection terminated', 'read ECONNRESET', 'write ECONNRESET',
    'ECONNREFUSED', 'connect ETIMEDOUT', 'network timeout'
];

module.exports = function setupMessageHandler(sock, customStore, handleMessage, smsg, io, config) {

    // carry uptime over from an update restart (@crysnovax—FIX06-08-26)
    try {
        if (global.crysStats) require('./src/Plugin/uptime').restoreOnBoot(global.crysStats);
    } catch (e) {}

    // live console streaming → web panel (Render-style console) (@crysnovax—FIX09-08-26)
    try { require('./src/Plugin/consoleBridge').setupConsoleBridge(io); } catch (e) { console.error('[CONSOLE BRIDGE] init error:', e.message); }

    // restore pending temp kicks + start join-request auto-approval (@crysnovax—FIX06-08-26)
    try { require('./src/Plugin/tkick').setupTkicks(sock); } catch (e) { console.error('[TKICK] restore error:', e.message); }
    try { require('./src/Plugin/autoApprove').setupAutoApprove(sock); } catch (e) { console.error('[AUTO-APPROVE] init error:', e.message); }

const originalSend = sock.sendMessage.bind(sock);
sock.sendMessage = async (jid, content, options = {}) => {
    try {
        if (jid === 'status@broadcast') {
            return originalSend(jid, content, options);
        }

        const processText = async (inputText) => {
            if (!inputText || typeof inputText !== 'string') return inputText;
            let text = inputText;

            const targetLang = getLang(jid);
            if (targetLang && text.trim().length > 0) {
                const skipPatterns = ['.setlang', '.tr', 'Usage:'];
                if (!skipPatterns.some(p => text.includes(p))) {
                    const cacheKey = `${text}|${targetLang}`;
                    let translatedText = translationCache.get(cacheKey);
                    if (!translatedText) {
                        try {
                            const result = await translate(text, targetLang);
                            if (result?.translated) {
                                translatedText = result.translated;
                                translationCache.set(cacheKey, translatedText);
                                setTimeout(() => translationCache.delete(cacheKey), CACHE_TTL);
                            }
                        } catch (err) {
                            console.error('[TRANSLATE ERROR]', err.message);
                        }
                    }
                    if (translatedText) text = translatedText;
                }
            }

            const font = botFont.getFont(jid);
            if (font && styles[font]) {
                text = styles[font](text);
            }
            return text;
        };

        if (content?.text) {
            content.text = await processText(content.text);
            content.text = (content.text || '') + MARKER;
        }

        if (content?.caption) {
            content.caption = await processText(content.caption);
            content.caption = (content.caption || '') + MARKER;
        }

        const aiEnabled = getVar('AI_BADGE', true);
        let isPrivateChat = false;
        const jidStr = typeof jid === 'string' ? jid : (Array.isArray(jid) ? jid[0] : '');
        if (jidStr) {
            isPrivateChat = (jidStr.endsWith('@s.whatsapp.net') || jidStr.endsWith('@lid')) 
                         && !jidStr.includes('@g.us');
        }
        if (aiEnabled && isPrivateChat) {
            content.ai = true;
        }
        // secured meta service label — toggleable via .ssl / .tssl
        // (@crysnovax—FIX08-07-26)
        content.secureMetaServiceLabel = getVar('SECURE_META_LABEL', true);

        // ─────────────────────────────────────────────────────────────
       
        // ─────────────────────────────────────────────────────────────
        const isMediaMessage = !!(
            content?.image ||
            content?.video ||
            content?.caption
        );

        if (isMediaMessage && !options.skipVerified) {
            // Library now handles the verified badge context + synthetic
            // quoted fallback internally via the verifiedMe flag
            content.verifiedMe = true;
        }

    } catch (err) {
        console.error('[SEND OVERRIDE ERROR]', err.message);
    }
    return originalSend(jid, content, options);
};

    setupStatusHandler(sock);

    // Polyfill: attach sendRichText to sock so eval/commands can call it
    if (!sock.sendRichText) {
        sock.sendRichText = function sendRichText(jid, content, opts) {
            return this.sendMessage(jid, content, opts);
        };
    }

const { patchGroupEvents } = require('./src/Plugin/groupEventsPatch');
patchGroupEvents(sock);

const { setupPromotionGuard } = require('./src/Plugin/promotionGuard');
setupPromotionGuard(sock);

    const econ = require('./src/Commands/Economy/econ.js');
  //  econ.startNotifChecker(sock);

    try {
        const autonews = require('./src/Commands/Owner/ཽ.js');
        autonews.startAutoNews(sock);
    } catch (err) {
        console.error('[AUTONEWS] Init error:', err.message);
    }

    sock.ev.on('call', async (calls) => {
        try {
            const {
                loadConfig, saveConfig, isWithinSchedule,
                isInBlacklist, isInWhitelist, normalizeJid
            } = require('./src/Plugin/anticallManager');

            const config = loadConfig();

            // Whitelist & blacklist are ALWAYS active (as documented) — the
            // global switch only gates unknown callers, so `.anticall reason`
            // works even when global block-unknowns is off.
            // (@crysnovax—FIX08-07-26)
            if (!config.pendingPhoneReject) config.pendingPhoneReject = [];

            const ownerJid = `${config.owner || process.env.OWNER_NUMBER}@s.whatsapp.net`;

            for (const call of calls) {
                if (call.status !== 'offer') continue;

                const callerJid = call.from;
                const normalizedCaller = normalizeJid(callerJid);
                const phoneMatch = normalizedCaller.match(/^(\d+)@s\.whatsapp\.net$/);
                const callerPhone = phoneMatch ? phoneMatch[1] : null;

                if (isInWhitelist(normalizedCaller, config.whitelist)) continue;
                if (isInBlacklist(normalizedCaller, config.blacklist)) {
                    await sock.sendMessage(callerJid, { text: config.reason }).catch(() => {});
                    if (typeof sock.rejectCall === 'function') await sock.rejectCall(call.id, call.from).catch(() => {});
                    continue;
                }

                // Global switch controls unknown callers only
                if (!config.enabled) continue;

                if (callerPhone && config.pendingPhoneReject.includes(callerPhone)) {
                    config.blacklist = config.blacklist.filter(b => normalizeJid(b) !== `${callerPhone}@s.whatsapp.net`);
                    if (!config.blacklist.includes(normalizedCaller)) config.blacklist.push(normalizedCaller);
                    config.pendingPhoneReject = config.pendingPhoneReject.filter(p => p !== callerPhone);
                    saveConfig(config);
                }

                if (!isWithinSchedule(config.schedule)) continue;

                let reasonToSend = config.reason;
                let isUnknown = false;
                if (!callerPhone || !config.pendingPhoneReject.includes(callerPhone)) {
                    isUnknown = true;
                    reasonToSend = config.unknownReason || config.reason;
                }

                await sock.sendMessage(callerJid, { text: reasonToSend }).catch(() => {});
                if (typeof sock.rejectCall === 'function') await sock.rejectCall(call.id, call.from).catch(() => {});

                if (isUnknown) {
                    const dmMsg = `📵 *Unknown call blocked*\nCaller JID: \`${normalizedCaller}\`\n\n_To block: *.anticall reject add ${normalizedCaller}*_\n_To whitelist: *.anticall whitelist [...]`;
                    await sock.sendMessage(ownerJid, { text: dmMsg }).catch(() => {});
                }
            }
        } catch (err) {
            console.error('[ANTICALL ERROR]', err.message);
        }
    });

    try {
        const vv = require('./src/Commands/Converter/view-once.js');
        if (vv?.setup) vv.setup(sock, customStore);
    } catch {}

    try {
        const muteCmd = require('./src/Commands/Admin/Mute.js');
        if (muteCmd?.setupMuteSchedules) muteCmd.setupMuteSchedules(sock);
    } catch {}

    sock.ev.on('presence.update', ({ id, presences }) => {
        if (!global.onlineUsers) global.onlineUsers = new Set();
        for (const [jid, presence] of Object.entries(presences)) {
            if (['available', 'composing', 'recording'].includes(presence.lastKnownPresence)) {
                global.onlineUsers.add(jid);
            } else {
                global.onlineUsers.delete(jid);
            }
        }
    });

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek || !mek.message) return;
            if (mek.key?.remoteJid === 'status@broadcast') return;

            if (mek.message.ephemeralMessage) {
                mek.__rawMessage = mek.message;
                mek.message = mek.message.ephemeralMessage.message;
            }

            const m = await smsg(sock, mek, customStore);
            if (!m) return;

            // CODY emits its own RichMenu and richResponse messages when
            // emitOwnEvents is enabled. Those outgoing envelopes contain the
            // same CTA/table text as the menu and must never be interpreted as
            // a new button tap. Real self-chat taps arrive as conversation or
            // interactive-response messages, not richResponse envelopes.
            const ownRichResponse = Boolean(mek.key?.fromMe && (
                mek.message?.richResponseMessage ||
                mek.message?.botForwardedMessage?.message?.richResponseMessage
            ));
            // Native rich grids can be emitted as a `cards` envelope rather
            // than richResponseMessage. In self-chat that envelope is echoed
            // back as fromMe; parsing its poolcard button IDs as a new command
            // caused the Gen4 deploy fallback to answer every pool message.
            const ownRichCard = Boolean(mek.key?.fromMe && (
                mek.message?.cards ||
                mek.message?.botForwardedMessage?.message?.cards
            ));
            if (ownRichResponse || ownRichCard) return;

            // Gen4 diagnostic: prove whether WhatsApp delivered the tap and
            // expose the exact Baileys envelope before downstream plugins run.
            const rawGen4Command = normalizeDeployButtonMessage(mek.message);
            if (rawGen4Command) {
                m.body = rawGen4Command;
                m.text = rawGen4Command;
                console.log('[GEN4 TRACE]', JSON.stringify({
                    command: rawGen4Command,
                    fromMe: Boolean(mek.key?.fromMe),
                    mtype: m.mtype,
                    chat: m.chat,
                    messageKeys: Object.keys(mek.message || {})
                }));

                // Rich-menu CTA replies can bypass normal command parsing, so
                // route them directly only after applying the same identity
                // restriction required by the owning command.
                try {
                    const callbackAuth = directCallbackAuthorization(m);
                    if (!callbackAuth.isOwner && !callbackAuth.isSudo && !callbackAuth.isDual) {
                        await sock.sendMessage(m.chat, { text: 'Owner, sudo, or dual users only.' }, { quoted: m });
                        return;
                    }
                    const directArgs = rawGen4Command.replace(/^\.(?:deploy|poolcard)\s*/i, '').trim().split(/\s+/).filter(Boolean);
                    const directReply = text => sock.sendMessage(m.chat, { text: String(text) }, { quoted: m });
                    if (/^\.poolcard\b/i.test(rawGen4Command)) {
                        const poolcard = require('./src/Commands/Owner/poolcard.js');
                        await poolcard.execute(sock, m, {
                            args: directArgs,
                            text: directArgs.join(' '),
                            command: 'poolcard',
                            prefix: '.',
                            reply: directReply,
                            isOwner: callbackAuth.isOwner,
                            isSudo: callbackAuth.isSudo,
                            isDual: callbackAuth.isDual,
                            isGroup: m.isGroup,
                            store: customStore
                        });
                    } else {
                        const deploy = require('./src/Commands/System/deploy.js');
                        const deployArgs = rawGen4Command.replace(/^\.deploy\s*/i, '').trim().split(/\s+/).filter(Boolean);
                        await deploy.execute(sock, m, {
                            args: deployArgs,
                            text: deployArgs.join(' '),
                            command: 'deploy',
                            prefix: '.',
                            reply: directReply,
                            isOwner: callbackAuth.isOwner,
                            isSudo: callbackAuth.isSudo,
                            isDual: callbackAuth.isDual,
                            isGroup: m.isGroup,
                            store: customStore
                        });
                    }
                    return;
                } catch (err) {
                    console.error('[GEN4 DIRECT LISTENER ERROR]', err.message);
                }
            }

            // ── SAVE MODE — auto-block unsaved contacts that DM the bot (@crysnovax—FIX06-08-26) ──
            try {
                if (getVar('SAVE_MODE', false)) {
                    const savemode = require('./src/Commands/Owner/savemode.js');
                    if (savemode?.handleSaveMode) {
                        const wasBlocked = await savemode.handleSaveMode(sock, m, customStore);
                        if (wasBlocked) return;
                    }
                }
            } catch {}

            try {
                const antiedit = require('./src/Commands/Tools/antiedit.js');
                if (antiedit?.cacheOriginal) antiedit.cacheOriginal(mek.key.id, mek.message);
            } catch (err) {}

            const shouldAutoRead = m.isGroup
                ? getVar('AUTO_READ_GROUP', false)
                : getVar('AUTO_READ', false);
            if (shouldAutoRead) {
                await sock.readMessages([mek.key]).catch(() => {});
            }

            // ========== STORE MESSAGE WITH TIMESTAMP (48 HOUR TTL) ==========
            if (mek.key?.remoteJid && mek.key?.id) {
                customStore.messages.set(mek.key.remoteJid + ':' + mek.key.id, {
                    message: mek,
                    timestamp: Date.now()
                });
            }

            try {
                const antidelete = require('./src/Commands/Tools/antidelete.js');
                if (antidelete?.cacheMessage) antidelete.cacheMessage(mek);
            } catch {}

            global.crysStats.messages++;

            io.emit('new-message', {
                from: m.sender,
                chat: m.chat,
                text: m.text || '[Media]',
                isGroup: m.isGroup,
                time: Date.now()
            });
//WARNING ⚠️ PLEASE DON'T UNCOMMENT NO MATTER WHO 
        //   if (m.text && m.text.startsWith('\u200E\u200E\u200E\u200E\u200E') && m.isGroup) {
        //       try {
                //    const metadata = await sock.groupMetadata(m.chat);
            //        const participants = metadata.participants.map(p => p.id);
        //           if (participants.length) {
               //         await sock.sendMessage(m.chat, {
                      //     text: m.text.slice(2) || '\u200E',
     //                      mentions: participants
              //       }, { quoted: m });
           //      }
      //          } catch {}
             //   return;
       //     }

            try {
                const mutePlugin = require('./src/Commands/Group/muteuser.js');
                if (mutePlugin?.handleMutedMessage) {
                    const wasDeleted = await mutePlugin.handleMutedMessage(sock, m, m.isGroup);
                    if (wasDeleted) return;
                }
            } catch {}

            // full sticker mute per user (@crysnovax—FIX06-08-26)
            try {
                const muteallsticker = require('./src/Commands/Group/muteallsticker.js');
                if (muteallsticker?.handleMutedSticker) {
                    const wasDeleted = await muteallsticker.handleMutedSticker(sock, m, m.isGroup);
                    if (wasDeleted) return;
                }
            } catch {}

            // single-sticker ban — only that exact sticker gets deleted (@crysnovax—FIX06-08-26)
            try {
                const mutesticker = require('./src/Commands/Group/mutesticker.js');
                if (mutesticker?.handleMutedSticker) {
                    const wasDeleted = await mutesticker.handleMutedSticker(sock, m, m.isGroup);
                    if (wasDeleted) return;
                }
            } catch {}

            try {
                const typingMode = getVar('FAKE_TYPING', 'off');
                if (typingMode === 'all') {
                    await sock.sendPresenceUpdate('composing', m.key.remoteJid);
                } else if (typingMode === 'cmd') {
                    const bodyCheck = (mek.message?.conversation || mek.message?.extendedTextMessage?.text || '').trim();
                    const prefixCheck = getVar('PREFIX', '.');
                    if (bodyCheck.startsWith(prefixCheck)) {
                        await sock.sendPresenceUpdate('composing', m.key.remoteJid);
                    }
                }
            } catch {}

            try {
                const autoRecording = getVar('AUTO_RECORDING', config?.mode?.autoRecording ?? false);
                if (autoRecording) {
                    await sock.sendPresenceUpdate('recording', m.key.remoteJid);
                }
            } catch {}
            // Welcome Flow - new contact greeting
try {
    const greet = require('./src/Commands/Bot/greet.js');
    // Check if this is a new contact
    const isGroup = m.key?.remoteJid?.includes('@g.us');
    const sender = m.sender;
    await greet.handleNewContact(sock, sender, isGroup);
    
    // Handle greet button clicks
    const handled = await greet.handleGreetButton(sock, m);
    if (handled) return;
} catch {}

            // ========== AFK SYSTEM ==========
            const afkCmd = require('./src/Commands/Owner/afk.js');
            const AFK_MARKER = afkCmd.MARKER;
           
            if (m.mtype === 'reactionMessage') return;
            if (m.body && m.body.includes(AFK_MARKER)) return;

            const _afkSender = await afkCmd.resolveSenderPhoneJid(sock, m);
            if (_afkSender && afkCmd.disableAfk(_afkSender, m.chat)) {
                await sock.sendMessage(m.chat, { text: '```Welcome back!```' + AFK_MARKER }, { quoted: m });
            }

            const afkUser = await afkCmd.isAfkUserMentioned(m, mek, sock);
            const senderIsAfkUser = afkUser && await afkCmd.isSameIdentity(sock, afkUser, _afkSender);
            if (afkUser && !senderIsAfkUser) {
                const data = afkCmd.getAfk(afkUser, m.chat);
                if (data) {
                    const elapsed = Date.now() - data.timestamp;
                    const mins = Math.floor(elapsed / 60000);
                    const hrs = Math.floor(mins / 60);
                    const days = Math.floor(hrs / 24);
                    let timeAgo = '';
                    if (days > 0) timeAgo = `${days}d ${hrs % 24}h`;
                    else if (hrs > 0) timeAgo = `${hrs}h ${mins % 60}m`;
                    else timeAgo = `${mins}m`;

                    const notice = `╭─❍ *AFK NOTICE* 𓉤\n│\n│ 𓃼 @${afkUser.split('@')[0]}\n│ ⓘ Reason : ${data.reason}\n│ 𓄄 Last seen : ${timeAgo} ago\n│ ✐ Mentions : [...]`;
                    await sock.sendMessage(m.chat, { text: notice + AFK_MARKER, mentions: [afkUser] }, { quoted: m });
                    afkCmd.incrementMention(afkUser, m.chat);
                }
            }

            try {
                const antitag = require('./src/Commands/Admin/antitag.js');
                if (antitag?.handleAntiTag) await antitag.handleAntiTag(sock, m);
            } catch {}

            // ── DND — delete + reply when the bot is tagged (@crysnovax—FIX06-08-26) ──
            try {
                const dnd = require('./src/Commands/Group/dnd.js');
                if (dnd?.handleDndTag) await dnd.handleDndTag(sock, m);
            } catch {}

            // ── STICKER COMMAND HANDLER (dynamic prefix) ──
            try {
                if (m.mtype === 'stickerMessage') {
                    const { stickerCmds } = require('./src/Commands/Owner/setcmd.js');
                    const stickerData = m.message?.stickerMessage;
                    const fileSha256 = stickerData?.fileSha256;
                    if (fileSha256) {
                        const hash = Buffer.isBuffer(fileSha256) ? fileSha256.toString('hex') : String(fileSha256);
                        if (hash && stickerCmds[hash]) {
                            const boundCmd = stickerCmds[hash];
                            console.log(`[STICKER CMD] ${m.sender.split('@')[0]} -> ${boundCmd}`);
                            const cmdPrefix = getVar('PREFIX', '.');
                            m.body = `${cmdPrefix}${boundCmd}`;
                            m.text = `${cmdPrefix}${boundCmd}`;
                        }
                    }
                }
            } catch {}

            // ── EMOJI COMMAND HANDLER (dynamic prefix) ──
            try {
                const { emojiCmds } = require('./src/Commands/Owner/setemoji.js');
                let msgText = '';
                if (mek.message?.conversation) msgText = mek.message.conversation.trim();
                else if (mek.message?.extendedTextMessage?.text) msgText = mek.message.extendedTextMessage.text.trim();
                else msgText = (m.body || m.text || '').trim();

                const cleanText = msgText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
                const matchedCmd = emojiCmds[cleanText] || emojiCmds[msgText];
                if (matchedCmd) {
                    console.log(`[EMOJI CMD] ${m.sender.split('@')[0]} emoji -> ${matchedCmd}`);
                    const cmdPrefix = getVar('PREFIX', '.');
                    m.body = `${cmdPrefix}${matchedCmd}`;
                    m.text = `${cmdPrefix}${matchedCmd}`;
                }
            } catch {}

            try {
                const antispam = require('./src/Commands/Admin/antispam.js');
                if (antispam?.handleAntiSpam) await antispam.handleAntiSpam(sock, m);
            } catch (err) { console.error('[ANTISPAM ERROR]', err.message); }

            try {
                const mention = require('./src/Commands/Owner/mention.js');
                const { mentionConfig } = mention;
                if (mentionConfig.active && await mention.isPrivilegedMentioned(sock, m, mek)) {
                    if (mentionConfig.action === 'react' && mentionConfig.emoji) {
                        await sock.sendMessage(m.chat, { react: { text: mentionConfig.emoji, key: m.key } }).catch(() => {});
                    } else if (mentionConfig.action === 'text' && mentionConfig.text) {
                        await sock.sendMessage(m.chat, { text: mentionConfig.text }, { quoted: m }).catch(() => {});
                    }
                }
            } catch (error) {
                console.error('[MENTION HANDLER]', error.message);
            }

            try {
                const { handleShazamReply } = require('./src/Commands/Search/shazam.js');
                const shazamReply = (txt) => sock.sendMessage(m.chat, { text: txt }, { quoted: m });
                const handled = await handleShazamReply(sock, m, shazamReply);
                if (handled) return;
            } catch {}

            try {
                const autoreact = require('./src/Commands/Owner/autoreact.js');
                if (autoreact.isEnabled() && !m.key.fromMe && m.text) {
                    const randomEmoji = autoreact.getRandomEmoji();
                    await sock.sendMessage(m.chat, { react: { text: randomEmoji, key: m.key } }).catch(() => {});
                }
            } catch (err) { console.error('[AUTOREACT ERROR]', err.message); }

            try {
                const antiword = require('./src/Commands/Admin/antiword.js');
                if (antiword?.handleAntiWord) await antiword.handleAntiWord(sock, m, mek);
            } catch (err) { console.error('[ANTIWORD ERROR]', err.message); }

            try {
                const sscmd = require('./src/Commands/Owner/⎔.js');
                if (sscmd?.handleSSReply) await sscmd.handleSSReply(sock, m);
            } catch {}

            try {
                const ttt = require('./src/Commands/Games/ttt.js');
                if (ttt?.handleGameReply) {
                    const handled = await ttt.handleGameReply(sock, m);
                    if (handled) return;
                }
            } catch {}

            // ── PLOGME: block toggled-off commands BEFORE the router runs ──
            // PLOGME's own names are NEVER blocked here — ".plogme on/off"
            // must always reach the plogme handler, otherwise the toggle
            // dead-locks and every ".plogme ..." spams the block notice.
            try {
                const prefixCheck = getVar('PREFIX', '.');
                const bodyCheck = (mek.message?.conversation || mek.message?.extendedTextMessage?.text || '').trim();
                if (bodyCheck.startsWith(prefixCheck)) {
                    const cmdName = bodyCheck.slice(prefixCheck.length).trim().split(/\s+/)[0].toLowerCase();
                    if (cmdName && !['plogme', 'plg', 'plog'].includes(cmdName) && plogmeCmd.isCommandToggled(cmdName)) {
                        await sock.sendMessage(m.chat, { text: `_*⛔ .${cmdName} is toggled OFF by plogme*_` }, { quoted: m });
                        return;
                    }
                }
            } catch {}

            // Run passive moderation and view-once hooks before command/chatbot
            // handlers can short-circuit the event. These hooks inspect ordinary
            // messages; command messages remain handled by handleMessage below.
            try { await require('./src/Commands/Admin/antigm.js').handleAntiGM?.(sock, m, mek); } catch (err) { console.error('[ANTIGM ERROR]', err.message); }
            try { await require('./src/Commands/Admin/antigroupstatus.js').handleAntiGroupStatus?.(sock, m, mek); } catch (err) { console.error('[ANTIGROUPSTATUS ERROR]', err.message); }
            try { await require('./src/Commands/Admin/antibot.js').handleAntiBot?.(sock, m, mek); } catch (err) { console.error('[ANTIBOT ERROR]', err?.stack || err?.message || String(err)); }
            try { await require('./src/Commands/Admin/antivv.js').handleAntiVV?.(sock, m, mek); } catch (err) { console.error('[ANTIVV ERROR]', err.message); }
            try { await require('./src/Commands/Admin/antiforward.js').handleAntiForward?.(sock, m, mek); } catch (err) { console.error('[ANTIFORWARD ERROR]', err.message); }
            try { await require('./src/Commands/Admin/antilink.js').handleAntiLink?.(sock, m, mek); } catch (err) { console.error('[ANTILINK ERROR]', err.message); }
            try { await require('./src/Commands/Converter/view-once.js').handleAutoVV?.(sock, m, mek); } catch (err) { console.error('[AUTOVV ERROR]', err.message); }
            try { await require('./src/Commands/Converter/vvcmd.js').handleVVReply?.(sock, m); } catch (err) { console.error('[VV ERROR]', err.message); }

            await handleMessage(sock, m, customStore);

            // --- plogme hook (dedupe + short-circuit) — runs BEFORE the old
            //     chatbot brain so plogme takes priority when it handles ---
            try {
                const messageId = mek?.key?.id || (mek?.key?.remoteJid + ':' + (Date.now()));
                if (!_plogmeHandled.has(messageId)) {
                    const plogmeHandled = await plogmeCmd.execute(sock, m, {
                        reply: async (txt) => {
                            try { await sock.sendMessage(m.chat, { text: String(txt || '') + MARKER }, { quoted: m }); } catch (e) {}
                        },
                        sendMessage: async (jid, content, opts) => {
                            try { await sock.sendMessage(jid, content, opts); } catch (e) {}
                        }
                    });
                    if (plogmeHandled) {
                        _plogmeHandled.add(messageId);
                        return; // short-circuit other handlers
                    }
                }
            } catch (err) {
                console.error('[PLOGME HOOK ERROR]', err?.message || err);
            }

            // ── Legacy chatbot compatibility ─────────────────────────────
            // Existing users who enabled `.chatbot on` still receive the
            // legacy Core chatbot. It is skipped whenever PLOGME is enabled
            // for this chat, preventing duplicate automatic replies.
            try {
                const legacyHandled = await handleChatbotCompatibility(
                    sock,
                    m,
                    customStore,
                    { legacy: legacyChatbot, active: plogmeCmd }
                );
                if (legacyHandled) return;
            } catch (err) {
                console.error('[CHATBOT COMPAT ERROR]', err?.message || err);
            }

            try {
                if (m.isGroup && m.mentionedJid?.length) {
                    const botJid = (sock.user?.id || '').replace(/:\d+@/, '@');
                    const tagged = m.mentionedJid.some(j => j.replace(/:\d+@/, '@') === botJid);
                    if (tagged) {
                        const emoji = getVar('TAG_REACT_EMOJI') || process.env.TAG_REACT_EMOJI || '';
                        if (emoji) await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } }).catch(() => {});
                    }
                }
            } catch {}

        } catch (err) {
            if (!ignoredErrors.some(e => err.message?.includes(e))) {
                console.log(chalk.red('[MSG ERROR]'), err.message);
            }
        }
    });

    sock.ev.on('messages.update', async (updates) => {
        try {
            const antidelete = require('./src/Commands/Tools/antidelete.js');
            if (antidelete?.onDelete) await antidelete.onDelete(sock, updates, customStore);
        } catch {}
        try {
            const antiedit = require('./src/Commands/Tools/antiedit.js');
            if (antiedit?.onEdit) await antiedit.onEdit(sock, updates, customStore);
        } catch {}
        try {
            const quoted = require('./library/quoted.js');
            if (quoted?.onDelete) await quoted.onDelete(sock, updates, customStore);
        } catch {}
    });

    // ========== AUTO-CLEANUP EXPIRED MESSAGES (48 HOUR TTL) ==========
    setInterval(() => {
        const now = Date.now();
        let cleanedCount = 0;
        if (customStore.messages) {
            for (const [key, value] of customStore.messages.entries()) {
                if (value.timestamp && (now - value.timestamp) > MESSAGE_TTL) {
                    customStore.messages.delete(key);
                    cleanedCount++;
                } else if (!value.timestamp) {
                    // For old messages without timestamp, remove them
                    customStore.messages.delete(key);
                    cleanedCount++;
                }
            }
            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned ${cleanedCount} expired messages from store (48h TTL)`);
            }
        }
    }, 60 * 60 * 1000); // Run every hour
};

setInterval(() => {
    try {
        const quoted = require('./library/quoted.js');
        if (quoted?.cleanUp) quoted.cleanUp();
    } catch {}
}, 60000);
