const test = require('node:test');
const assert = require('node:assert/strict');
const { isForwardedMessage } = require('../src/Commands/Admin/antiforward');
const antilink = require('../src/Commands/Admin/antilink');
const vv = require('../src/Commands/Converter/view-once');
const antivv = require('../src/Commands/Admin/antivv');
const antigroupstatus = require('../src/Commands/Admin/antigroupstatus');
const { addCommand, getCommand, clearRegistry } = require('../src/Plugin/crysCmd');

test('AntiForward detects forwarding metadata in every message container', () => {
  assert.equal(isForwardedMessage({ raw: { extendedTextMessage: { contextInfo: { isForwarded: true } } } }), true);
  assert.equal(isForwardedMessage({ msg: { contextInfo: { forwardingScore: 2 } } }), true);
  assert.equal(isForwardedMessage({ message: { conversation: 'ordinary text' } }), false);
});

test('AntiLink detects and extracts TikTok short links from nested message text', () => {
  const message = { extendedTextMessage: { text: 'https://vt.tiktok.com/ZSVAh671Y/' } };
  const text = antilink.getMessageText(message).join(' ');
  assert.equal(antilink.hasLink(text), true);
  assert.deepEqual(antilink.extractUrls(text), ['https://vt.tiktok.com/ZSVAh671Y/']);
});

test('view-once module exposes the automatic forwarding hook', () => {
  assert.equal(typeof vv.handleAutoVV, 'function');
  assert.ok(vv.alias.includes('autovv'));
});

// Regression: handleModeration passes { raw, message, msg, serialized } to the
// detector, and the group-status envelope is nested inside it. The detector
// must find it there, otherwise AntiGroupStatus can never trigger.
test('AntiGroupStatus finds the envelope inside the moderation payload', () => {
  const envelope = {
    groupStatusMessageV2: { message: { extendedTextMessage: { text: 'story', contextInfo: { isGroupStatus: true } } } }
  };
  assert.equal(antigroupstatus.isGroupStatusMessage({
    raw: envelope, message: envelope, msg: envelope.groupStatusMessageV2, serialized: {}
  }), true);
  const wrapped = {
    ephemeralMessage: { message: { groupStatusMessageV2: { message: { imageMessage: {} } } } }
  };
  assert.equal(antigroupstatus.isGroupStatusMessage({ raw: wrapped, message: {} }), true);
});

// AntiGroupStatus owns group-status POSTS; status MENTIONS belong to antigm.
test('AntiGroupStatus does not claim status mentions or ordinary messages', () => {
  assert.equal(antigroupstatus.isGroupStatusMessage({
    raw: { groupStatusMentionMessage: { message: {} } }, message: {}
  }), false);
  assert.equal(antigroupstatus.isGroupStatusMessage({
    raw: { extendedTextMessage: { text: 'hello' } }, message: { conversation: 'hello' }
  }), false);
});

test('AntiVV finds a view-once envelope nested under other wrappers', () => {
  const envelope = {
    documentWithCaptionMessage: { message: { viewOnceMessageV2: { message: { imageMessage: { caption: 'x' } } } } }
  };
  assert.equal(antivv.isViewOnceMessage({
    raw: envelope, message: envelope, msg: {}, serialized: {}
  }), true);
});

test('AutoVV recognises deeply nested view-once envelopes', () => {
  assert.equal(vv.isViewOnceEnvelope({
    documentWithCaptionMessage: { message: { viewOnceMessageV2: { message: { videoMessage: {} } } } }
  }), true);
  assert.equal(vv.isViewOnceEnvelope({ ephemeralMessage: { message: { viewOnceMessageV2: { message: {} } } } }), true);
  assert.equal(vv.isViewOnceEnvelope({ conversation: 'ordinary text' }), false);
});

// Regression: the antigroupstatus command must register under its own name
// even though antigm loads first and used to claim the name as an alias.
test('antigroupstatus registers as its own command and alias', () => {
  clearRegistry();
  addCommand(require('../src/Commands/Admin/antigm.js'));
  addCommand(antigroupstatus);
  assert.equal(getCommand('antigroupstatus').name, 'antigroupstatus');
  assert.equal(getCommand('antigs').name, 'antigroupstatus');
  assert.equal(getCommand('ags').name, 'antigroupstatus');
  assert.equal(getCommand('antigm').name, 'antigm');
});

// Regression: WhatsApp orders the keys inside a view-once envelope freely, so
// the media is often not the first one. Taking Object.keys(content)[0] made
// .vv and AutoVV reject real view-once media as "unsupported".
test('view-once media is found next to bookkeeping keys in any order', () => {
  const content = { messageContextInfo: { deviceListMetadataVersion: 2 }, imageMessage: { mimetype: 'image/jpeg' } };
  assert.deepEqual(vv.findMedia(content), { type: 'imageMessage', media: content.imageMessage });
  assert.equal(vv.findMedia({ conversation: 'hello' }), null);
});

// Regression: AutoVV scanned the whole envelope, quoted message included, so
// replying to a view-once message re-sent media the replier never posted.
test('AutoVV ignores a reply that merely quotes a view-once message', async () => {
  const chat = '120363000000000000@g.us';
  vv.setAutoVV(chat, true);
  const sent = [];
  const sock = { sendMessage: async (...args) => sent.push(args), groupMetadata: async () => null };
  const reply = {
    extendedTextMessage: {
      text: 'nice one',
      contextInfo: { quotedMessage: { viewOnceMessageV2: { message: { imageMessage: {} } } } }
    }
  };
  const m = { chat, key: { id: 'REPLY1', remoteJid: chat, participant: '111@s.whatsapp.net' }, message: reply, msg: reply.extendedTextMessage };
  const handled = await vv.handleAutoVV(sock, m, { key: m.key, message: reply });
  assert.equal(handled, false);
  assert.deepEqual(sent, []);
  vv.setAutoVV(chat, false);
});

test('wallpaper command loads without an undefined prefix reference', () => {
  const wallpaper = require('../src/Commands/Search/WP');
  assert.equal(wallpaper.usage, '.wallpaper <query>');
});
