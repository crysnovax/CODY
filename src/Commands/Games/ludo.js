'use strict';

const { sendHtmlGame } = require('../../Plugin/htmlGame');

const TRACK_LENGTH = 52;
const FINISH_PROGRESS = 57;
const SAFE_SQUARES = Object.freeze([0, 8, 13, 21, 26, 34, 39, 47]);
const COLORS = Object.freeze([
    { id: 'jade', name: 'Jade', hex: '#36d399', start: 6 },
    { id: 'gold', name: 'Gold', hex: '#ffc857', start: 19 },
    { id: 'azure', name: 'Azure', hex: '#62a8ff', start: 32 },
    { id: 'coral', name: 'Coral', hex: '#ff7185', start: 45 },
]);

function createGameState(playerCount = 4) {
    if (playerCount !== 2 && playerCount !== 4) throw new RangeError('Ludo supports 2 or 4 players');
    const colors = playerCount === 2 ? [COLORS[0], COLORS[2]] : COLORS;
    return {
        players: colors.map(color => ({
            color: color.id,
            name: color.name,
            tokens: [-1, -1, -1, -1],
        })),
        currentPlayer: 0,
        phase: 'roll',
        lastRoll: null,
        winner: null,
    };
}

function trackPosition(color, progress) {
    const playerColor = COLORS.find(item => item.id === color);
    if (!playerColor || !Number.isInteger(progress) || progress < 0 || progress >= TRACK_LENGTH) return null;
    return (playerColor.start + progress) % TRACK_LENGTH;
}

function getLegalMoves(state, roll = state?.lastRoll) {
    if (!state || state.phase !== 'move' || !Number.isInteger(roll) || roll < 1 || roll > 6) return [];
    const player = state.players[state.currentPlayer];
    if (!player) return [];
    return player.tokens.reduce((moves, progress, tokenIndex) => {
        if (progress === -1 ? roll === 6 : progress < FINISH_PROGRESS && progress + roll <= FINISH_PROGRESS) {
            moves.push(tokenIndex);
        }
        return moves;
    }, []);
}

function rollDice(state, value) {
    if (!state || state.phase !== 'roll' || state.winner || !Number.isInteger(value) || value < 1 || value > 6) return null;
    const next = structuredClone(state);
    next.lastRoll = value;
    const player = next.players[next.currentPlayer];
    const canMove = player.tokens.some(progress => progress === -1 ? value === 6 : progress < FINISH_PROGRESS && progress + value <= FINISH_PROGRESS);
    if (canMove) {
        next.phase = 'move';
    } else {
        next.phase = 'roll';
        next.lastRoll = null;
        if (value !== 6) next.currentPlayer = (next.currentPlayer + 1) % next.players.length;
    }
    return next;
}

function moveToken(state, tokenIndex) {
    const legal = getLegalMoves(state);
    if (!legal.includes(tokenIndex)) return null;
    const next = structuredClone(state);
    const movingPlayer = next.players[next.currentPlayer];
    const roll = next.lastRoll;
    movingPlayer.tokens[tokenIndex] = movingPlayer.tokens[tokenIndex] === -1 ? 0 : movingPlayer.tokens[tokenIndex] + roll;
    const destination = movingPlayer.tokens[tokenIndex];
    const captured = [];

    if (destination < TRACK_LENGTH) {
        const square = trackPosition(movingPlayer.color, destination);
        if (!SAFE_SQUARES.includes(square)) {
            next.players.forEach((opponent, playerIndex) => {
                if (playerIndex === next.currentPlayer) return;
                opponent.tokens.forEach((progress, opponentToken) => {
                    if (progress >= 0 && progress < TRACK_LENGTH && trackPosition(opponent.color, progress) === square) {
                        opponent.tokens[opponentToken] = -1;
                        captured.push({ player: opponent.color, token: opponentToken });
                    }
                });
            });
        }
    }

    next.lastRoll = null;
    if (movingPlayer.tokens.every(progress => progress === FINISH_PROGRESS)) {
        next.phase = 'won';
        next.winner = movingPlayer.color;
    } else {
        next.phase = 'roll';
        if (roll !== 6) next.currentPlayer = (next.currentPlayer + 1) % next.players.length;
    }
    return { state: next, captured };
}

