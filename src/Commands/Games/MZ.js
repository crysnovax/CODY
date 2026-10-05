// File: src/Commands/Games/maze.js

module.exports = {
    name: 'maze',
    alias: ['labyrinth'],
    desc: 'Navigate procedural generated labyrinths and find the escape portal',
    category: 'Games',
    usage: `${prefix}maze`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🧭', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#37474f,#21272b 60%,#0a0d0e)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #21272b;border-radius:22px;background:linear-gradient(105deg,#0a0d0e,#37474f 8%,#1b2024 20%,#455a64 52%,#1b2024 82%,#546e7a 94%,#0a0d0e);box-shadow:inset 0 0 0 2px #cfd8dc,inset 0 0 0 6px #21272b,0 8px 0 #0a0d0e,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #cfd8dc;border-radius:12px;color:#eceff1;background:radial-gradient(ellipse at 50% 0,#78909c,#37474f 70%);text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #546e7a;border-radius:8px;background:#0a0d0e}
.stat{flex:1;border-right:1px solid #546e7a;color:#b0bec5;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#fff;font-size:15px}
.frame{position:relative;padding:6px;border:4px solid #455a64;border-radius:14px;background:#111}
.reelbox{height:190px;border:2px solid #333;border-radius:9px;background:#111;overflow:hidden;position:relative}
.reelbox canvas{display:block;width:100%;height:100%;touch-action:none}
.dpad{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;width:170px;margin:6px auto 0;touch-action:none}
.dpad button{height:34px;border:2px solid #cfd8dc;border-radius:8px;background:#455a64;color:#fff;font-weight:bold;font-size:14px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000eb}.over.on{display:grid}
.over button{padding:0 22px;height:40px;margin-top:10px;background:#78909c;color:#000;border:none;border-radius:8px;font-weight:bold}
</style></head><body>
<div class="machine">
<div class="title">MAZE RUNNER</div>
<div class="stats"><div class="stat">LEVEL<b id="lv">1</b></div><div class="stat">MOVES<b id="mv">0</b></div></div>
<div class="frame"><div class="reelbox"><canvas id="gc"></canvas></div></div>
<div class="dpad">
<div></div><button id="up">▲</button><div></div>
<button id="left">◀</button><button id="down">▼</button><button id="right">▶</button>
</div>
<div class="over" id="over"><div><h2>MAZE ESCAPED!</h2><div id="fs" style="margin-bottom:8px"></div><button id="rb">NEXT LEVEL</button></div></div>
</div>
<script>(()=>{
const c=document.getElementById("gc"),x=c.getContext("2d"),box=c.parentElement,lvEl=document.getElementById("lv"),mvEl=document.getElementById("mv"),over=document.getElementById("over"),fs=document.getElementById("fs"),rb=document.getElementById("rb");
let W,H,cols=13,rows=11,cw,ch,grid=[],player={r:1,c:1},goal={r:rows-2,c:cols-2},level=1,moves=0;
function size(){W=box.clientWidth;H=box.clientHeight;c.width=W;c.height=H;cw=W/cols;ch=H/rows}
function generateMaze(){
grid=Array.from({length:rows},()=>Array(cols).fill(1));
function carve(r,c){
grid[r][c]=0;
const dirs=[[-2,0],[2,0],[0,-2],[0,2]].sort(()=>Math.random()-0.5);
for(const [dr,dc] of dirs){
const nr=r+dr,nc=c+dc;
if(nr>0&&nr<rows-1&&nc>0&&nc<cols-1&&grid[nr][nc]===1){
grid[r+dr/2][c+dc/2]=0;
carve(nr,nc);
}
}
}
carve(1,1);
player={r:1,c:1};goal={r:rows-2,c:cols-2};grid[goal.r][goal.c]=0;
}
function reset(){
size();moves=0;mvEl.textContent=0;lvEl.textContent=level;over.classList.remove("on");
generateMaze();draw();
}
function move(dr,dc){
const nr=player.r+dr,nc=player.c+dc;
if(nr>=0&&nr<rows&&nc>=0&&nc<cols&&grid[nr][nc]===0){
player.r=nr;player.c=nc;moves++;mvEl.textContent=moves;draw();
if(player.r===goal.r&&player.c===goal.c){
fs.textContent="Escaped in "+moves+" moves!";level++;over.classList.add("on");
}
}
}
document.getElementById("up").onclick=()=>move(-1,0);
document.getElementById("down").onclick=()=>move(1,0);
document.getElementById("left").onclick=()=>move(0,-1);
document.getElementById("right").onclick=()=>move(0,1);
rb.onclick=reset;
addEventListener("keydown",e=>{
if(e.code==="ArrowUp")move(-1,0);if(e.code==="ArrowDown")move(1,0);
if(e.code==="ArrowLeft")move(0,-1);if(e.code==="ArrowRight")move(0,1);
});
function draw(){
x.fillStyle="#111";x.fillRect(0,0,W,H);
for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){
if(grid[r][k]===1){x.fillStyle="#37474f";x.fillRect(k*cw,r*ch,cw,ch)}
}
x.fillStyle="#00e676";x.beginPath();x.arc((goal.c+0.5)*cw,(goal.r+0.5)*ch,Math.min(cw,ch)*0.4,0,Math.PI*2);x.fill();
x.fillStyle="#00e5ff";x.beginPath();x.arc((player.c+0.5)*cw,(player.r+0.5)*ch,Math.min(cw,ch)*0.36,0,Math.PI*2);x.fill();
}
reset();
})()</script></body></html>`
        });
    }
};
