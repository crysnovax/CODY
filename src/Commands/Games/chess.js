'use strict';

const { sendHtmlGame } = require('../../Plugin/htmlGame');

// One pure rules engine is shared by the Node exports and the inline browser game.
function chessEngineFactory() {
  const files = 'abcdefgh';
  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const at = (r, c) => r * 8 + c;
  const row = i => Math.floor(i / 8);
  const col = i => i % 8;
  const colorOf = p => p ? (p === p.toUpperCase() ? 'w' : 'b') : null;
  const enemy = (a, b) => !!a && !!b && colorOf(a) !== colorOf(b);
  const clone = game => ({ ...game, board: game.board.slice(), history: (game.history || []).slice(), captured: (game.captured || []).slice() });

  function createGame() {
    return {
      board: 'rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR'.split('').map(p => p === '.' ? '' : p),
      turn: 'w', castling: 'KQkq', enPassant: null, halfmove: 0, fullmove: 1,
      history: [], captured: [], lastMove: null
    };
  }

  function isSquareAttacked(game, square, byColor) {
    const r = row(square), c = col(square), b = game.board;
    const pawnRow = r + (byColor === 'w' ? 1 : -1);
    for (const dc of [-1, 1]) if (inside(pawnRow, c + dc)) {
      const p = b[at(pawnRow, c + dc)];
      if (p && colorOf(p) === byColor && p.toLowerCase() === 'p') return true;
    }
    const knightSteps = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knightSteps) if (inside(r + dr, c + dc)) {
      const p = b[at(r + dr, c + dc)];
      if (p && colorOf(p) === byColor && p.toLowerCase() === 'n') return true;
    }
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]) {
      let rr = r + dr, cc = c + dc, distance = 1;
      while (inside(rr, cc)) {
        const p = b[at(rr, cc)];
        if (p) {
          if (colorOf(p) === byColor) {
            const type = p.toLowerCase();
            if (type === 'q' || (distance === 1 && type === 'k') ||
              (dr === 0 || dc === 0 ? type === 'r' : type === 'b')) return true;
          }
          break;
        }
        rr += dr; cc += dc; distance++;
      }
    }
    return false;
  }

  function kingSquare(game, color) {
    return game.board.findIndex(p => p && p.toLowerCase() === 'k' && colorOf(p) === color);
  }
  function isInCheck(game, color = game.turn) {
    const k = kingSquare(game, color);
    return k < 0 || isSquareAttacked(game, k, color === 'w' ? 'b' : 'w');
  }

  function pseudoMoves(game, from) {
    const b = game.board, p = b[from], color = colorOf(p), type = p.toLowerCase();
    const r = row(from), c = col(from), out = [];
    const add = (rr, cc, extra = {}) => {
      if (!inside(rr, cc)) return false;
      const to = at(rr, cc), target = b[to];
      if (target && (colorOf(target) === color || target.toLowerCase() === 'k')) return false;
      out.push({ from, to, ...extra });
      return !target;
    };
    if (type === 'p') {
      const dir = color === 'w' ? -1 : 1, start = color === 'w' ? 6 : 1, end = color === 'w' ? 0 : 7;
      if (inside(r + dir, c) && !b[at(r + dir, c)]) {
        const to = at(r + dir, c);
        out.push({ from, to, ...(r + dir === end ? { promotion: true } : {}) });
        if (r === start && !b[at(r + 2 * dir, c)]) out.push({ from, to: at(r + 2 * dir, c), doublePawn: true });
      }
      for (const dc of [-1, 1]) if (inside(r + dir, c + dc)) {
        const to = at(r + dir, c + dc), target = b[to];
        if (target && enemy(p, target) && target.toLowerCase() !== 'k') out.push({ from, to, ...(r + dir === end ? { promotion: true } : {}) });
        else if (to === game.enPassant) out.push({ from, to, enPassant: true });
      }
      return out;
    }
    if (type === 'n') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r + dr, c + dc);
      return out;
    }
    if (type === 'k') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(r + dr, c + dc);
      const home = color === 'w' ? 60 : 4, foe = color === 'w' ? 'b' : 'w';
      if (from === home && !isSquareAttacked(game, home, foe)) {
        const kingSide = color === 'w' ? 'K' : 'k', queenSide = color === 'w' ? 'Q' : 'q';
        if (game.castling.includes(kingSide) && !b[home + 1] && !b[home + 2] && b[home + 3] === (color === 'w' ? 'R' : 'r') &&
          !isSquareAttacked(game, home + 1, foe) && !isSquareAttacked(game, home + 2, foe)) out.push({ from, to: home + 2, castle: 'king' });
        if (game.castling.includes(queenSide) && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === (color === 'w' ? 'R' : 'r') &&
          !isSquareAttacked(game, home - 1, foe) && !isSquareAttacked(game, home - 2, foe)) out.push({ from, to: home - 2, castle: 'queen' });
      }
      return out;
    }
    const dirs = type === 'r' ? [[-1,0],[1,0],[0,-1],[0,1]] : type === 'b' ? [[-1,-1],[-1,1],[1,-1],[1,1]] : [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (inside(rr, cc)) { const clear = add(rr, cc); if (!clear) break; rr += dr; cc += dc; }
    }
    return out;
  }

  function applyUnchecked(game, move) {
    const next = clone(game), b = next.board, piece = b[move.from], target = b[move.to];
    b[move.from] = '';
    if (move.enPassant) b[move.to + (colorOf(piece) === 'w' ? 8 : -8)] = '';
    b[move.to] = move.promotion ? (colorOf(piece) === 'w' ? String(move.promotion).toUpperCase() : String(move.promotion).toLowerCase()) : piece;
    if (move.castle) {
      const home = colorOf(piece) === 'w' ? 60 : 4;
      const rookFrom = move.castle === 'king' ? home + 3 : home - 4;
      const rookTo = move.castle === 'king' ? home + 1 : home - 1;
      b[rookTo] = b[rookFrom]; b[rookFrom] = '';
    }
    const rights = new Set(next.castling.split(''));
    const removeRight = sq => ({60:['K','Q'],63:['K'],56:['Q'],4:['k','q'],7:['k'],0:['q']})[sq] || [];
    for (const right of [...removeRight(move.from), ...removeRight(move.to)]) rights.delete(right);
    next.castling = 'KQkq'.split('').filter(x => rights.has(x)).join('');
    next.enPassant = move.doublePawn ? (move.from + move.to) / 2 : null;
    next.halfmove = piece.toLowerCase() === 'p' || target || move.enPassant ? 0 : next.halfmove + 1;
    if (next.turn === 'b') next.fullmove++;
    next.turn = next.turn === 'w' ? 'b' : 'w';
    next.lastMove = { from: move.from, to: move.to };
    return next;
  }

  function legalMoves(game, from) {
    const starts = from === undefined ? game.board.map((p, i) => p && colorOf(p) === game.turn ? i : -1).filter(i => i >= 0) : [from];
    const moves = [];
    for (const start of starts) for (const move of pseudoMoves(game, start)) {
      const choices = move.promotion ? ['q', 'r', 'b', 'n'] : [null];
      for (const promotion of choices) {
        const candidate = promotion ? { ...move, promotion } : move;
        const next = applyUnchecked(game, candidate);
        if (!isInCheck(next, game.turn)) moves.push(candidate);
      }
    }
    return moves;
  }

  function makeMove(game, moveOrFrom, to, promotion = 'q') {
    const request = typeof moveOrFrom === 'object' ? moveOrFrom : { from: moveOrFrom, to, promotion };
    const move = legalMoves(game, request.from).find(m => m.to === request.to &&
      (!m.promotion || String(m.promotion).toLowerCase() === String(request.promotion || 'q').toLowerCase()));
    if (!move) return null;
    const capturedPiece = move.enPassant
      ? game.board[move.to + (game.turn === 'w' ? 8 : -8)]
      : game.board[move.to];
    const next = applyUnchecked(game, move);
    if (capturedPiece) next.captured = [...(game.captured || []), capturedPiece];
    next.history = [...(game.history || []), clone({ ...game, history: [] })];
    return next;
  }

  function gameStatus(game) {
    const check = isInCheck(game, game.turn), moves = legalMoves(game);
    if (!moves.length) return check ? { over: true, check: true, result: game.turn === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate' } : { over: true, check: false, result: 'Draw by stalemate' };
    return { over: false, check, result: check ? 'Check' : '' };
  }

  function squareName(i) { return files[col(i)] + (8 - row(i)); }
  return { createGame, legalMoves, makeMove, isInCheck, isSquareAttacked, gameStatus, squareName };
}