const BOARD_BODY = `<div class="cg-ludo-head"><div><span class="cg-ludo-eyebrow">LOCAL PASS &amp; PLAY</span><div class="cg-ludo-mode">One device · take turns passing it around</div></div><div class="cg-ludo-players"><button class="cg-ludo-mode-btn" id="cg-ludo-two" type="button">2 PLAYERS</button><button class="cg-ludo-mode-btn active" id="cg-ludo-four" type="button">4 PLAYERS</button></div></div>
<div class="cg-ludo-board-wrap"><svg id="cg-ludo-board" class="cg-ludo-board" viewBox="0 0 400 400" role="img" aria-label="Ludo board"></svg></div>
<div class="cg-ludo-turn"><div class="cg-ludo-turn-copy"><span id="cg-ludo-turn-label">JADE'S TURN</span><span id="cg-ludo-status">Roll the die to begin.</span></div><div id="cg-ludo-die" class="cg-ludo-die" aria-live="polite">—</div></div>
<div class="cg-ludo-actions"><button class="cg-ludo-roll" id="cg-ludo-roll" type="button">ROLL DICE</button><button class="cg-ludo-reset" id="cg-ludo-reset" type="button" aria-label="Start a new game">↻</button></div>
<div class="cg-ludo-legend"><span><i class="cg-ludo-dot jade"></i>Jade</span><span><i class="cg-ludo-dot gold"></i>Gold</span><span><i class="cg-ludo-dot azure"></i>Azure</span><span><i class="cg-ludo-dot coral"></i>Coral</span><span class="cg-ludo-safe-key">✦ Safe square</span></div>
<div id="cg-ludo-message" class="cg-ludo-message" aria-live="polite">Roll a 6 to bring a token out of the yard.</div>`;

