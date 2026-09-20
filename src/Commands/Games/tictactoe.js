// File: src/Commands/Games/tictactoe.js

module.exports = {
    name: 'tictactoe',
    alias: ['ttt', 'xo'],
    desc: 'Classic Tic-Tac-Toe with Single Player vs AI and 2-Player modes',
    category: 'Games',
    usage: `${prefix}tictactoe`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#1a237e,#0d1137 60%,#050716)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #0d1137;border-radius:22px;background:linear-gradient(105deg,#050716,#1a237e 8%,#0f1338 20%,#283593 52%,#0f1338 82%,#3949ab 94%,#050716);box-shadow:inset 0 0 0 2px #5c6bc0,inset 0 0 0 6px #0d1137,inset 0 20px 35px #7986cb22,0 8px 0 #050716,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #7986cb;border-radius:12px;color:#e8eaf6;background:radial-gradient(ellipse at 50% 0,#5c6bc0,#1a237e 70%);box-shadow:inset 0 0 0 3px #0f1338,inset 0 -11px 18px #000d;text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.modes{display:flex;gap:6px;margin:8px 2px}
.modes button{flex:1;height:34px;border:2px solid #5c6bc0;border-radius:8px;background:#283593;color:#fff;font-weight:bold;cursor:pointer}
.modes button.active{background:#ff4081;border-color:#ff80ab}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:190px;height:190px;margin:10px auto;background:#0d1137;padding:6px;border-radius:12px;border:2px solid #5c6bc0}
.cell{display:flex;align-items:center;justify-content:center;background:#1a237e;border-radius:8px;font-size:36px;font-weight:bold;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cell.X{color:#ff4081}.cell.O{color:#00e5ff}
.status{height:30px;display:flex;align-items:center;justify-content:center;color:#e8eaf6;font-weight:bold;font-size:14px;background:#0d1137;border-radius:8px;margin:6px 2px}
.reset-btn{width:100%;height:38px;border:2px solid #7986cb;border-radius:10px;background:#3949ab;color:#fff;font-weight:bold;cursor:pointer}
</style></head><body>
<div class="machine">
<div class="title">TIC TAC TOE</div>
<div class="modes"><button id="vsAi" class="active">VS AI</button><button id="vsP2">2 PLAYERS</button></div>
<div class="grid" id="grid"></div>
<div class="status" id="st">PLAYER X TURN</div>
<button id="rb" class="reset-btn">NEW GAME</button>
</div>
<script>(()=>{
const gridEl=document.getElementById("grid"),st=document.getElementById("st"),rb=document.getElementById("rb"),btnAi=document.getElementById("vsAi"),btnP2=document.getElementById("vsP2");
let board=["","","","","","","","",""],turn="X",vsAi=true,gameOver=false;
const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function reset(){
board=["","","","","","","","",""];turn="X";gameOver=false;st.textContent="PLAYER X TURN";render();
}
function render(){
gridEl.innerHTML="";
board.forEach((v,i)=>{
const d=document.createElement("div");
d.className="cell "+v;d.textContent=v;
d.onclick=()=>makeMove(i);
gridEl.appendChild(d);
});
}
function checkWin(b){
for(const [a,c,d] of wins){if(b[a]&&b[a]===b[c]&&b[a]===b[d])return b[a]}
if(b.every(x=>x))return "draw";
return null;
}
function makeMove(i){
if(board[i]||gameOver)return;
board[i]=turn;render();
const w=checkWin(board);
if(w){
gameOver=true;
st.textContent=w==="draw"?"IT'S A DRAW!":"PLAYER "+w+" WINS!";
return;
}
turn=turn==="X"?"O":"X";
st.textContent="PLAYER "+turn+" TURN";
if(vsAi&&turn==="O"&&!gameOver){setTimeout(aiMove,300)}
}
function aiMove(){
let empties=[];board.forEach((v,i)=>{if(!v)empties.push(i)});
if(!empties.length)return;
for(let idx of empties){
let test=[...board];test[idx]="O";
if(checkWin(test)==="O"){makeMove(idx);return}
}
for(let idx of empties){
let test=[...board];test[idx]="X";
if(checkWin(test)==="X"){makeMove(idx);return}
}
if(board[4]==="")makeMove(4);
else makeMove(empties[Math.floor(Math.random()*empties.length)]);
}
btnAi.onclick=()=>{vsAi=true;btnAi.classList.add("active");btnP2.classList.remove("active");reset()};
btnP2.onclick=()=>{vsAi=false;btnP2.classList.add("active");btnAi.classList.remove("active");reset()};
rb.onclick=reset;
reset();
})()</script></body></html>`
        });
    }
};