const engine = chessEngineFactory();
const PIECES = { K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙', k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟' };
const body = `<div class="sub">Classic chess for two people, taking turns on this same device.</div>
<div class="topline"><div id="turnBadge" class="turn"><i></i><span id="turnText">White to move</span></div><div id="moveCount" class="count">MOVE 1</div></div>
<div class="player black"><span class="dot"></span><span>BLACK</span><div id="blackTaken" class="taken"></div></div>
<div class="board-wrap"><div class="board" id="board" role="grid" aria-label="Chess board"></div></div>
<div class="player white"><span class="dot"></span><span>WHITE</span><div id="whiteTaken" class="taken"></div></div>
<div id="status" class="status">Select a piece to see its legal moves.</div>
<div class="controls"><button id="undo" class="btn">↶ &nbsp;Undo</button><button id="newGame" class="btn primary">New game</button></div>
<div class="foot">LOCAL PASS &amp; PLAY <span>·</span> No online opponent</div>
<div id="promo" class="promo" aria-hidden="true"><div class="promo-card"><b>Promote your pawn</b><span>Choose a piece</span><div id="promoChoices"></div></div></div>`;

const style = `<style>
:root{--ink:#17271f;--muted:#78867c;--paper:#f5f4ee;--green:#315d49;--gold:#c29248;--line:#e6e4da;--light:#eee9d9;--dark:#77977e;--hint:#efc666;--red:#b5483f}*{box-sizing:border-box}body{margin:0;padding:20px 14px 28px;background:radial-gradient(ellipse at 50% -15%,#fff 0,#f5f4ee 60%,#e9e9df 100%);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;touch-action:manipulation}.game{width:min(100%,480px);margin:auto;background:#fff;border:1px solid #e8e6dd;border-radius:24px;padding:21px;box-shadow:0 18px 48px #24382b12}h1{font-family:Georgia,serif;letter-spacing:.02em!important;font-size:33px!important;color:var(--ink)!important;line-height:1!important}.sub{margin:8px 0 18px!important;font-size:13px!important;color:var(--muted)!important}.topline{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.turn{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700}.turn i{width:11px;height:11px;background:#f8f6ee;border:2px solid #58665d;border-radius:50%;box-shadow:inset 0 0 0 2px #fff}.turn.black-turn i{background:#26362d;border-color:#26362d}.count{font-size:10px;letter-spacing:.13em;color:var(--muted);font-weight:800}.player{height:34px;display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:.15em;font-weight:800;color:#869087}.player .dot{height:11px;width:11px;border-radius:50%;background:#24372d;border:1px solid #24372d}.player.white .dot{background:#fff;border:2px solid #536158}.taken{display:flex;align-items:center;margin-left:4px;letter-spacing:0;color:#9b7a49;font-size:17px;white-space:nowrap}.board-wrap{padding:5px;border-radius:12px;background:#315d49;box-shadow:0 7px 16px #24382b18}.board{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));width:100%;aspect-ratio:1;overflow:hidden;border-radius:7px}.sq{position:relative;display:grid;place-items:center;border:0;padding:0;min-width:0;aspect-ratio:1;cursor:pointer;color:var(--ink);-webkit-tap-highlight-color:transparent}.sq.light{background:#eee9d9}.sq.dark{background:#77977e}.sq.selected{box-shadow:inset 0 0 0 4px #e9b957;z-index:1}.sq.last{background:#d6ca7e}.sq.check{background:#c46758}.piece{font-family:"Arial Unicode MS","Segoe UI Symbol",serif;line-height:1;font-size:clamp(27px,9vw,48px);filter:drop-shadow(0 1px 1px #18251c30);user-select:none}.piece.w{color:#fff;text-shadow:-1px -1px 0 #405247,1px -1px 0 #405247,-1px 1px 0 #405247,1px 1px 0 #405247,0 2px 2px #26372c45}.piece.b{color:#26372d;text-shadow:0 1px 1px #fff8}.hint{position:absolute;width:22%;height:22%;border-radius:50%;background:#284b3680;pointer-events:none}.sq.has-piece .hint{width:83%;height:83%;background:transparent;border:4px solid #284b3680}.coord{position:absolute;font:700 9px/1 system-ui;pointer-events:none;opacity:.75}.coord.file{right:4px;bottom:3px}.coord.rank{left:4px;top:3px}.sq.light .coord{color:#526d58}.sq.dark .coord{color:#f5f0de}.status{min-height:37px;margin:10px 0 7px;display:flex;align-items:center;justify-content:center;text-align:center;color:#66746a;font-size:12px;font-weight:600}.status.alert{color:var(--red);font-weight:800}.controls{display:flex;gap:9px}.btn{flex:1;border:1px solid var(--line);background:#fff;color:#435449;border-radius:12px;padding:12px 13px;font:700 13px inherit;cursor:pointer}.btn.primary{background:var(--green);color:#fff;border-color:var(--green)}.btn:active{transform:scale(.98)}.foot{text-align:center;margin-top:17px;font-size:9px;letter-spacing:.14em;font-weight:800;color:#9aa39b}.foot span{padding:0 4px;color:var(--gold)}.promo{display:none;position:fixed;inset:0;background:#17271f99;place-items:center;padding:20px;z-index:4}.promo.open{display:grid}.promo-card{background:#fff;border-radius:18px;padding:20px;width:min(100%,310px);text-align:center;box-shadow:0 18px 50px #0004}.promo-card b,.promo-card span{display:block}.promo-card b{font:700 18px Georgia,serif}.promo-card span{color:#829087;font-size:12px;margin:5px 0 15px}.promo-card #promoChoices{display:flex;gap:8px}.promo-card button{flex:1;border:1px solid #e4e7df;border-radius:11px;background:#f5f6f1;font-size:32px;padding:7px 0;cursor:pointer}.promo-card button:active{background:#dce9de}@media(max-width:360px){body{padding:10px}.game{padding:15px;border-radius:19px}.piece{font-size:10vw}}
</style>`;