const BOARD_SCRIPT = `(function(){
'use strict';
const C=[{id:'jade',name:'Jade',hex:'#36d399',start:6},{id:'gold',name:'Gold',hex:'#ffc857',start:19},{id:'azure',name:'Azure',hex:'#62a8ff',start:32},{id:'coral',name:'Coral',hex:'#ff7185',start:45}];
const SAFE=[0,8,13,21,26,34,39,47],FINISH=57;
const board=document.getElementById('cg-ludo-board'),turnLabel=document.getElementById('cg-ludo-turn-label'),status=document.getElementById('cg-ludo-status'),die=document.getElementById('cg-ludo-die'),rollButton=document.getElementById('cg-ludo-roll'),message=document.getElementById('cg-ludo-message');
let playerCount=4,state=newState(4);
function newState(n){const colors=n===2?[C[0],C[2]]:C;return{players:colors.map(c=>({color:c.id,name:c.name,tokens:[-1,-1,-1,-1]})),currentPlayer:0,phase:'roll',lastRoll:null,winner:null}}
function trackPosition(color,progress){const c=C.find(item=>item.id===color);return c&&(progress>=0&&progress<52)?(c.start+progress)%52:null}
function legalMoves(){if(state.phase!=='move')return[];return state.players[state.currentPlayer].tokens.reduce((a,p,i)=>{if(p===-1?state.lastRoll===6:(p<FINISH&&p+state.lastRoll<=FINISH))a.push(i);return a},[])}
function positions(){const out=[];for(let i=0;i<13;i++)out.push({x:95+i*17.5,y:95});for(let i=0;i<13;i++)out.push({x:305,y:95+i*17.5});for(let i=0;i<13;i++)out.push({x:305-i*17.5,y:305});for(let i=0;i<13;i++)out.push({x:95,y:305-i*17.5});return out}
const track=positions();
function svg(tag,attrs,text){let a='';for(const k in attrs)a+=' '+k+'="'+attrs[k]+'"';return'<'+tag+a+'>'+(text||'')+'</'+tag+'>'}
function render(){
 const active=state.players[state.currentPlayer],moves=legalMoves(),parts=[];
 parts.push('<rect x="8" y="8" width="384" height="384" rx="30" fill="#0a1020" stroke="#263653" stroke-width="2"/>');
 const yards=[{x:16,y:16,c:C[0]},{x:274,y:16,c:C[1]},{x:274,y:274,c:C[2]},{x:16,y:274,c:C[3]}];
 yards.forEach(y=>{if(!state.players.some(p=>p.color===y.c.id))return;parts.push('<rect x="'+y.x+'" y="'+y.y+'" width="110" height="110" rx="20" fill="'+y.c.hex+'" fill-opacity=".13" stroke="'+y.c.hex+'" stroke-opacity=".58" stroke-width="2"/>');parts.push('<text x="'+(y.x+55)+'" y="'+(y.y+20)+'" text-anchor="middle" fill="'+y.c.hex+'" font-size="10" font-weight="800" letter-spacing="1.4">'+y.c.name.toUpperCase()+'</text>')});
 track.forEach((pos,index)=>{const safe=SAFE.includes(index),starter=C.find(c=>c.start===index),fill=starter?starter.hex:(safe?'#e8edff':'#e8edff');parts.push('<rect x="'+(pos.x-7.6)+'" y="'+(pos.y-7.6)+'" width="15.2" height="15.2" rx="4" fill="'+fill+'" fill-opacity="'+(starter?'.95':safe?'.2':'.78')+'" stroke="'+(safe?'#fff':'#10182b')+'" stroke-opacity=".65" stroke-width="1.2"/>');if(safe)parts.push('<text x="'+pos.x+'" y="'+(pos.y+3.4)+'" text-anchor="middle" fill="'+(starter?'#102016':'#7282a0')+'" font-size="9">✦</text>')});
 C.forEach(c=>{const occupied=state.players.some(p=>p.color===c.id);if(!occupied)return;let x=200,y=200;if(c.id==='jade')y=118;if(c.id==='gold')x=282;if(c.id==='azure')y=282;if(c.id==='coral')x=118;for(let i=1;i<=5;i++){let px=x,py=y;if(c.id==='jade')py=112+i*13;if(c.id==='gold')px=288-i*13;if(c.id==='azure')py=288-i*13;if(c.id==='coral')px=112+i*13;parts.push('<rect x="'+(px-7)+'" y="'+(py-7)+'" width="14" height="14" rx="4" fill="'+c.hex+'" fill-opacity=".32" stroke="'+c.hex+'" stroke-opacity=".55"/>')}});
 parts.push('<path d="M200 153 L247 200 L200 247 L153 200 Z" fill="#111a2b" stroke="#344461" stroke-width="2"/>');parts.push('<path d="M200 153 L200 200 L153 200 Z" fill="'+C[0].hex+'"/><path d="M200 153 L247 200 L200 200 Z" fill="'+C[1].hex+'"/><path d="M247 200 L200 247 L200 200 Z" fill="'+C[2].hex+'"/><path d="M200 247 L153 200 L200 200 Z" fill="'+C[3].hex+'"/><circle cx="200" cy="200" r="8" fill="#f6f7ff" stroke="#0b1020" stroke-width="3"/>');
 state.players.forEach(p=>{const ci=C.findIndex(c=>c.id===p.color),color=C[ci];p.tokens.forEach((progress,ti)=>{let x,y;if(progress===-1){const corner=yards.find(v=>v.c.id===p.color);const offsets=[[40,48],[76,48],[40,80],[76,80]][ti];x=corner.x+offsets[0];y=corner.y+offsets[1]}else if(progress===FINISH){const homes={jade:[200,200],gold:[200,200],azure:[200,200],coral:[200,200]};x=homes[p.color][0]+(ti%2)*8-4;y=homes[p.color][1]+Math.floor(ti/2)*8-4}else if(progress>=52){const n=progress-51;if(p.color==='jade'){x=200;y=112+n*13}else if(p.color==='gold'){x=288-n*13;y=200}else if(p.color==='azure'){x=200;y=288-n*13}else{x=112+n*13;y=200}}else{const pos=track[trackPosition(p.color,progress)];x=pos.x;y=pos.y;const same=state.players.flatMap(op=>op.tokens.map((v,j)=>({op,j,v}))).filter(q=>q.v===progress&&q.op.color===p.color);if(same.length>1){const idx=same.findIndex(q=>q.j===ti);x+=(idx%2?4:-4);y+=(idx<2?-4:4)}}
 const movable=p===active&&moves.includes(ti),finished=progress===FINISH;parts.push('<g class="cg-ludo-piece'+(movable?' movable':'')+'" data-player="'+state.players.indexOf(p)+'" data-token="'+ti+'" tabindex="'+(movable?'0':'-1')+'" role="button" aria-label="'+p.name+' token '+(ti+1)+(movable?', move token':'')+'" style="cursor:'+(movable?'pointer':'default')+'"><circle cx="'+x+'" cy="'+y+'" r="'+(progress===-1?11:10)+'" fill="'+color.hex+'" stroke="'+(movable?'#fff':'#10182b')+'" stroke-width="'+(movable?3:2)+'"/><circle cx="'+x+'" cy="'+y+'" r="3.2" fill="#fff" fill-opacity=".86"/>'+(finished?'<text x="'+x+'" y="'+(y+3)+'" text-anchor="middle" fill="#0b1020" font-size="9" font-weight="900">✓</text>':'')+'</g>')})});
 board.innerHTML=parts.join('');
 turnLabel.textContent=state.phase==='won'?state.winner.toUpperCase()+' WINS':active.name.toUpperCase()+"'S TURN";turnLabel.style.color=(C.find(c=>c.id===(state.winner||active.color))||C[0]).hex;
 status.textContent=state.phase==='won'?'All four tokens made it home!':state.phase==='move'?'Choose a glowing token to move.':"Tap roll when you're ready.";
 die.textContent=state.lastRoll||'—';rollButton.disabled=state.phase!=='roll';rollButton.textContent=state.phase==='won'?'GAME OVER':state.phase==='move'?'CHOOSE TOKEN':'ROLL DICE';
 document.getElementById('cg-ludo-two').classList.toggle('active',playerCount===2);document.getElementById('cg-ludo-four').classList.toggle('active',playerCount===4);
}
function doRoll(){if(state.phase!=='roll')return;const value=Math.floor(Math.random()*6)+1;state.lastRoll=value;const can=legalFor(value);const player=state.players[state.currentPlayer];if(!can.length){const six=value===6;state.lastRoll=null;if(!six)state.currentPlayer=(state.currentPlayer+1)%state.players.length;message.textContent=value===6?player.name+' rolled a 6 but has no legal move — roll again.':player.name+' rolled '+value+' and has no legal move. Turn passed.';render();return}state.phase='move';message.textContent=value===6?player.name+' rolled a 6 — choose a token. A six earns another turn.':'Rolled '+value+' — choose one of the glowing tokens.';render()}
function legalFor(value){return state.players[state.currentPlayer].tokens.reduce((a,p,i)=>{if(p===-1?value===6:(p<FINISH&&p+value<=FINISH))a.push(i);return a},[])}
function doMove(index){const moves=legalMoves();if(!moves.includes(index))return;const p=state.players[state.currentPlayer],roll=state.lastRoll,old=p.tokens[index];p.tokens[index]=old===-1?0:old+roll;let got=[];if(p.tokens[index]<52){const square=trackPosition(p.color,p.tokens[index]);if(!SAFE.includes(square)){state.players.forEach((opponent,oi)=>{if(oi===state.currentPlayer)return;opponent.tokens.forEach((progress,ti)=>{if(progress>=0&&progress<52&&trackPosition(opponent.color,progress)===square){opponent.tokens[ti]=-1;got.push(opponent.name)}})})}}const player=p.name;state.lastRoll=null;if(p.tokens.every(v=>v===FINISH)){state.phase='won';state.winner=p.color;message.textContent=player+' wins — all four tokens are home!'}else{state.phase='roll';if(roll!==6)state.currentPlayer=(state.currentPlayer+1)%state.players.length;message.textContent=(got.length?'Captured '+got.join(', ')+' token'+(got.length===1?'':'s')+'! ':'')+(roll===6?'Six! '+player+' rolls again.':'Pass the device to the next player.')};render()}
board.addEventListener('click',function(event){const piece=event.target.closest('.cg-ludo-piece');if(piece)doMove(Number(piece.getAttribute('data-token')))});board.addEventListener('keydown',function(event){if((event.key==='Enter'||event.key===' ')&&event.target.classList.contains('cg-ludo-piece')){event.preventDefault();doMove(Number(event.target.getAttribute('data-token')))}});
rollButton.addEventListener('click',doRoll);document.getElementById('cg-ludo-reset').addEventListener('click',function(){state=newState(playerCount);message.textContent='New game started. Roll a 6 to bring a token out of the yard.';render()});
document.getElementById('cg-ludo-two').addEventListener('click',function(){playerCount=2;state=newState(2);message.textContent='Two-player game started. Jade and Azure take opposite sides.';render()});document.getElementById('cg-ludo-four').addEventListener('click',function(){playerCount=4;state=newState(4);message.textContent='Four-player game started. Pass the device after each turn.';render()});render();
})();`;

