'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ludo = require('../src/Commands/Games/ludo.js');

function moveReadyState({ currentPlayer = 0, roll = 1, tokens } = {}) {
    const state = ludo.createGameState(4);
    state.currentPlayer = currentPlayer;
    state.phase = 'move';
    state.lastRoll = roll;
    if (tokens) state.players[currentPlayer].tokens = [...tokens];
    return state;
}

test('Ludo command metadata and player-count state creation', () => {
    assert.equal(ludo.name, 'ludo');
    assert.ok(ludo.alias.includes('parcheesi'));
    assert.equal(ludo.createGameState(2).players.length, 2);
    assert.equal(ludo.createGameState(4).players.length, 4);
    for (const player of ludo.createGameState(4).players) assert.deepEqual(player.tokens, [-1, -1, -1, -1]);
    assert.throws(() => ludo.createGameState(3), /2 or 4/);
});

test('a six lets a token enter from the yard; other rolls do not', () => {
    const state = ludo.createGameState(2);
    const three = ludo.rollDice(state, 3);
    assert.equal(three.currentPlayer, 1, 'no legal move passes the turn');
    assert.equal(three.phase, 'roll');
    assert.equal(three.lastRoll, null);

    const six = ludo.rollDice(state, 6);
    assert.equal(six.phase, 'move');
    assert.deepEqual(ludo.getLegalMoves(six), [0, 1, 2, 3]);
    const moved = ludo.moveToken(six, 2);
    assert.equal(moved.state.players[0].tokens[2], 0);
    assert.equal(moved.state.currentPlayer, 0, 'moving a six grants another roll');
    assert.equal(moved.state.phase, 'roll');
    assert.equal(ludo.moveToken(six, 9), null);
});

test('six grants an extra turn even when no token can enter or move', () => {
    const state = ludo.createGameState(4);
    state.players[0].tokens = [56, 57, 57, 57];
    const afterSix = ludo.rollDice(state, 6);
    assert.equal(afterSix.phase, 'roll');
    assert.equal(afterSix.currentPlayer, 0);
    assert.equal(afterSix.lastRoll, null);
});

test('safe-square landings are protected, while unsafe landings capture and return opponents to yard', () => {
    const captureState = moveReadyState({ roll: 1, tokens: [0, -1, -1, -1] });
    captureState.players[1].tokens[0] = 40; // Jade advances from track 6 to 7; Gold occupies track 7.
    const captured = ludo.moveToken(captureState, 0);
    assert.deepEqual(captured.captured, [{ player: 'gold', token: 0 }]);
    assert.equal(captured.state.players[1].tokens[0], -1);
    assert.equal(captured.state.players[0].tokens[0], 1);

    const safeState = moveReadyState({ roll: 1, tokens: [1, -1, -1, -1] });
    safeState.players[1].tokens[0] = 41; // Jade reaches safe square 8.
    const safe = ludo.moveToken(safeState, 0);
    assert.deepEqual(safe.captured, []);
    assert.equal(safe.state.players[1].tokens[0], 41);
    assert.ok(ludo.SAFE_SQUARES.includes(ludo.trackPosition('jade', 2)));
});

test('finishing requires the exact roll and wins only after all four tokens reach home', () => {
    const almost = moveReadyState({ roll: 2, tokens: [56, 57, 57, 57] });
    assert.deepEqual(ludo.getLegalMoves(almost), [], 'overshooting the finish is illegal');
    assert.equal(ludo.moveToken(almost, 0), null);

    const exact = moveReadyState({ roll: 1, tokens: [56, 57, 57, 57] });
    assert.deepEqual(ludo.getLegalMoves(exact), [0]);
    const won = ludo.moveToken(exact, 0).state;
    assert.equal(won.phase, 'won');
    assert.equal(won.winner, 'jade');
    assert.ok(won.players[0].tokens.every(progress => progress === ludo.FINISH_PROGRESS));
});

test('track positions wrap around the 52-cell loop', () => {
    assert.equal(ludo.trackPosition('jade', 0), 6);
    assert.equal(ludo.trackPosition('jade', 46), 0);
    assert.equal(ludo.trackPosition('jade', 52), null);
    assert.equal(ludo.trackPosition('unknown', 0), null);
});

test('command dispatch sends an interactive local pass-and-play HTML document through the shared helper', async () => {
    const calls = [];
    const message = { chat: '12345@g.us', key: { id: 'ludo-test' } };
    const sock = { sendHtmlMessage: async (...args) => { calls.push(args); return { key: { id: 'html-game' } }; } };
    const result = await ludo.execute(sock, message);
    assert.equal(result.key.id, 'html-game');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], message.chat);
    assert.equal(calls[0][2].quoted, message);
    const html = calls[0][1].html;
    assert.match(html, /LOCAL PASS &amp; PLAY/);
    assert.match(html, /id="cg-ludo-roll"/);
    assert.match(html, /id="cg-ludo-board"/);
    assert.match(html, /addEventListener\('click',doRoll\)/);
    assert.match(html, /pass the device/i);
    assert.doesNotMatch(html, /WebSocket|socket\.io|fetch\(/i);
});
