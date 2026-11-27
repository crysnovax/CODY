const test = require('node:test');
const assert = require('node:assert/strict');

const saudio = require('../src/Commands/Media/sa.js');

const message = { chat: '123@s.whatsapp.net', sender: '456@s.whatsapp.net', key: { id: 'command' } };

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

test('saudio without media returns help listing all supported workflows', async () => {
  const h = harness();
  await saudio.execute(h.sock, message, { args: [], reply: h.reply, prefix: '.' });
  assert.match(h.replies[0], /saudio add/);
  assert.match(h.replies[0], /saudio push/);
  assert.match(h.replies[0], /audio-url/);
});

test('saudio add stores a replied sticker and audio, then push sends both', async () => {
  saudio._drafts.clear();
  const h = harness();
  const sticker = {
    mtype: 'stickerMessage',
    message: { stickerMessage: {} },
    download: async () => Buffer.from('RIFF-sticker-webp')
  };
  const audio = {
    mtype: 'audioMessage',
    message: { audioMessage: {} },
    download: async () => Buffer.from('OggS-audio')
  };

  await saudio.execute(h.sock, { ...message, quoted: sticker }, { args: ['add'], reply: h.reply });
  await saudio.execute(h.sock, { ...message, quoted: audio }, { args: ['add'], reply: h.reply });
  await saudio.execute(h.sock, message, { args: ['push'], reply: h.reply });

  assert.equal(h.sent.length, 1);
  assert.ok(h.sent[0][1].sticker.equals(Buffer.from('RIFF-sticker-webp')));
  assert.match(h.sent[0][1].stickerAudio.url, /^data:audio\/ogg;base64,/);
  assert.equal(saudio._drafts.size, 0);
});

test('saudio add rejects media other than sticker or audio', async () => {
  saudio._drafts.clear();
  const h = harness();
  const image = {
    mtype: 'imageMessage',
    message: { imageMessage: {} },
    download: async () => Buffer.from('image')
  };
  await saudio.execute(h.sock, { ...message, quoted: image }, { args: ['add'], reply: h.reply });
  assert.match(h.replies[0], /only accepts/);
});
