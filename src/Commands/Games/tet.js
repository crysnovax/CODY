// File: src/Commands/Games/tetris.js

module.exports = {
    name: 'tetris',
    alias: ['blocks'],
    desc: 'Classic falling tetromino block puzzle with rotation, line clears, and score',
    category: 'Games',
    usage: `${prefix}tetris`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🟦', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#311b92,#1a0066 60%,#080020)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #1a0066;border-radius:22px;background:linear-gradient(105deg,#080020,#311b92 8%,#120046 20%,#4527a0 52%,#120046 82%,#512da8 94%,#080020);box-shadow:inset 0 0 0 2px #b388ff,inset 0 0 0 6px #1a0066,0 8px 0 #080020,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #b388ff;border-radius:12px;color:#ede7f6;background:radial-gradient(ellipse at 50% 0,#7c4dff,#311b92 70%);text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #512da8;border-radius:8px;background:#080020}
.stat{flex:1;border-right:1px solid #512da8;color:#b388ff;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#fff;font-size:15px}
.frame{position:relative;padding:4px;border:4px solid #4527a0;border-radius:12px;background:#000;display:flex;justify-content:center}
.reelbox{height:190px;width:120px;border:2px solid #333;border-radius:6px;background:#111;overflow:hidden;position:relative}
.reelbox canvas{display:block;width:100%;height:100%;touch-action:none}
.ctrls{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:8px 2px 0}
.ctrls button{height:40px;border:2px solid #b388ff;border-radius:8px;background:#4527a0;color:#fff;font-weight:bold;font-size:15px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000f0}.over.on{display:grid}
.over button{padding:0 22px;height:40px;margin-top:10px;background:#b388ff;color:#000;border:none;border-radius:8px;font-weight:bold}
</style></head><body>
<div class="machine">
<div class="title">TETRIS BLOCKS</div>
<div class="stats"><div class="stat">SCORE<b id="sc">0</b></div><div class="stat">LINES<b id="ln">0</b></div></div>
<div class="frame"><div class="reelbox"><canvas id="gc"></canvas></div></div>
<div class="ctrls">
<button id="bL">◀</button><button id="bR">▶</button><button id="bRot">🔄</button><button id="bD">▼</button>
</div>
<div class="over" id="over"><div><h2>GAME OVER</h2><div id="fs" style="margin-bottom:8px"></div><button id="rb">PLAY AGAIN</button></div></div>
</div>
<script>(()=>{
const c=document.getElementById("gc"),x=c.getContext("2d"),box=c.parentElement,scEl=document.getElementById("sc"),lnEl=document.getElementById("ln"),over=document.getElementById("over"),fs=document.getElementById("fs"),rb=document.getElementById("rb");
const cols=10,rows=18,colors=['#00e5ff','#ffeb3b','#d500f9','#00e676','#ff1744','#2979ff','#ff9100'];
const shapes=[
[[1,1,1,1]],
[[1,1],[1,1]],
[[0,1,0],[1,1,1]],
[[0,1,1],[1,1,0]],
[[1,1,0],[0,1,1]],
[[1,0,0],[1,1,1]],
[[0,0,1],[1,1,1]]
];
let W,H,bw,bh,grid=[],piece,px,py,colorIdx,score=0,lines=0,alive=false,lastDrop=0;
function size(){W=box.clientWidth;H=box.clientHeight;c.width=W;c.height=H;bw=W/cols;bh=H/rows}
function newPiece(){
const idx=Math.floor(Math.random()*shapes.length);
piece=shapes[idx];colorIdx=idx+1;px=Math.floor((cols-piece[0].length)/2);py=0;
if(collide(piece,px,py)){alive=false;fs.textContent="Score: "+score;over.classList.add("on")}
}
function reset(){
size();grid=Array.from({length:rows},()=>Array(cols).fill(0));score=0;lines=0;alive=true;
scEl.textContent=0;lnEl.textContent=0;over.classList.remove("on");newPiece();
}
function collide(p,ox,oy){
for(let r=0;r<p.length;r++)for(let k=0;k<p[r].length;k++){
if(p[r][k]){
const nx=ox+k,ny=oy+r;
if(nx<0||nx>=cols||ny>=rows||(ny>=0&&grid[ny][nx]))return true;
}
}
return false;
}
function rotate(p){return p[0].map((_,i)=>p.map(r=>r[i]).reverse())}
function merge(){
for(let r=0;r<piece.length;r++)for(let k=0;k<piece[r].length;k++){
if(piece[r][k]&&py+r>=0)grid[py+r][px+k]=colorIdx;
}
let cleared=0;
for(let r=rows-1;r>=0;r--){
if(grid[r].every(v=>v!==0)){grid.splice(r,1);grid.unshift(Array(cols).fill(0));cleared++;r++}
}
if(cleared){lines+=cleared;score+=cleared*100*cleared;scEl.textContent=score;lnEl.textContent=lines}
newPiece();
}
function move(dx,dy){
if(!collide(piece,px+dx,py+dy)){px+=dx;py+=dy;return true}
if(dy>0){merge()}
return false;
}
function tryRotate(){const rotated=rotate(piece);if(!collide(rotated,px,py))piece=rotated}
document.getElementById("bL").onclick=()=>move(-1,0);
document.getElementById("bR").onclick=()=>move(1,0);
document.getElementById("bD").onclick=()=>move(0,1);
document.getElementById("bRot").onclick=tryRotate;
rb.onclick=reset;
addEventListener("keydown",e=>{
if(e.code==="ArrowLeft")move(-1,0);if(e.code==="ArrowRight")move(1,0);
if(e.code==="ArrowDown")move(0,1);if(e.code==="ArrowUp"||e.code==="KeyW")tryRotate();
});
function draw(){
x.fillStyle="#111";x.fillRect(0,0,W,H);
for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){
if(grid[r][k]){
x.fillStyle=colors[grid[r][k]-1];x.beginPath();x.roundRect(k*bw+1,r*bh+1,bw-2,bh-2,2);x.fill();
}
}
if(piece){
x.fillStyle=colors[colorIdx-1];
for(let r=0;r<piece.length;r++)for(let k=0;k<piece[r].length;k++){
if(piece[r][k]){x.beginPath();x.roundRect((px+k)*bw+1,(py+r)*bh+1,bw-2,bh-2,2);x.fill()}
}
}
}
function loop(t){if(alive&&t-lastDrop>500){lastDrop=t;move(0,1)}draw();requestAnimationFrame(loop)}
size();reset();requestAnimationFrame(loop);
})()</script></body></html>`
        });
    }
};
