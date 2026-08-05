// =============================================
// plugins/linkpreview.js

// =============================================

module.exports = {
    name: 'preview',
    alias: ['lpreview', 'linkcard'],
    desc: 'Send a message with custom link preview',
    category: 'Utility',
    usage: `.preview <url> | <title> | <description>`,
    
    execute: async (sock, m, { args, reply }) => {
        const fs = require('fs');
        const path = require('path');
        
        const input = args.join(' ');
        const parts = input.split('|').map(p => p.trim());
        
        const url = parts[0];
        const title = parts[1] || 'Check this out!';
        const description = parts[2] || '';
        
        if (!url || !url.startsWith('http')) {
            return reply('𓆉 Provide a valid URL\nExample: .preview https://example.com | My Title | Description');
        }
        
        const jid = m.key.remoteJid;
        
        try {
            // Check if image was quoted (for thumbnail)
            let jpegThumbnail = null;
            const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (quotedMsg?.imageMessage) {
                jpegThumbnail = await sock.downloadContentFromMessage(
                    quotedMsg.imageMessage, 
                    'image'
                );
            }
            
            const messagePayload = {
                text: `${url}\n👆🏻 *${title}*`,
                linkPreview: {
                    'matched-text': url,
                    title: title,
                    description: description,
                    previewType: 0, // 0 = image, 1 = video
                }
            };
            
            // Add thumbnail only if we have one
            if (jpegThumbnail) {
                messagePayload.linkPreview.jpegThumbnail = jpegThumbnail;
            }
            
            await sock.sendMessage(jid, messagePayload, {
                quoted: m
            });
            
       //     reply('✅ Link preview sent!');
        } catch (e) {
            console.error('[PREVIEW]', e);
            reply(`${prefix}☠︎︎ Error: ${emessage}`);
        }
    }
};
