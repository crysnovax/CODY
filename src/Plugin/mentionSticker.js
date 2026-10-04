'use strict';

const fs = require('fs');
const path = require('path');

function isWebp(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
}

function isGzip(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

async function readSource(source) {
  const value = String(source || '').trim();
  if (!value) throw new Error('No mention sticker is configured');
  if (/^https?:\/\//i.test(value)) {
    const response = await fetch(value, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Sticker download failed (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }
  const absolute = path.resolve(value);
  if (!fs.existsSync(absolute)) throw new Error('Configured mention sticker file is missing');
  return fs.promises.readFile(absolute);
}

/**
 * Build content for sock.sendMessage. A path must never be passed as {url};
 * WhatsApp cannot read the bot's local filesystem. Buffers also preserve
 * animated WebP and premium/AI sticker bytes instead of re-encoding them.
 */
async function loadMentionSticker(source, options = {}) {
  const buffer = await readSource(source);
  if (!buffer.length) throw new Error('Configured mention sticker is empty');

  if (isGzip(buffer) || options.kind === 'lottie') {
    // Lottie is a separate WAProto message type. Normal sticker upload would
    // produce the "cannot view sticker" placeholder, so let the caller use
    // the preserved protocol message relay path when available.
    return { kind: 'lottie', buffer };
  }
  if (!isWebp(buffer)) throw new Error('Mention sticker must be WebP or a supported Lottie payload');

  return {
    kind: 'sticker',
    buffer,
    // Baileys/plogme detects the animation from the WebP, but accepting the
    // persisted flag keeps animated and premium/AI stickers intact.
    isAnimated: Boolean(options.isAnimated)
  };
}

module.exports = { loadMentionSticker, isWebp, isGzip };
