'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const chess = require('../src/Commands/Games/chess');

const square = name => (8 - Number(name[1])) * 8 + name.charCodeAt(0) - 97;
function emptyGame(pieces, turn = 'w', castling = '') {
  const game = chess.createGame();
  game.board = Array(64).fill('');
  for (const [name, piece] of Object.entries(pieces)) game.board[square(name)] = piece;
  game.turn = turn;
  game.castling = castling;
  game.enPassant = null;
  game.history = [];
  return game;
}
function play(game, from, to, promotion) {
  const next = chess.makeMove(game, square(from), square(to), promotion);
  assert.ok(next, `expected legal move ${from}-${to}`);
  return next;
}

test('basic opening moves are legal, blocked movement is not, and turns alternate', () => {
  const game = chess.createGame();
  const legal = chess.legalMoves(game);
  assert.ok(legal.some(m => m.from === square('e2') && m.to === square('e4')));
  assert.ok(legal.some(m => m.from === square('b1') && m.to === square('a3')));
  assert.ok(!legal.some(m => m.from === square('a1') && m.to === square('a3')));
  const next = play(game, 'e2', 'e4');
  assert.equal(next.turn, 'b');
  assert.equal(game.turn, 'w', 'moves do not mutate the previous state');
  assert.equal(next.enPassant, square('e3'));
});

test('captures are tracked for the interface and undo restores the prior capture list', () => {
  const game = emptyGame({ a1: 'R', a8: 'n', h1: 'K', h8: 'k' });
  const next = play(game, 'a1', 'a8');
  assert.deepEqual(next.captured, ['n']);
  assert.deepEqual(game.captured, []);
  assert.deepEqual(next.history[0].captured, []);
});

test('king safety rejects a pinned-piece move that exposes check', () => {
  const game = emptyGame({ a8: 'k', e8: 'r', e1: 'K', e2: 'R' });
  assert.equal(chess.isInCheck(game, 'w'), false);
  assert.equal(chess.legalMoves(game, square('e2')).some(m => m.to === square('f2')), false);
  assert.equal(chess.makeMove(game, square('e2'), square('f2')), null);
});

test('castling moves king and rook, and cannot cross an attacked square', () => {
  const game = emptyGame({ e1: 'K', h1: 'R', e8: 'k' }, 'w', 'K');
  assert.ok(chess.legalMoves(game, square('e1')).some(m => m.to === square('g1') && m.castle === 'king'));
  const castle = play(game, 'e1', 'g1');
  assert.equal(castle.board[square('g1')], 'K');
  assert.equal(castle.board[square('f1')], 'R');
  assert.equal(castle.castling, '');
  const attacked = emptyGame({ e1: 'K', h1: 'R', e8: 'k', f8: 'r' }, 'w', 'K');
  assert.equal(chess.legalMoves(attacked, square('e1')).some(m => m.castle), false);
});

test('en passant is available only immediately after a double pawn move', () => {
  let game = emptyGame({ a1: 'K', h8: 'k', e5: 'P', d7: 'p' }, 'b');
  game = play(game, 'd7', 'd5');
  assert.equal(game.enPassant, square('d6'));
  assert.ok(chess.legalMoves(game, square('e5')).some(m => m.to === square('d6') && m.enPassant));
  game = play(game, 'e5', 'd6');
  assert.equal(game.board[square('d5')], '');
  assert.equal(game.board[square('d6')], 'P');
  assert.equal(game.enPassant, null);
});

test('promotion defaults to queen and supports a selected underpromotion', () => {
  const game = emptyGame({ h1: 'K', h8: 'k', a7: 'P' });
  const options = chess.legalMoves(game, square('a7')).filter(m => m.to === square('a8'));
  assert.deepEqual(options.map(m => m.promotion).sort(), ['b', 'n', 'q', 'r']);
  assert.equal(play(game, 'a7', 'a8').board[square('a8')], 'Q');
  assert.equal(play(game, 'a7', 'a8', 'n').board[square('a8')], 'N');
});

test('checkmate and stalemate are correctly reported', () => {
  let game = chess.createGame();
  game = play(game, 'f2', 'f3');
  game = play(game, 'e7', 'e5');
  game = play(game, 'g2', 'g4');
  game = play(game, 'd8', 'h4');
  assert.deepEqual(chess.gameStatus(game), { over: true, check: true, result: 'Black wins by checkmate' });
  const stale = emptyGame({ a8: 'k', c6: 'K', b6: 'Q' }, 'b');
  assert.deepEqual(chess.gameStatus(stale), { over: true, check: false, result: 'Draw by stalemate' });
});

test('command dispatch uses sendHtmlMessage with responsive, truthful pass-and-play HTML', async () => {
  const calls = [];
  const sock = { sendHtmlMessage: async (...args) => { calls.push(args); return 'sent'; } };
  const message = { chat: 'chat-123', key: 'quoted-message' };
  assert.equal(await chess.execute(sock, message), 'sent');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], message.chat);
  assert.equal(calls[0][2].quoted, message);
  const html = calls[0][1].html;
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /same device/);
  assert.match(html, /No online opponent/);
  assert.match(html, /id="board"/);
  assert.match(html, /Chess classic|CHESS/);
});
