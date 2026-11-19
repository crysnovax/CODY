const fs = require('fs');
const path = require('path');
const { downloadContentFromMessage, downloadMediaMessage } = require('plogme');
const { resolvePhoneJidWithMetadata } = require('../../Plugin/identityUtils');
const { stripBotMarkerDeep, stripQuotedDeep } = require('../../Plugin/antiText');
const { isViewOnce, unwrap: unwrapShared, findMedia: findSharedMedia } = require('../../Plugin/viewOnce');

const DATA_FILE = path.join(__dirname, '../../../database/vv-reactions.json');
const AUTOVV_FILE = path.join(__dirname, '../../../database/autovv.json');

let reactionTriggers = {};
let autoVVChats = {};
let listenerAttached = false;
const processedAutoVV = new Map();
const AUTO_VV_DEDUPE_TTL_MS = 10 * 60 * 1000;

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
const VIEW_ONCE_KEYS = ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'];
const MEDIA_KEYS = ['imageMessage', 'videoMessage', 'stickerMessage', 'audioMessage', 'documentMessage'];

// WhatsApp puts `messageContextInfo`, `deviceSentMessage` and other bookkeeping
// keys alongside the media inside a view-once envelope, and their order is not
// stable. Picking `Object.keys(content)[0]` therefore resolved to a non-media
// key and the media was reported as unsupported.
function findMedia(content, seen = new WeakSet()) {
  if (!content || typeof content !== 'object' || seen.has(content)) return null;
  seen.add(content);
  for (const key of MEDIA_KEYS) {
    if (content[key]) return { type: key, media: content[key] };
  }
  for (const value of Object.values(content)) {
    const found = findMedia(value, seen);
    if (found) return found;
  }
  return null;
}

function findViewOnceText(content, seen = new WeakSet()) {
  if (!content || typeof content !== 'object' || seen.has(content)) return '';
  seen.add(content);
  if (typeof content.conversation === 'string' && content.conversation.trim()) return content.conversation;
  if (typeof content.extendedTextMessage?.text === 'string' && content.extendedTextMessage.text.trim()) return content.extendedTextMessage.text;
  if (typeof content.textMessage?.text === 'string' && content.textMessage.text.trim()) return content.textMessage.text;
  for (const [key, value] of Object.entries(content)) {
    if (key === 'contextInfo' || key === 'quotedMessage') continue;
    const found = findViewOnceText(value, seen);
    if (found) return found;
  }
  return '';
}

function buildMediaPayload(type, buffer, media, caption) {
  switch (type) {
    case 'imageMessage': return { image: buffer, caption };
    case 'videoMessage': return { video: buffer, caption, gifPlayback: media?.gifPlayback || false };
    case 'audioMessage': return { audio: buffer, mimetype: media?.mimetype || 'audio/ogg', ptt: media?.ptt || false };
    case 'documentMessage': return { document: buffer, mimetype: media?.mimetype || 'application/octet-stream', fileName: media?.fileName || 'view-once-file', caption };
    case 'stickerMessage': return { sticker: buffer };
    default: return null;
  }
}

// Only the message the member actually sent may drive AutoVV. A reply carries
// the quoted message inside contextInfo.quotedMessage, so without this the hook
// fired on every reply to a view-once message and forwarded unrelated media.
function sanitizeEnvelope(value) {
  return stripQuotedDeep(stripBotMarkerDeep(value || {}));
}

// Deep scan for the view-once envelope. WhatsApp nests it inside ephemeral,
// documentWithCaption and editedMessage wrappers; the previous check only
// walked the top level plus ephemeralMessage, so AutoVV silently ignored
// real captioned view-once media.
function isViewOnceEnvelope(message, seen = new WeakSet()) {
  if (!message || typeof message !== 'object' || seen.has(message)) return false;
  seen.add(message);
  if (isViewOnce(message)) return true;
  return Object.values(message).some(value => isViewOnceEnvelope(value, seen));
}

function makeMessageEnvelope(source, message) {
  if (!message) return null;
  if (source?.message && source?.key) return source;
  return {
    key: {
      ...(source?.key || {}),
      remoteJid: source?.key?.remoteJid || source?.chat,
      id: source?.key?.id || source?.id,
      fromMe: source?.key?.fromMe || source?.fromMe,
      participant: source?.key?.participant || source?.participant || source?.sender,
    },
    message,
    participant: source?.participant || source?.sender,
  };
}

