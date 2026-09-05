/**
 * ╔══════════════════════════════════════════════════╗
 * ║   - CODY AI          ║
 * ║  Anti-Delete Handler (FULLY FIXED)
 * ╚══════════════════════════════════════════════════╝
 */

const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('plogme');

const DB = path.join(__dirname, '../../database/antidelete.json');
if (!fs.existsSync(DB)) fs.writeFileSync(DB, '{}');

const getDB = () => JSON.parse(fs.readFileSync(DB));
const saveDB = (data) => fs.writeFileSync(DB, JSON.stringify(data, null, 2));
const DIV = '─────────────────';

// ✅ NEW: In-memory cache for deleted messages (since store might miss them)
const messageCache = new Map();

function getTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
}

function getDisplayName(msgObj, jid) {
    return msgObj?.pushName || jid?.split('@')[0] || 'Unknown';
}

function resolveType(message) {
    if (!message) return null;
    const types = [
        'imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage',
        'documentMessage', 'contactMessage', 'extendedTextMessage',
        'locationMessage', 'conversation'
    ];
    return types.find(type => message[type]) || null;
}

async function downloadMedia(message, type) {
    try {
        const typeMap = {
            'imageMessage': 'image',
            'videoMessage': 'video',
            'audioMessage': 'audio',
            'documentMessage': 'document',
            'stickerMessage': 'sticker'
        };
        const mediaType = typeMap[type];
        if (!mediaType) return null;

        const stream = await downloadContentFromMessage(message[type], mediaType);
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    } catch {
        return null;
    }
}

async function buildCaption(sock, msgObj, chatJid, isGroup) {
    // ✅ FIXED: Try multiple sources for sender
    let participant = msgObj?.key?.participant || msgObj?.key?.remoteJid;

    // Fallback: extract from message content
    if (!participant && msgObj?.message) {
        const msgTypes = Object.keys(msgObj.message);
        for (const type of msgTypes) {
            const content = msgObj.message[type];
            if (content?.contextInfo?.participant) {
                participant = content.contextInfo.participant;
                break;
            }
        }
    }

    if (!participant) {
        return { header: '', footer: '', sender: null };
    }

    const senderNumber = participant.split('@')[0];
    const displayName = getDisplayName(msgObj, participant);
    const timeStr = getTime(msgObj.messageTimestamp || Date.now() / 1000);

    let header = '';
    if (isGroup) {
        let groupName = 'Unknown Group';
        try {
            const metadata = await sock.groupMetadata(chatJid);
            groupName = metadata.subject || groupName;
        } catch {}
        header += `▸ ${groupName}\n`;
    }

    header += `▸ @${senderNumber}`;
    if (displayName !== senderNumber) {
        header += ` (${displayName})`;
    }

    return {
        header: DIV + '\n' + '  ✘  DELETED MESSAGE\n' + (DIV + '\n') + (header + '\n') + '\n' + (DIV + '\n'),
        footer: DIV + '\n\n▸ ' + timeStr,
        sender: participant
    };
}

