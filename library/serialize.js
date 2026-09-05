// © 2026 CRYSNOVA. All Rights Reserved.
// respect the work, don’t just copy-paste.

const {
    jidNormalizedUser,
    proto,
    getContentType,
    areJidsSameUser
} = require("plogme")

const smsg = async (sock, m, store) => {
    if (!m) return m
    
    let M = proto.WebMessageInfo
    
    if (m.key) {
        m.id = m.key.id
        m.from = m.key.remoteJid.startsWith('status') ? jidNormalizedUser(m.key?.participant || m.participant) : jidNormalizedUser(m.key.remoteJid);
        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16
        m.chat = m.key.remoteJid
        m.fromMe = m.key.fromMe
        m.isGroup = m.chat.endsWith('@g.us')
        m.sender = sock.decodeJid(m.fromMe && sock.user.id || m.participant || m.key.participant || m.chat || '')
        if (m.isGroup) m.participant = sock.decodeJid(m.key.participant) || ''
    }
    
    if (m.message) {
        m.mtype = getContentType(m.message)
        
        // Safe message extraction
        m.msg = m.mtype === 'viewOnceMessage' 
            ? (m.message[m.mtype]?.message?.[getContentType(m.message[m.mtype]?.message)] || {})
            : (m.message[m.mtype] || {})
        
        // Safe body / text extraction - no undefined.caption crash
        m.body = ''
        if (m.message?.conversation) m.body = m.message.conversation
        if (m.msg?.caption) m.body = m.msg.caption
        if (m.msg?.text) m.body = m.msg.text
        if (m.mtype === 'listResponseMessage' && m.msg?.singleSelectReply?.selectedRowId) {
            m.body = m.msg.singleSelectReply.selectedRowId
        }
        if (m.mtype === 'buttonsResponseMessage' && m.msg?.selectedButtonId) {
            m.body = m.msg.selectedButtonId
        }
        if (m.mtype === 'viewOnceMessage' && m.msg?.caption) {
            m.body = m.msg.caption
        }
        
        let quoted = m.quoted = m.msg?.contextInfo ? m.msg.contextInfo.quotedMessage : null
        m.mentionedJid = m.msg?.contextInfo?.mentionedJid
            || m.message?.extendedTextMessage?.contextInfo?.mentionedJid
            || m.message?.imageMessage?.contextInfo?.mentionedJid
            || m.message?.videoMessage?.contextInfo?.mentionedJid
            || []
        
        if (m.quoted) {
            let type = getContentType(quoted)
            m.quoted = m.quoted[type] || {}
            
            if (['productMessage'].includes(type)) {
                type = getContentType(m.quoted)
                m.quoted = m.quoted[type] || {}
            }
            
            if (typeof m.quoted === 'string') {
                m.quoted = {
                    text: m.quoted
                }
            }
 
            m.quoted.key = {
                remoteJid: m.msg?.contextInfo?.remoteJid || m.from,
                participant: jidNormalizedUser(m.msg?.contextInfo?.participant),
                fromMe: areJidsSameUser(jidNormalizedUser(m.msg?.contextInfo?.participant), jidNormalizedUser(sock?.user?.id)),
                id: m.msg?.contextInfo?.stanzaId,
            };
            
            m.quoted.mtype = type
            m.quoted.from = /g\.us|status/.test(m.msg?.contextInfo?.remoteJid) ? m.quoted.key.participant : m.quoted.key.remoteJid;
            m.quoted.id = m.msg?.contextInfo?.stanzaId
            m.quoted.chat = m.msg?.contextInfo?.remoteJid || m.chat
            m.quoted.isBaileys = m.quoted.id ? m.quoted.id.startsWith('BAE5') && m.quoted.id.length === 16 : false
            m.quoted.sender = sock.decodeJid(m.msg?.contextInfo?.participant)
            m.quoted.fromMe = m.quoted.sender === (sock.user && sock.user.id)
            m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.conversation || m.quoted.contentText || m.quoted.selectedDisplayText || m.quoted.title || ''
            m.quoted.mentionedJid = m.msg?.contextInfo?.mentionedJid || []
            
            m.getQuotedObj = m.getQuotedMessage = async () => {
                if (!m.quoted.id) return false
                let q = await store.loadMessage(m.chat, m.quoted.id, sock)
                return smsg(sock, q, store)
            }
            
            let vM = m.quoted.fakeObj = M.fromObject({
                key: {
                    remoteJid: m.quoted.chat,
                    fromMe: m.quoted.fromMe,
                    id: m.quoted.id
                },
                message: quoted,
                ...(m.isGroup ? { participant: m.quoted.sender } : {})
            })

            m.quoted.delete = () => sock.sendMessage(m.quoted.chat, { 
                delete: vM.key 
            })

            m.quoted.copyNForward = (jid, forceForward = false, options = {}) => 
                sock.copyNForward(jid, vM, forceForward, options)

            m.quoted.download = () => sock.downloadMediaMessage(m.quoted)
        }
    }
    
    if (m.msg && m.msg.url) {
        m.download = () => sock.downloadMediaMessage(m.msg)
    }
    
    // Final safe text fallback
    m.text = m.body || m.msg?.text || m.msg?.caption || m.message?.conversation || m.msg?.contentText || m.msg?.selectedDisplayText || m.msg?.title || ''
    
    m.reply = (text, chatId = m.chat, options = {}) => 
        Buffer.isBuffer(text) ? 
        sock.sendMedia(chatId, text, 'file', '', m, { ...options }) : 
        sock.sendText(chatId, text, m, { ...options })
    
    m.copy = () => smsg(sock, M.fromObject(M.toObject(m)))

    m.copyNForward = (jid = m.chat, forceForward = false, options = {}) => 
        sock.copyNForward(jid, m, forceForward, options)

    // ── ADDED: react method ──────────────────────────────────────────
    m.react = async (emoji) => {
        return await sock.sendMessage(m.chat, { react: { text: emoji, key: m.key } });
    };

    // ── ADDED: send method (simple text send) ─────────────────────────
    m.send = async (content, options = {}) => {
        if (typeof content === 'string') {
            return await sock.sendMessage(m.chat, { text: content }, { quoted: m, ...options });
        }
        return await sock.sendMessage(m.chat, content, { quoted: m, ...options });
    };

    // ── ADDED: sendErr method for error messages ──────────────────────
    m.sendErr = async (error) => {
        return await m.send(`✘ *Error:*\n\`\`\`${error?.message || error}\`\`\``);
    };

    // ── ADDED: isAdmin check ──────────────────────────────────────────
    m.isAdmin = false;
    m.isBotAdmin = false;
    
    if (m.isGroup) {
        try {
            const groupMetadata = await sock.groupMetadata(m.chat);
            const participants = groupMetadata.participants;
            
            const senderJid = m.sender;
            const botJid = sock.user.id;
            
            m.isAdmin = participants.some(p => 
                (p.id === senderJid || p.id.split('@')[0] === senderJid.split('@')[0]) && 
                (p.admin === 'admin' || p.admin === 'superadmin')
            );
            
            m.isBotAdmin = participants.some(p => 
                (p.id === botJid || p.id.split('@')[0] === botJid.split('@')[0]) && 
                (p.admin === 'admin' || p.admin === 'superadmin')
            );
        } catch (err) {
            console.error('[ADMIN CHECK ERROR]', err.message);
        }
    }

    // ── ADDED: pin method (pin/unpin message) ─────────────────────────
    m.pin = async (time = 86400) => {
        return await sock.sendMessage(m.chat, {
            pin: m.key,
            time: time,
            type: 1
        });
    };

    m.unpin = async () => {
        return await sock.sendMessage(m.chat, {
            pin: m.key,
            type: 0
        });
    };

    // ── ADDED: forward method ─────────────────────────────────────────
    m.forward = async (jid, options = {}) => {
        return await sock.copyNForward(jid, m, options);
    };

    // ── ADDED: delete method ──────────────────────────────────────────
    m.delete = async () => {
        return await sock.sendMessage(m.chat, { delete: m.key });
    };

    // ── ADDED: edit method (edit text message) ────────────────────────
    m.edit = async (newText) => {
        return await sock.sendMessage(m.chat, {
            text: newText,
            edit: m.key
        });
    };

    // ── ADDED: btnText method for interactive buttons ─────────────────
    m.btnText = async (title, buttonsObj, btnLabel = '⚉ Select') => {
        const rows = Object.entries(buttonsObj).map(([id, label]) => ({
            header: '',
            title: label,
            description: '',
            id
        }));

        try {
            return await sock.sendMessage(m.chat, {
                text: title,
                footer: 'Powered by CRYSNOVA AI',
                buttons: [{
                    text: btnLabel,
                    sections: [{ title: '⚉ Options', rows }]
                }]
            }, { quoted: m });
        } catch (err) {
            const lines = Object.entries(buttonsObj)
                .map(([cmd, label]) => `◦ ${label}  ›  \`${cmd}\``)
                .join('\n');
            return await m.send(`*${title}*\n\n${lines}`);
        }
    };

    // ── ADDED: sendImage method ───────────────────────────────────────
    m.sendImage = async (image, caption = '', options = {}) => {
        return await sock.sendMessage(m.chat, {
            image: typeof image === 'string' ? { url: image } : image,
            caption: caption
        }, { quoted: m, ...options });
    };

    // ── ADDED: sendVideo method ───────────────────────────────────────
    m.sendVideo = async (video, caption = '', options = {}) => {
        return await sock.sendMessage(m.chat, {
            video: typeof video === 'string' ? { url: video } : video,
            caption: caption
        }, { quoted: m, ...options });
    };

    // ── ADDED: sendAudio method ───────────────────────────────────────
    m.sendAudio = async (audio, ptt = false, options = {}) => {
        return await sock.sendMessage(m.chat, {
            audio: typeof audio === 'string' ? { url: audio } : audio,
            ptt: ptt
        }, { quoted: m, ...options });
    };

    // ── ADDED: sendSticker method ─────────────────────────────────────
    m.sendSticker = async (sticker, options = {}) => {
        return await sock.sendMessage(m.chat, {
            sticker: typeof sticker === 'string' ? { url: sticker } : sticker
        }, { quoted: m, ...options });
    };

    // ── ADDED: sendDocument method ────────────────────────────────────
    m.sendDocument = async (document, fileName, caption = '', options = {}) => {
        return await sock.sendMessage(m.chat, {
            document: typeof document === 'string' ? { url: document } : document,
            fileName: fileName,
            caption: caption
        }, { quoted: m, ...options });
    };

    // ── ADDED: sendButton method (simple buttons) ─────────────────────
    m.sendButton = async (text, buttons, footer = '⚉ Select an option') => {
        const buttonArray = buttons.map(btn => ({
            text: btn.text,
            buttonId: btn.id
        }));
        
        return await sock.sendMessage(m.chat, {
            text: text,
            footer: footer,
            buttons: buttonArray
        }, { quoted: m });
    };

    return m
}

module.exports = { smsg }