async function downloadMedia(sock, content, messageEnvelope) {
  const found = findMedia(content);
  if (!found) return null;
  const { type, media } = found;
  let buffer;

  // Keep the complete WebMessageInfo for WhatsApp media downloads. This lets
  // Baileys use the message key and its media-reupload path when view-once
  // media has an expired or stale direct path.
  if (typeof downloadMediaMessage === 'function' && messageEnvelope?.message) {
    const reuploadRequest = typeof sock?.updateMediaMessage === 'function'
      ? message => sock.updateMediaMessage(message)
      : undefined;
    buffer = await downloadMediaMessage(messageEnvelope, 'buffer', undefined, {
      logger: console,
      reuploadRequest,
    });
  } else if (typeof sock?.downloadMediaMessage === 'function' && messageEnvelope?.message) {
    buffer = await sock.downloadMediaMessage(messageEnvelope, 'buffer');
  } else {
    // Compatibility fallback for lightweight test sockets and old integrations.
    const stream = await downloadContentFromMessage(media, type.replace('Message', '').toLowerCase());
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    buffer = Buffer.concat(chunks);
  }

  return { type, media, buffer };
}

// Prefer CODY's recovered serialized quote. Its download() method carries the
// complete WebMessageInfo envelope, which is required for newer direct
// view-once media whose URL is not present on the stripped quoted object.
async function recoverQuotedMessage(m) {
  if (typeof m?.getQuotedMessage === 'function') {
    try {
      const recovered = await m.getQuotedMessage();
      if (recovered) return recovered;
    } catch {}
  }
  return m?.quoted || null;
}

function quotedContent(recovered) {
  return recovered?.fakeObj?.message || recovered?.message || recovered;
}

