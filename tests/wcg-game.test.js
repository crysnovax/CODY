'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const wcg = require('../src/Commands/Games/wcg');

const player = '15551234567@s.whatsapp.net';
const other = '15557654321@s.whatsapp.net';
function clear() { wcg._resetSessions(); }
function message(chat = '15551234567@s.whatsapp.net', sender = player) {
  return { chat, sender, key: { participant: sender, id: 'quoted-wcg' } };
}

test('metadata and bundled vocabulary provide a substantial curated word set', () => {
  assert.equal(wcg.name, 'wcg');
  assert.deepEqual(wcg.alias, ['wordchain', 'word-chain']);
  assert.equal(wcg.category, 'Games');
  assert.ok(wcg.WORD_LIST.length >= 500, `expected at least 500 words, got ${wcg.WORD_LIST.length}`);
  assert.ok(wcg.WORD_SET instanceof Set);
});

test('word normalization handles common punctuation while enforcing lowercase letters and minimum length', () => {
  assert.equal(wcg.normalizeWord('  Apple!  '), 'apple');
  assert.equal(wcg.normalizeWord('don’t'), 'dont');
  const session = wcg.createSession('solo', 'chat', [{ id: player }]);
  assert.equal(wcg.validateWord(session, 'a!', player).reason, 'short');
  assert.equal(wcg.validateWord(session, 'red fox', player).reason, 'letters');
  assert.equal(wcg.validateWord(session, 'notawordzzzz', player).reason, 'unknown');
});

test('accepted words obey chain and reuse rules; invalid words never consume the turn', () => {
  const session = wcg.createSession('group', 'room@g.us', [{ id: player }, { id: other }]);
  assert.equal(wcg.applyWord(session, 'apple', player).ok, true);
  assert.equal(session.currentPlayer, other);
  const before = { last: session.lastWord, turn: session.currentPlayer, count: session.history.length };
  assert.equal(wcg.applyWord(session, 'qzxqzx', other).reason, 'unknown');
  assert.equal(wcg.applyWord(session, 'banana', other).reason, 'chain');
  assert.equal(wcg.applyWord(session, 'apple', other).reason, 'repeated');
  assert.deepEqual({ last: session.lastWord, turn: session.currentPlayer, count: session.history.length }, before);
  assert.equal(wcg.applyWord(session, 'elephant', other).ok, true);
  assert.equal(session.currentPlayer, player);
});

test('solo bot answers with an unused linked dictionary word and detects a player win when none remains', () => {
  const bot = wcg.findBotWord('apple', new Set(['apple']), wcg.WORD_LIST, () => 0);
  assert.ok(bot);
  assert.equal(bot[0], 'e');
  assert.notEqual(bot, 'apple');
  assert.equal(wcg.findBotWord('quiz', new Set(wcg.WORD_LIST.filter(word => word.startsWith('z'))), wcg.WORD_LIST), null);
});

test('solo command starts a personal session, responds with bot continuation, and handles no-option win', async () => {
  clear();
  const calls = [];
  const sock = { sendPlogmeMessage: async (...args) => { calls.push(args); return 'ok'; } };
  const m = message();
  await wcg.execute(sock, m, { args: ['solo'] });
  const key = wcg.sessionKey('solo', m.chat, player);
  assert.ok(wcg.sessions.has(key));
  await wcg.execute(sock, m, { args: ['play', 'apple'] });
  let session = wcg.sessions.get(key);
  assert.equal(session.history.length, 2);
  assert.equal(session.history[0].word, 'apple');
  assert.equal(session.history[1].word[0], 'e');
  assert.equal(session.history[1].playerId, 'bot');
  assert.equal(session.history[0].word.at(-1), session.history[1].word[0]);
  assert.match(calls.at(-1)[1].text, /Bot:/);

  // Exhaust bot words beginning with z to deterministically prove the win path.
  session.usedWords = new Set(wcg.WORD_LIST.filter(word => word.startsWith('z')));
  session.lastWord = null;
  session.history = [];
  await wcg.execute(sock, m, { args: ['jazz'] });
  assert.equal(wcg.sessions.has(key), false);
  assert.equal(session.winner, player);
  assert.match(calls.at(-1)[1].text, /YOU WIN/);
  clear();
});

