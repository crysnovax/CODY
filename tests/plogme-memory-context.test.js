'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const plogme = require('../src/Commands/Core/plogme.js');

const chat = `plogme-memory-test-${process.pid}@g.us`;
const memoryFile = path.join(process.cwd(), 'database', 'plogme_memory.json');
const metaFile = path.join(process.cwd(), 'database', 'plogme_memory_meta.json');
const originalMemory = fs.existsSync(memoryFile) ? fs.readFileSync(memoryFile) : null;
const originalMeta = fs.existsSync(metaFile) ? fs.readFileSync(metaFile) : null;

test.after(() => {
    for (const [file, original] of [[memoryFile, originalMemory], [metaFile, originalMeta]]) {
        if (original) fs.writeFileSync(file, original);
        else try { fs.unlinkSync(file); } catch {}
    }
});

test('quoted message context includes text, sender, media type, and resolves references', () => {
    const context = plogme.buildMessageContext({
        sender: '111@s.whatsapp.net',
        isGroup: true,
        mentionedJid: ['222@s.whatsapp.net'],
        quoted: {
            sender: '333@s.whatsapp.net',
            mtype: 'imageMessage',
            message: { imageMessage: { caption: 'Use this image as the group picture' } }
        }
    });
    const formatted = plogme.formatMessageContext(context);
    assert.match(formatted, /333@s\.whatsapp\.net/);
    assert.match(formatted, /image/);
    assert.match(formatted, /Use this image as the group picture/);
    assert.match(plogme.buildClassifierPrompt('set this as the group picture', context), /quoted media\/text is context/);
});

test('memory persists sender metadata, long-term continuity, and ignores duplicate message delivery', () => {
    plogme.clearMemory(chat);
    for (let i = 0; i < 60; i++) {
        plogme.addToMemory(chat, 'user', `request ${i}`, {
            messageId: `memory-test-${i}`,
            sender: '111@s.whatsapp.net'
        });
    }
    assert.equal(plogme.addToMemory(chat, 'user', 'request 59', {
        messageId: 'memory-test-59',
        sender: '111@s.whatsapp.net'
    }), false);
    const meta = plogme.getMemoryMeta(chat);
    assert.ok(meta.turnCount >= 60);
    assert.match(meta.summary, /request/);
    const prompt = plogme.buildPrompt(chat, 'continue that request', {
        sender: '111@s.whatsapp.net',
        chatType: 'group',
        quoted: { sender: '222@s.whatsapp.net', type: 'message', text: 'the original request' }
    });
    assert.match(prompt, /Long-term conversation continuity/);
    assert.match(prompt, /the original request/);
});
