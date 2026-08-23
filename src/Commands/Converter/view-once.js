const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@crysnovax/baileys');
const { resolvePhoneJidWithMetadata } = require('../../Plugin/identityUtils');

const DATA_FILE = path.join(__dirname, '../../../database/vv-reactions.json');
const AUTOVV_FILE = path.join(__dirname, '../../../database/autovv.json');

let reactionTriggers = {};
let autoVVChats = {};
let listenerAttached = false;

try {
  if (fs.existsSync(DATA_FILE)) {
    reactionTriggers = JSON.parse(fs.readFileSync(DATA_FILE));
  }
} catch {}
try {
  if (fs.existsSync(AUTOVV_FILE)) autoVVChats = JSON.parse(fs.readFileSync(AUTOVV_FILE, 'utf8'));
} catch {}

function saveTriggers() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(reactionTriggers, null, 2));
}
function saveAutoVV() {
  fs.mkdirSync(path.dirname(AUTOVV_FILE), { recursive: true });
  fs.writeFileSync(AUTOVV_FILE, JSON.stringify(autoVVChats, null, 2));
}
function unwrapViewOnce(message) {
  let content = message;
  let changed = true;
  while (changed && content) {
    changed = false;
    for (const key of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']) {
      if (content[key]?.message) {
        content = content[key].message;
        changed = true;
        break;
      }
    }
  }
  return content;
}
async function downloadMedia(content) {
  const type = Object.keys(content || {})[0];
  if (!['imageMessage', 'videoMessage', 'stickerMessage', 'audioMessage'].includes(type)) return null;
  const stream = await downloadContentFromMessage(content[type], type.replace('Message', '').toLowerCase());
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return { type, buffer: Buffer.concat(chunks) };
}