const styles = `<style>
#cg-ludo-board{display:block;width:100%;height:auto;max-height:68vh;touch-action:manipulation}.cg-ludo-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:2px 0 12px}.cg-ludo-eyebrow{font-size:10px;font-weight:900;letter-spacing:.15em;color:#8ea0bf}.cg-ludo-mode{font-size:11px;color:#8795b1;margin-top:3px}.cg-ludo-players{display:flex;gap:4px}.cg-ludo-mode-btn{border:1px solid #2a3858;background:#ffffff08;color:#aab6d0;border-radius:9px;padding:7px 8px;font-size:9px;font-weight:800}.cg-ludo-mode-btn.active{color:#0b1420;background:#d8e4ff;border-color:#d8e4ff}.cg-ludo-board-wrap{overflow:hidden;border-radius:18px;background:#080d19;border:1px solid #2a3858;box-shadow:inset 0 0 28px #0007}.cg-ludo-turn{display:flex;align-items:center;justify-content:space-between;margin:12px 2px 8px}.cg-ludo-turn-copy{display:flex;flex-direction:column;gap:4px;min-width:0}.cg-ludo-turn-copy span:first-child{font-size:12px;font-weight:900;letter-spacing:.08em;color:#36d399}.cg-ludo-turn-copy span:last-child{font-size:11px;color:#9ba8c7}.cg-ludo-die{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(145deg,#fff,#cbd5e8);color:#111a2b;font-size:23px;font-weight:900;box-shadow:0 4px 12px #0005}.cg-ludo-actions{display:flex;gap:8px}.cg-ludo-roll{flex:1;height:44px;border:0;border-radius:13px;background:linear-gradient(100deg,#91f5ce,#55d9b2);color:#071b19;font-size:13px;font-weight:950;letter-spacing:.08em;box-shadow:0 5px 16px #36d39933}.cg-ludo-roll:disabled{opacity:.46}.cg-ludo-reset{width:46px;border:1px solid #2a3858;border-radius:13px;background:#ffffff0b;color:#eef3ff;font-size:22px}.cg-ludo-legend{display:flex;justify-content:center;flex-wrap:wrap;gap:9px 12px;margin:11px 0 2px;color:#9ba8c7;font-size:9px}.cg-ludo-legend span{display:flex;align-items:center;gap:4px}.cg-ludo-dot{width:7px;height:7px;border-radius:50%}.cg-ludo-dot.jade{background:#36d399}.cg-ludo-dot.gold{background:#ffc857}.cg-ludo-dot.azure{background:#62a8ff}.cg-ludo-dot.coral{background:#ff7185}.cg-ludo-safe-key{color:#c3cde2}.cg-ludo-message{margin:10px -2px -2px;padding:9px 10px;border:1px solid #2a3858;border-radius:11px;background:#ffffff08;color:#aebbd4;font-size:11px;text-align:center;line-height:1.4}.cg-ludo-piece.movable{filter:drop-shadow(0 0 5px #fff9);animation:cg-ludo-pulse 1.2s ease-in-out infinite alternate}@keyframes cg-ludo-pulse{from{opacity:.8}to{opacity:1}}@media(max-width:360px){.cg-ludo-mode{font-size:10px}.cg-ludo-mode-btn{padding:6px;font-size:8px}.cg-ludo-head{gap:4px}}
</style>`;

const command = {
    name: 'ludo',
    alias: ['parcheesi', 'ludogame'],
    desc: 'Play classic Ludo locally with 2 or 4 players on one device',
    category: 'Games',
    execute: async (sock, message) => sendHtmlGame(sock, message, 'LUDO', '#36d399', styles + BOARD_BODY, BOARD_SCRIPT),
};

module.exports = Object.assign(command, {
    TRACK_LENGTH,
    FINISH_PROGRESS,
    SAFE_SQUARES,
    createGameState,
    trackPosition,
    getLegalMoves,
    rollDice,
    moveToken,
});