test('group start is group-only, join is deduplicated, and turns rotate only after valid words', async () => {
  clear();
  const sent = [];
  const sock = { sendPlogmeMessage: async (...args) => { sent.push(args); } };
  const direct = message('dm@s.whatsapp.net');
  await wcg.execute(sock, direct, { args: ['group'] });
  assert.match(sent.at(-1)[1].text, /only start inside a WhatsApp group/);
  assert.equal(wcg.sessions.size, 0);

  const chat = '120363000@g.us';
  const first = message(chat, player);
  await wcg.execute(sock, first, { args: ['group'] });
  const key = wcg.sessionKey('group', chat);
  const session = wcg.sessions.get(key);
  assert.deepEqual(session.players.map(entry => entry.id), [player]);
  await wcg.execute(sock, message(chat, other), { args: ['join'] });
  await wcg.execute(sock, message(chat, other), { args: ['join'] });
  assert.deepEqual(session.players.map(entry => entry.id), [player, other]);

  await wcg.execute(sock, message(chat, other), { args: ['apple'] });
  assert.equal(session.history.length, 0, 'out-of-turn play does not advance');
  await wcg.execute(sock, first, { args: ['apple'] });
  assert.equal(session.currentPlayer, other);
  assert.match(sent.at(-1)[1].text, /Player 2/);
  assert.doesNotMatch(sent.at(-1)[1].text, /@15557654321/);
  await wcg.execute(sock, message(chat, other), { args: ['elephant'] });
  assert.equal(session.currentPlayer, player);
  assert.equal(session.history.length, 2);
  clear();
});

test('group match ends with a winner when no unused word can continue the chain', async () => {
  clear();
  const sent = [];
  const sock = { sendPlogmeMessage: async (...args) => sent.push(args) };
  const chat = '120363002@g.us';
  const first = message(chat, player);
  await wcg.execute(sock, first, { args: ['group'] });
  await wcg.execute(sock, message(chat, other), { args: ['join'] });
  const key = wcg.sessionKey('group', chat);
  const session = wcg.sessions.get(key);
  session.usedWords = new Set(wcg.WORD_LIST.filter(word => word.startsWith('z')));

  await wcg.execute(sock, first, { args: ['jazz'] });
  assert.equal(session.winner, player);
  assert.equal(session.ended, true);
  assert.equal(wcg.sessions.has(key), false);
  assert.match(sent.at(-1)[1].text, /WINS/);
  clear();
});

test('session start never replaces an existing match; status and guarded forfeit work', async () => {
  clear();
  const calls = [];
  const sock = { sendPlogmeMessage: async (...args) => calls.push(args) };
  const chat = '120363001@g.us';
  const m = message(chat, player);
  await wcg.execute(sock, m, { args: ['group'] });
  const key = wcg.sessionKey('group', chat);
  const original = wcg.sessions.get(key);
  await wcg.execute(sock, message(chat, other), { args: ['group'] });
  assert.equal(wcg.sessions.get(key), original);
  await wcg.execute(sock, message(chat, other), { args: ['quit'] });
  assert.equal(wcg.sessions.get(key), original, 'non-player cannot terminate group match');
  await wcg.execute(sock, m, { args: ['status'] });
  assert.match(calls.at(-1)[1].text, /Group turn-taking/);
  await wcg.execute(sock, m, { args: ['quit'] });
  assert.equal(wcg.sessions.has(key), false);
  clear();
});

test('PLOGME dispatch uses requested rich-response signature; missing sender safely falls back', async () => {
  const richCalls = [];
  const m = message();
  await wcg.sendWcgMessage({ sendPlogmeMessage: async (...args) => richCalls.push(args) }, m, 'hello');
  assert.equal(richCalls.length, 1);
  assert.equal(richCalls[0][0], m.chat);
  assert.deepEqual(richCalls[0][1], { text: 'hello' });
  assert.equal(richCalls[0][2], m);
  assert.deepEqual(richCalls[0][3], { renderRichResponse: true });

  const fallbackCalls = [];
  await wcg.sendWcgMessage({ sendMessage: async (...args) => fallbackCalls.push(args) }, m, 'fallback');
  assert.deepEqual(fallbackCalls[0], [m.chat, { text: 'fallback' }, { quoted: m }]);
  let replied = '';
  await wcg.sendWcgMessage({}, m, 'reply fallback', async text => { replied = text; });
  assert.equal(replied, 'reply fallback');
});