async function downloadRecoveredQuoted(sock, recovered, content) {
  if (typeof recovered?.download === 'function') {
    const buffer = await recovered.download();
    const found = findMedia(content);
    return found ? { type: found.type, media: found.media, buffer } : null;
  }
  const envelope = recovered?.fakeObj?.message
    ? recovered.fakeObj
    : makeMessageEnvelope(recovered, content);
  return downloadMedia(sock, content, envelope);
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
        return reply(`╭─❍ *CRYSNOVA AI V20*\n│ ✓ Reaction trigger set: ${args[1]}\n╰──────────────────`);
      }

      // ───── MUST REPLY ─────
      const recoveredQuoted = await recoverQuotedMessage(m);
      let quoted = quotedContent(recoveredQuoted) || m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (!quoted) {
        return reply('╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ Reply to a view-once message.\n╰──────────────────');
      }

      const quotedEnvelope = recoveredQuoted?.fakeObj?.message
        ? recoveredQuoted.fakeObj
        : makeMessageEnvelope(recoveredQuoted || m, quoted);

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

      const found = findMedia(quoted);
      if (!found) {
        const text = findViewOnceText(quoted);
        if (!text) return reply('╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ No supported text or media found.\n╰──────────────────');
        if (cmd === vvpCmd) await sock.sendMessage(sender, { text });
        else await sock.sendMessage(m.chat, { text }, { quoted: m });
        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
        return;
      }
      const type = found.type;

      // ───── DOWNLOAD BUFFER ─────
      const downloaded = await downloadRecoveredQuoted(sock, recoveredQuoted, quoted)
        || await downloadMedia(sock, quoted, quotedEnvelope);
      const buffer = downloaded?.buffer;

      const payload = buildMediaPayload(
        type,
        buffer,
        found.media,
        `╭─❍ *CRYSNOVA AI V2.0*\n│ ✓ View-once unlocked.\n╰──────────────────`
      );
      if (!payload) return reply('╭─❍ *CRYSNOVA AI V2.0*\n│ ✘ Unsupported type.\n╰──────────────────');

      if (cmd === vvpCmd) {
        await sock.sendMessage(sender, payload);
        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
        return;
      }

      await sock.sendMessage(m.chat, payload, { quoted: m });

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

            const content = unwrapViewOnce(msg.message);
            const reacted = findMedia(content);
            if (!reacted) {
              const text = findViewOnceText(content);
              if (text) await sock.sendMessage(reactor, { text });
              return;
            }
            const t = reacted.type;

            const downloaded = await downloadMedia(sock, content, msg);
            const buf = downloaded?.buffer;

            const payload = buildMediaPayload(
              t,
              buf,
              reacted.media,
              `╭─❍ *CRYSNOVA AI V2.0*\n│ ✓ View-once saved via reaction ${reactedEmoji}\n╰──────────────────`
            );
            if (payload) await sock.sendMessage(reactor, payload);

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
    if (!chat || !autoVVChats[chat] || (mek?.key?.fromMe && !m?.__editModeration && !mek?.__editModeration)) return false;

    // Build the raw message envelope — check both mek.message and m.message
    // (smsg may have already copied it over). Also try the wrapper keys
    // directly on mek in case smsg stripped the outer envelope.
    const rawEnvelope = sanitizeEnvelope(mek?.__rawMessage || mek?.message || m?.message || m?.msg);
    const ownMessage = sanitizeEnvelope(m?.message);
    const ownMsg = sanitizeEnvelope(m?.msg);

    // Detect whether this is a view-once message by checking for the
    // wrapper keys at ANY nesting depth (ephemeral → viewOnce → media).
    const hasViewOnceEnvelope = isViewOnceEnvelope(rawEnvelope) ||
      isViewOnceEnvelope(ownMessage) || isViewOnceEnvelope(ownMsg);
    if (!hasViewOnceEnvelope) return false;

    const messageId = mek?.key?.id || m?.key?.id;
    if (messageId) {
      const now = Date.now();
      for (const [id, seenAt] of processedAutoVV) {
        if (now - seenAt > AUTO_VV_DEDUPE_TTL_MS) processedAutoVV.delete(id);
      }
      if (processedAutoVV.has(messageId)) return false;
      processedAutoVV.set(messageId, now);
    }

    // Try unwrapping from the raw envelope first (most reliable for detection)
    let content = unwrapShared(rawEnvelope);

    // If unwrap didn't change anything (no wrapper found), the message might
    // already be unwrapped by smsg — just use it directly.
    const messageEnvelope = mek?.message
      ? mek
      : makeMessageEnvelope(mek || m, rawEnvelope);
    let media = await downloadMedia(sock, content, messageEnvelope);

    // Fallback: check if m.message has media directly (smsg unwrapped it)
    if (!media) {
      media = await downloadMedia(sock, unwrapViewOnce(ownMessage), messageEnvelope);
    }

    // Last fallback: check m itself (smsg sometimes puts media type at top)
    if (!media) {
      media = await downloadMedia(sock, unwrapViewOnce(ownMsg), messageEnvelope);
    }

    const viewOnceText = findViewOnceText(rawEnvelope) ||
      findViewOnceText(unwrapViewOnce(ownMessage)) ||
      findViewOnceText(unwrapViewOnce(ownMsg));

    if (!media && !viewOnceText) {
      if (messageId) processedAutoVV.delete(messageId);
      return false;
    }

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
    if (media) {
      const payload = buildMediaPayload(media.type, media.buffer, media.media, '');
      if (!payload) return false;
      await sock.sendMessage(recipient, payload);
    } else {
      await sock.sendMessage(recipient, { text: viewOnceText });
    }
    if (chat.endsWith('@g.us') && (typeof sock.sendMessage === 'function')) {
      await sock.sendMessage(chat, { delete: mek?.__deleteKey || m?.__deleteKey || m?.key || mek?.key }).catch(() => {});
    }
    await sock.sendMessage(chat, { react: { text: '👁️', key: m?.key || mek?.key } }).catch(() => {});
    return true;
  } catch (error) {
    console.error('[AUTOVV ERROR]', error.message);
    const messageId = mek?.key?.id || m?.key?.id;
    if (messageId) processedAutoVV.delete(messageId);
    return false;
  }
};

module.exports.isViewOnceEnvelope = isViewOnceEnvelope;
module.exports.findMedia = findMedia;
module.exports.setAutoVV = function setAutoVV(chat, enabled) {
  autoVVChats[chat] = Boolean(enabled);
};
