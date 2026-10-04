'use strict';

const VIEW_ONCE_KEYS = Object.freeze([
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension'
]);

const CONTAINER_KEYS = Object.freeze([
  'ephemeralMessage',
  'deviceSentMessage',
  'documentWithCaptionMessage',
  ...VIEW_ONCE_KEYS
]);

const MEDIA_TYPES = Object.freeze([
  ['imageMessage', 'image'],
  ['videoMessage', 'video'],
  ['audioMessage', 'audio'],
  ['documentMessage', 'document'],
  ['stickerMessage', 'sticker']
]);

function walk(value, visitor, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (visitor(value)) return true;
  for (const child of Object.values(value)) {
    if (walk(child, visitor, seen)) return true;
  }
  return false;
}

function isViewOnce(value) {
  return walk(value, current =>
    VIEW_ONCE_KEYS.some(key => current[key]) ||
    current.viewOnce === true ||
    current.extendedTextMessage?.viewOnce === true
  );
}

function unwrap(value) {
  let current = value;
  const seen = new WeakSet();
  for (let depth = 0; current && typeof current === 'object' && depth < 12; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    const key = CONTAINER_KEYS.find(candidate => current[candidate]?.message);
    if (!key) break;
    current = current[key].message;
  }
  return current;
}

function findMedia(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  for (const [key, type] of MEDIA_TYPES) {
    if (value[key]) return { key, type, media: value[key] };
  }
  for (const child of Object.values(value)) {
    const result = findMedia(child, seen);
    if (result) return result;
  }
  return null;
}

function findViewOnceMedia(value) {
  if (!isViewOnce(value)) return null;
  return findMedia(value) || findMedia(unwrap(value));
}

module.exports = {
  VIEW_ONCE_KEYS,
  CONTAINER_KEYS,
  MEDIA_TYPES,
  isViewOnce,
  unwrap,
  findMedia,
  findViewOnceMedia
};
