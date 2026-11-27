const test = require('node:test');
const assert = require('node:assert/strict');

const theme = require('../src/Commands/Tools/theme.js');
const bubble = require('../src/Commands/Tools/chatbubble.js');
const chatTheme = require('../src/Commands/Tools/chattheme.js');
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
  for (const command of [theme, bubble, chatTheme, background]) {
    assert.equal(command.adminOnly, false);
    assert.equal(command.groupOnly, false);
  }
});

test('theme resolves easy names to the supplied minimal color scheme IDs', async () => {
  const h = harness();
  await theme.execute(h.sock, message, { args: ['emerald'], reply: h.reply });
  assert.equal(h.sent[0][1].chatTheme.colorSchemeId, 'Emerald@Minimal');
});

test('all customization commands provide list output', async () => {
  for (const command of [theme, chatTheme, bubble, background]) {
    const h = harness();
    await command.execute(h.sock, message, { args: ['list'], reply: h.reply });
    assert.match(h.replies[0], /Available|supports direct/);
    assert.equal(h.sent.length, 0);
  }
});

test('.chattheme sends solid colors while always enabling doodles', async () => {
  const h = harness();
  await chatTheme.execute(h.sock, message, { args: ['dark', 'light=#FF162E24', 'dark=#FF04120D', 'doodle=off'], reply: h.reply });
  const solidColor = h.sent[0][1].chatTheme.solidColor;
  assert.equal(solidColor.colorLight, '#FF162E24');
  assert.equal(solidColor.colorDark, '#FF04120D');
  assert.equal(solidColor.isDoodleEnabled, true);
});

test('.chattheme --dark applies the dark side of a preset and keeps doodles enabled', async () => {
  const h = harness();
  await chatTheme.execute(h.sock, message, { args: ['emerald', '--dark'], reply: h.reply });
  const solidColor = h.sent[0][1].chatTheme.solidColor;
  assert.deepEqual(solidColor, {
    colorLight: '#FF162E24',
    colorDark: '#FF04120D',
    doodleColorLight: '#FF24493A',
    doodleColorDark: '#FF234E3A',
    isDoodleEnabled: true
  });
  assert.equal(solidColor.isDoodleEnabled, true);
});

test('dark preset uses the exact deep-dark WhatsApp palette', async () => {
  const h = harness();
  await bubble.execute(h.sock, message, { args: ['dark'], reply: h.reply });
  assert.equal(h.sent[0][1].chatTheme.solidColor.colorLight, '#FF162E24');
  assert.equal(h.sent[0][1].chatTheme.solidColor.colorDark, '#FF04120D');
  assert.equal(h.sent[0][1].chatTheme.solidColor.doodleColorLight, '#FF24493A');
  assert.equal(h.sent[0][1].chatTheme.solidColor.doodleColorDark, '#FF234E3A');
});

test('--light preserves the selected theme light/dark pair', async () => {
  const h = harness();
  await chatTheme.execute(h.sock, message, { args: ['emerald', '--light'], reply: h.reply });
  const solidColor = h.sent[0][1].chatTheme.solidColor;
  assert.equal(solidColor.colorLight, '#FFE8F5E9');
  assert.equal(solidColor.colorDark, '#FF0B3D2E');
  assert.equal(solidColor.doodleColorLight, '#FFC8E6C9');
  assert.equal(solidColor.doodleColorDark, 0xFF1B5E20);
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

test('wallpaper command is named chatbackground to avoid a background collision', () => {
  assert.equal(background.name, 'chatbackground');
});

test('commands can target a phone JID and resolve a WhatsApp group link', async () => {
  const h = harness();
  const targets = [];
  const sock = {
    sendMessage: async (target, payload) => { targets.push([target, payload]); },
    groupGetInviteInfo: async (code) => ({ id: '987@g.us', code })
  };
  await theme.execute(sock, message, { args: ['5551234567@s.whatsapp.net', 'emerald'], reply: h.reply });
  await chatTheme.execute(sock, message, { args: ['https://chat.whatsapp.com/ABC123', 'blue', '--dark'], reply: h.reply });
  assert.equal(targets[0][0], '5551234567@s.whatsapp.net');
  assert.equal(targets[1][0], '987@g.us');
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
