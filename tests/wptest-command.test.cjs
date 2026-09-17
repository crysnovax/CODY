const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sticker = require('../src/Commands/Owner/wptest.js');
const ids = require('../src/Commands/Owner/wallpaperids.js');
const theme = require('../src/Commands/Owner/testwallpaper.js');

const m = { chat: '123@s.whatsapp.net', key: { id: 'test' } };

function harness() {
  const sent = [];
  const replies = [];
  return {
    sent,
    replies,
    sock: { sendMessage: async (...args) => sent.push(args) },
    reply: async (text) => replies.push(text)
  };
}

test('bundled sticker/audio test sends both local assets', async () => {
  const h = harness();
  await sticker.execute(h.sock, m, { args: [], reply: h.reply });
  assert.equal(h.sent.length, 1);
  assert.ok(h.sent[0][1].sticker.url.endsWith('test-sticker.webp'));
  assert.ok(h.sent[0][1].stickerAudio.url.endsWith('test-sticker-audio.ogg'));
  assert.ok(fs.existsSync(h.sent[0][1].sticker.url));
  assert.ok(fs.existsSync(h.sent[0][1].stickerAudio.url));
});

test('wallpaperids lists the discovered theme catalog', async () => {
  const h = harness();
  await ids.execute(h.sock, m, { reply: h.reply });
  assert.equal(h.sent.length, 0);
  assert.match(h.replies[0], /WhatsApp-Green/);
  assert.match(h.replies[0], /Pearl-Indigo/);
});

test('testwallpaper converts a theme family to a colorSchemeId', async () => {
  const h = harness();
  await theme.execute(h.sock, m, { args: ['WhatsApp-Green'], reply: h.reply });
  assert.equal(h.sent[0][1].chatTheme.chatThemeId, 'WhatsApp-Green');
});