const browserCode = `(()=>{const E=chessEngineFactory(),glyphs=${JSON.stringify(PIECES)};let game=E.createGame(),selected=null,targets=[],pending=null;const board=document.getElementById('board'),status=document.getElementById('status'),turnText=document.getElementById('turnText');const files='abcdefgh';
function setStatus(text,alert=false){status.textContent=text;status.classList.toggle('alert',alert)}
function render(){board.innerHTML='';const state=E.gameStatus(game),king=game.board.findIndex(p=>p&&(p==='K'||p==='k')&&((p==='K'?'w':'b')===game.turn));for(let i=0;i<64;i++){const p=game.board[i],sq=document.createElement('button'),r=Math.floor(i/8),c=i%8;sq.className='sq '+((r+c)%2?'dark':'light')+(p?' has-piece':'');sq.setAttribute('role','gridcell');sq.setAttribute('aria-label',(p?({K:'White king',Q:'White queen',R:'White rook',B:'White bishop',N:'White knight',P:'White pawn',k:'Black king',q:'Black queen',r:'Black rook',b:'Black bishop',n:'Black knight',p:'Black pawn'})[p]+' on ':'')+files[c]+(8-r));if(selected===i)sq.classList.add('selected');if(game.lastMove&&(game.lastMove.from===i||game.lastMove.to===i))sq.classList.add('last');if(state.check&&i===king)sq.classList.add('check');if(targets.some(m=>m.to===i)){const dot=document.createElement('span');dot.className='hint';sq.appendChild(dot)}if(p){const piece=document.createElement('span');piece.className='piece '+(p===p.toUpperCase()?'w':'b');piece.textContent=glyphs[p];sq.appendChild(piece)}if(r===7){const label=document.createElement('span');label.className='coord file';label.textContent=files[c];sq.appendChild(label)}if(c===0){const label=document.createElement('span');label.className='coord rank';label.textContent=8-r;sq.appendChild(label)}sq.addEventListener('click',()=>clickSquare(i));board.appendChild(sq)}
const side=game.turn==='w'?'White':'Black';turnText.textContent=state.over?state.result:side+' to move';document.getElementById('turnBadge').classList.toggle('black-turn',game.turn==='b');document.getElementById('moveCount').textContent='MOVE '+game.fullmove;document.getElementById('undo').disabled=!game.history.length;document.getElementById('undo').style.opacity=game.history.length?1:.48;const captured={w:[],b:[]};for(const piece of(game.captured||[]))captured[piece===piece.toUpperCase()?'w':'b'].push(glyphs[piece]);document.getElementById('whiteTaken').textContent=captured.b.join(' ');document.getElementById('blackTaken').textContent=captured.w.join(' ');if(state.over)setStatus(state.result,true);else if(state.check)setStatus(side+' is in check — make a safe move.',true);else setStatus(selected!==null?'Choose a highlighted square.':'Select a piece to see its legal moves.')}
function clickSquare(i){if(pending)return;const p=game.board[i];if(selected!==null){const options=targets.filter(m=>m.to===i);if(options.length){if(options[0].promotion){pending={from:selected,to:i};showPromotion()}else play(selected,i);return}}if(p&&(p===p.toUpperCase()?'w':'b')===game.turn){selected=i;targets=E.legalMoves(game,i);render()}else{selected=null;targets=[];render()}}
function play(from,to,promotion='q'){const next=E.makeMove(game,from,to,promotion);if(next)game=next;selected=null;targets=[];render()}
function showPromotion(){const modal=document.getElementById('promo'),choices=document.getElementById('promoChoices'),white=game.turn==='w';choices.innerHTML='';for(const t of ['q','r','b','n']){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',{q:'Queen',r:'Rook',b:'Bishop',n:'Knight'}[t]);b.textContent=glyphs[white?t.toUpperCase():t];b.onclick=()=>{const x=pending;pending=null;modal.classList.remove('open');play(x.from,x.to,t)};choices.appendChild(b)}modal.classList.add('open')}
document.getElementById('undo').onclick=()=>{if(game.history.length){game=game.history[game.history.length-1];selected=null;targets=[];pending=null;render()}};document.getElementById('newGame').onclick=()=>{game=E.createGame();selected=null;targets=[];pending=null;document.getElementById('promo').classList.remove('open');render()};render()})();`;

module.exports = {
  name: 'chess', alias: ['chessgame'], desc: 'Play classic two-player chess on one device', category: 'Games',
  ...engine,
  execute: async (sock, m) => sendHtmlGame(sock, m, 'CHESS', '#315d49', `${style}${body}`, `${chessEngineFactory.toString()};${browserCode}`)
};