module.exports = {
  name: 'vv',
  alias: ['viewonce', 'vview', 'vvp', 'autovv'],
  category: 'media',
  owner: true,
  reactions: {
    start: '👌',
    success: '🤫'
  },

  execute: async (sock, m, { args, reply, prefix }) => {
    try {
      const rawBody = m.body || m.text || m.message?.conversation || m.message?.extendedTextMessage?.text || '';
      const cmd = rawBody.trim().split(/\s+/)[0].toLowerCase();
      const sender = m.sender;
      const vvCmd = prefix + 'vv';
      const vvpCmd = prefix + 'vvp';
      const autovvCmd = prefix + 'autovv';

      if (cmd === autovvCmd) {
        const mode = (args[0] || 'status').toLowerCase();
        if (!['on', 'off', 'status'].includes(mode)) return reply(`Usage: ${autovvCmd} on | off | status`);
        if (mode === 'status') return reply(`AutoVV is ${autoVVChats[m.chat] ? 'ON' : 'OFF'} in this chat.`);
        autoVVChats[m.chat] = mode === 'on';
        saveAutoVV();
        return reply(`AutoVV ${mode === 'on' ? 'enabled' : 'disabled'} in this chat.`);
      }

      // ───── SET REACTION TRIGGER ─────
      if (cmd === vvCmd && args[0] === 'cmd' && args[1]) {
        reactionTriggers[sender] = args[1];
        saveTriggers();
        return reply(`${prefix}╭─❍ *CRYSNOVA AI V20*\n│ ✓ Reaction trigger set: ${args[1]}\n╰──────────────────`);
      }

      // ───── MUST REPLY ─────
      let quoted = m.quoted?.message || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted) {
        return reply('╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ Reply to a view-once message.\n╰──────────────────');
      }

      // Unwrap current ephemeral/view-once envelopes.
      let unwrapped = true;
      while (unwrapped && quoted) {
        unwrapped = false;
        for (const key of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage']) {
          if (quoted[key]?.message) {
            quoted = quoted[key].message;
            unwrapped = true;
            break;
          }
        }
      }

      const type = Object.keys(quoted)[0];

      // ───── SUPPORTED TYPES ─────
      if (!['imageMessage','videoMessage','stickerMessage','audioMessage'].includes(type)) {
        return reply('╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ Only view-once media/audio supported.\n╰──────────────────');
      }

      // ───── DOWNLOAD BUFFER ─────
      const stream = await downloadContentFromMessage(
        quoted[type],
        type.replace('Message','').toLowerCase()
      );

      let buffer = Buffer.alloc(0);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      // ───── MAP TYPE TO SEND TYPE ─────
      const sendType =
        type === 'videoMessage'
          ? 'video'
          : type === 'imageMessage'
          ? 'image'
          : type === 'stickerMessage'
          ? 'sticker'
          : type === 'audioMessage'
          ? 'audio'
          : null;

      if (!sendType) return reply('╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ Unsupported type.\n╰──────────────────');

      // ───── PRIVATE (.vvp) ─────
      if (cmd === vvpCmd) {
        await sock.sendMessage(sender, { [sendType]: buffer });
        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
        return;
      }

      // ───── NORMAL (.vv) ─────
      await sock.sendMessage(m.chat, {
        [sendType]: buffer,
        caption: `╭─❍ *CRYSNOVA AI V2.0*\n│ ✓ View-once unlocked.\n╰──────────────────`
      }, { quoted: m });

      // ───── ATTACH REACTION LISTENER ONCE ─────
      if (!listenerAttached) {
        listenerAttached = true;

        sock.ev.on('messages.reaction', async (updates) => {
          try {
            const update = updates[0];
            const reactedEmoji = update.reaction?.text;
            const reactor = update.reaction?.senderId || update.reaction?.participant;

            if (!reactedEmoji || !reactionTriggers[reactor]) return;
            if (reactedEmoji !== reactionTriggers[reactor]) return;

            const msg = await sock.loadMessage(update.key.remoteJid, update.key.id);
            if (!msg?.message) return;

            let content = msg.message;
            if (content.ephemeralMessage) content = content.ephemeralMessage.message;
            if (content.viewOnceMessage) content = content.viewOnceMessage.message;

            const t = Object.keys(content)[0];
            if (!['imageMessage','videoMessage','stickerMessage','audioMessage'].includes(t)) return;

            const s = await downloadContentFromMessage(
              content[t],
              t.replace('Message','').toLowerCase()
            );

            let buf = Buffer.alloc(0);
            for await (const chunk of s) {
              buf = Buffer.concat([buf, chunk]);
            }

            const st =
              t === 'videoMessage'
                ? 'video'
                : t === 'imageMessage'
                ? 'image'
                : t === 'stickerMessage'
                ? 'sticker'
                : t === 'audioMessage'
                ? 'audio'
                : null;

            if (!st) return;

            await sock.sendMessage(reactor, {
              [st]: buf,
              caption: `╭─❍ *CRYSNOVA AI V2.0*\n│ ✓ View-once saved via reaction ${reactedEmoji}\n╰──────────────────`
            });

          } catch {}
        });
      }

    } catch (err) {
      console.error('[VV ERROR]', err);
      reply('╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ Error unlocking view-once.\n╰──────────────────');
    }
  }
};

// Called before command dispatch so AutoVV also handles view-once media
// messages that contain no text or command prefix.
module.exports.handleAutoVV = async function handleAutoVV(sock, m, mek) {
  try {
    const chat = m?.chat || mek?.key?.remoteJid;
    if (!chat || !autoVVChats[chat] || mek?.key?.fromMe) return false;
    const content = unwrapViewOnce(mek?.message || m?.message);
    const media = await downloadMedia(content);
    if (!media) return false;
    const senderCandidates = [
      m?.sender,
      mek?.key?.participant,
      mek?.key?.participantAlt,
      m?.key?.participant,
      m?.key?.participantAlt
    ].filter(Boolean);
    const recipient = await resolvePhoneJidWithMetadata(sock, chat, senderCandidates)
      || senderCandidates.find(jid => String(jid).endsWith('@s.whatsapp.net'))
      || senderCandidates[0];
    if (!recipient) return false;
    const sendType = media.type.replace('Message', '').toLowerCase();
    await sock.sendMessage(recipient, { [sendType]: media.buffer });
    await sock.sendMessage(chat, { react: { text: '👁️', key: m?.key || mek?.key } }).catch(() => {});
    return true;
  } catch (error) {
    console.error('[AUTOVV ERROR]', error.message);
    return false;
  }
};