async function sendDeletedMsg(sock, targetJid, msgObj, chatJid, isGroup) {
    const message = msgObj?.message;
    if (!message) {
       // console.log('[ANTIDELETE] No message content to forward');
        return;
    }

    const msgType = resolveType(message);
    if (!msgType) {
   //     console.log('[ANTIDELETE] Unknown message type');
        return;
    }

    const { header, footer, sender } = await buildCaption(sock, msgObj, chatJid, isGroup);
    
    if (!sender) {
//        console.log('[ANTIDELETE] Could not determine sender, skipping');
        return;
    }

    const mentions = [sender];

    try {
        if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const text = message.conversation || message.extendedTextMessage?.text || '';
            await sock.sendMessage(targetJid, {
                text: header + '  ' + text + '\n' + footer,
                mentions: mentions
            });
            return;
        }

        if (msgType === 'imageMessage') {
            const buffer = await downloadMedia(message, msgType);
            const caption = message.imageMessage?.caption || '';
            if (buffer) {
                await sock.sendMessage(targetJid, {
                    image: buffer,
                    caption: header + '  ' + (caption || '[No caption]') + '\n' + footer,
                    mentions: mentions
                });
            } else {
                await sock.sendMessage(targetJid, {
                    text: header + '  [Image — could not download]\n' + footer,
                    mentions: mentions
                });
            }
            return;
        }

        if (msgType === 'videoMessage') {
            const buffer = await downloadMedia(message, msgType);
            const caption = message.videoMessage?.caption || '';
            if (buffer) {
                await sock.sendMessage(targetJid, {
                    video: buffer,
                    caption: header + '  ' + (caption || '[No caption]') + '\n' + footer,
                    mentions: mentions
                });
            } else {
                await sock.sendMessage(targetJid, {
                    text: header + '  [Video — could not download]\n' + footer,
                    mentions: mentions
                });
            }
            return;
        }

        if (msgType === 'audioMessage') {
            const buffer = await downloadMedia(message, msgType);
            const isPtt = message.audioMessage?.ptt || false;
            if (buffer) {
                await sock.sendMessage(targetJid, {
                    audio: buffer,
                    mimetype: 'audio/mpeg',
                    ptt: isPtt
                });
                await sock.sendMessage(targetJid, {
                    text: header + '  [Voice message]\n' + footer,
                    mentions: mentions
                });
            } else {
                await sock.sendMessage(targetJid, {
                    text: header + '  [Voice — could not download]\n' + footer,
                    mentions: mentions
                });
            }
            return;
        }

        if (msgType === 'stickerMessage') {
            const buffer = await downloadMedia(message, msgType);
            if (buffer) {
                await sock.sendMessage(targetJid, { sticker: buffer });
                await sock.sendMessage(targetJid, {
                    text: header + '  [Sticker]\n' + footer,
                    mentions: mentions
                });
            } else {
                await sock.sendMessage(targetJid, {
                    text: header + '  [Sticker — could not download]\n' + footer,
                    mentions: mentions
                });
            }
            return;
        }

        if (msgType === 'documentMessage') {
            const buffer = await downloadMedia(message, msgType);
            const fileName = message.documentMessage?.fileName || 'document';
            const mimetype = message.documentMessage?.mimetype || 'application/octet-stream';
            if (buffer) {
                await sock.sendMessage(targetJid, {
                    document: buffer,
                    mimetype: mimetype,
                    fileName: fileName,
                    caption: header + '  ' + fileName + '\n' + footer,
                    mentions: mentions
                });
            } else {
                await sock.sendMessage(targetJid, {
                    text: header + '  [Document: ' + fileName + ' — could not download]\n' + footer,
                    mentions: mentions
                });
            }
            return;
        }

        if (msgType === 'contactMessage') {
            const displayName = message.contactMessage?.displayName || 'Unknown';
            await sock.sendMessage(targetJid, {
                text: header + '  [Contact: ' + displayName + ']\n' + footer,
                mentions: mentions
            });
            return;
        }

        if (msgType === 'locationMessage') {
            const { degreesLatitude, degreesLongitude } = message.locationMessage;
            await sock.sendMessage(targetJid, {
                location: { degreesLatitude, degreesLongitude }
            });
            await sock.sendMessage(targetJid, {
                text: header + '  [Location]\n' + footer,
                mentions: mentions
            });
            return;
        }

        await sock.sendMessage(targetJid, {
            text: header + '  [Unsupported message]\n' + footer,
            mentions: mentions
        });

    } catch (err) {
        console.error('[ANTIDELETE SEND ERROR]', err.message);
    }
}

