const test = require('node:test');
const assert = require('node:assert/strict');

const theme = require('../src/Commands/Tools/theme.js');
const bubble = require('../src/Commands/Tools/chatbubble.js');
const background = require('../src/Commands/Tools/background.js');

const message = { chat: '123@s.whatsapp.net', key: { id: 'test' } };

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

test('chat customization commands are public in DMs and groups', () => {
  for (const command of [theme, bubble, background]) {
    assert.equal(command.adminOnly, false);
    assert.equal(command.groupOnly, false);
  }
});

test('theme resolves easy names to the supplied minimal color scheme IDs', async () => {
  const h = harness();
  await theme.execute(h.sock, message, { args: ['emerald'], reply: h.reply });
  assert.equal(h.sent[0][1].chatTheme.colorSchemeId, 'Emerald@Minimal');
});

test('chatbubble emits the solidColor payload for a named preset', async () => {
  const h = harness();
  await bubble.execute(h.sock, message, { args: ['blue'], reply: h.reply });
  assert.equal(h.sent[0][1].chatTheme.solidColor.colorLight, '#FFE3F2FD');
  assert.equal(h.sent[0][1].chatTheme.solidColor.isDoodleEnabled, true);
});

test('chatbubble accepts inline color and doodle overrides', async () => {
  const h = harness();
  await bubble.execute(h.sock, message, { args: ['dark', 'light=#FFABCDEF', 'doodle=off'], reply: h.reply });
  assert.equal(h.sent[0][1].chatTheme.solidColor.colorLight, '#FFABCDEF');
  assert.equal(h.sent[0][1].chatTheme.solidColor.isDoodleEnabled, false);
});

test('chatbubble supports additional named colors', async () => {
  for (const color of ['orange', 'yellow', 'lime', 'teal', 'cyan', 'indigo', 'brown', 'gray', 'black', 'white']) {
    const h = harness();
    await bubble.execute(h.sock, message, { args: [color], reply: h.reply });
    assert.match(h.sent[0][1].chatTheme.solidColor.colorLight, /^#[0-9A-F]{8}$/);
    assert.match(h.sent[0][1].chatTheme.solidColor.colorDark, /^#[0-9A-F]{8}$/);
  }
});

test('background sends a direct URL through setGroupWallpaper with dim level', async () => {
  const h = harness();
  const calls = [];
  await background.execute(h.sock, message, {
    args: ['https://example.com/wallpaper.jpg', 'dim=0.35'],
    reply: h.reply,
    setGroupWallpaper: async (...args) => calls.push(args)
  });
  assert.deepEqual(calls, [[h.sock, message.chat, 'https://example.com/wallpaper.jpg', { dimLevel: 0.35 }]]);
  assert.match(h.replies[0], /updated/);
});

test('background uploads and uses an image reply when no URL is supplied', async () => {
  const h = harness();
  const calls = [];
  const quoted = {
    mtype: 'imageMessage',
    download: async () => Buffer.from('not-a-real-image')
  };
  await background.execute(h.sock, { ...message, quoted }, {
    args: [],
    reply: h.reply,
    uploadWallpaper: async (buffer) => {
      assert.equal(buffer.toString(), 'not-a-real-image');
      return 'https://cdn.example/replied.jpg';
    },
    setGroupWallpaper: async (...args) => calls.push(args)
  });
  assert.deepEqual(calls, [[h.sock, message.chat, 'https://cdn.example/replied.jpg', { dimLevel: 0 }]]);
});