// ── COMMAND HANDLER ──────────────────────────────────────────────────────────
module.exports = {
    name: 'antidelete',
    alias: ['deletedetect'],
    category: 'tools',
    desc: 'Forward deleted messages (text + media) with clean design',

    execute: async (sock, msg, { args, reply }) => {
        const db = getDB();
        const chatId = msg.chat;
        const arg1 = args[0]?.toLowerCase();
        const arg2 = args[1]?.toLowerCase();

        if (!arg1) {
            const chatStatus = db[chatId] ? 'ON' : 'OFF';
            const globalStatus = db['_globalPriv'] ? 'ON' : 'OFF';
            const mode = db['_mode'] || 'dm';

            return reply(
                '╭─❍ *ANTI-DELETE* 𓉤\n' +
                `│ Status     : *${chatStatus}*\n` +
                `│ Global DMs : *${globalStatus}*\n` +
                `│ Send to    : *${mode.toUpperCase()}*\n` +
                '│\n' +
                '│ Commands:\n' +
                '│ .antidelete on\n' +
                '│ .antidelete on all\n' +
                '│ .antidelete off\n' +
                '│ .antidelete off all\n' +
                '│ .antidelete mode dm\n' +
                '│ .antidelete mode chat\n' +
                '╰─────────────────'
            );
        }

        if (arg1 === 'on' && !arg2) {
            db[chatId] = true;
            saveDB(db);
            return reply('`—͟͟͞͞𖣘 ENABLED CHECK DM`');
        }

        if (arg1 === 'on' && arg2 === 'all') {
            db['_globalPriv'] = true;
            saveDB(db);
            return reply('`—͟͟͞͞𖣘 ENABLED for all private chats`');
        }

        if (arg1 === 'off' && !arg2) {
            delete db[chatId];
            saveDB(db);
            return reply('`⟁⃝✘ Anti-delete DISABLED`');
        }

        if (arg1 === 'off' && arg2 === 'all') {
            db['_globalPriv'] = false;
            saveDB(db);
            return reply('`⟁⃝✘ Anti-delete DISABLED for all private chats`');
        }

        if (arg1 === 'mode') {
            if (!arg2 || !['dm', 'chat'].includes(arg2)) {
                return reply('_⚉ Use .antidelete mode dm or .antidelete mode chat_');
            }
            db['_mode'] = arg2;
            saveDB(db);
            return reply(
                arg2 === 'dm' 
                    ? '`—͟͟͞͞𖣘 Deleted messages → sent to your DM`' 
                    : '`—͟͟͞͞𖣘 Deleted messages → sent back to the same chat`'
            );
        }

        reply('_⚉ Unknown. Use .antidelete on/off_');
    },

    // ✅ NEW: Cache message when it arrives
    cacheMessage: (msg) => {
        if (!msg?.key?.id || !msg?.key?.remoteJid) return;
        const cacheKey = msg.key.remoteJid + ':' + msg.key.id;
        messageCache.set(cacheKey, msg);
        // Auto cleanup after 1 hour
        setTimeout(() => messageCache.delete(cacheKey), 60 * 60 * 1000);
    },

    // ── ON DELETE HANDLER (FULLY FIXED) ────────────────────────────────────
    onDelete: async (sock, updates, store) => {
        try {
            const db = getDB();

            for (const update of updates) {
                if (!update || !update.key) {
              //      console.log('[ANTIDELETE] Skipping invalid update (no key)');
                    continue;
                }

                // ✅ FIXED: Check if message was actually deleted
                // message: null means deleted, but also check messageStubType
                const isDeleted = update.update?.message === null || 
                                  update.update?.messageStubType === 1 ||
                                  update.update?.status === 0;

                if (!isDeleted) {
           //         console.log('[ANTIDELETE] Update is not a deletion, skipping');
                    continue;
                }

                const remoteJid = update.key.remoteJid;
                if (!remoteJid) {
          //          console.log('[ANTIDELETE] Skipping update with no remoteJid');
                    continue;
                }

                const isGroup = remoteJid.includes('@g.us');
                const chatEnabled = !!db[remoteJid];
                const globalEnabled = !isGroup && !!db['_globalPriv'];

                if (!chatEnabled && !globalEnabled) {
                  //  console.log(`[ANTIDELETE] Not enabled for ${remoteJid}`);
                    continue;
                }

                // ✅ FIXED: Try multiple sources to get the deleted message
                let msgObj = null;

                // Method 1: Try in-memory cache first (most reliable)
                const cacheKey = remoteJid + ':' + update.key.id;
                msgObj = messageCache.get(cacheKey);
                if (msgObj) {
              //      console.log('[ANTIDELETE] Found message in memory cache');
                }

                // Method 2: Try store.loadMessage
                if (!msgObj && store?.loadMessage) {
                    try {
                        msgObj = await store.loadMessage(remoteJid, update.key.id);
                        if (msgObj) {
                    //        console.log('[ANTIDELETE] Found message in store');
                        }
                    } catch (err) {
                   //     console.log('[ANTIDELETE] Store load failed:', err.message);
                    }
                }

                // Method 3: Try store.messages (your custom store structure)
                if (!msgObj && store?.messages?.get) {
                    msgObj = store.messages.get(cacheKey);
                    if (msgObj) {
                        // Your store wraps message in { message: mek, timestamp }
                        msgObj = msgObj.message || msgObj;
                   //     console.log('[ANTIDELETE] Found message in custom store');
                    }
                }

                if (!msgObj) {
        //            console.log('[ANTIDELETE] Could not find deleted message anywhere');
                    continue;
                }

                // ✅ DEBUG: Log what we found
              //  console.log('[ANTIDELETE DEBUG] msgObj keys:', Object.keys(msgObj));
               // console.log('[ANTIDELETE DEBUG] msgObj.key:', JSON.stringify(msgObj.key));
             //   console.log('[ANTIDELETE DEBUG] has message?', !!msgObj.message);

                const botId = sock.user?.id?.split(':')[0] + '@s.whatsapp.net';
                if (!botId) {
        //            console.log('[ANTIDELETE] Could not get bot ID');
                    continue;
                }

                const mode = db['_mode'] || 'dm';
                const targetJid = mode === 'chat' ? remoteJid : botId;

         //       console.log(`[ANTIDELETE] Forwarding to ${targetJid} (mode: ${mode})`);

                await sendDeletedMsg(sock, targetJid, msgObj, remoteJid, isGroup);

                // Log sender
                let sender = msgObj?.key?.participant || msgObj?.key?.remoteJid;
                if (!sender && msgObj?.message) {
                    const msgTypes = Object.keys(msgObj.message);
                    for (const type of msgTypes) {
                        const content = msgObj.message[type];
                        if (content?.contextInfo?.participant) {
                            sender = content.contextInfo.participant;
                            break;
                        }
                    }
                }
                if (!sender && update?.key?.participant) sender = update.key.participant;
                if (!sender && update?.key?.remoteJid) sender = update.key.remoteJid;

                const senderNum = sender ? sender.split('@')[0] : 'unknown';
        //        console.log(
               //     '[ANTIDELETE] ' + senderNum + ' in ' + 
               //     (isGroup ? 'Group' : 'DM') + ' → ' + mode
             //   );
            }
        } catch (err) {
            console.error('[ANTIDELETE ERROR]', err);
        }
    }
};

                
