// File: src/Commands/Games/2048.js

module.exports = {
    name: '2048',
    alias: ['2048game'],
    desc: 'Addictive 2048 sliding number merge tile puzzle game',
    category: 'Games',
    usage: `${prefix}2048`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🧩', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#795548,#2d1e18 60%,#150c08)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #2d1e18;border-radius:22px;background:linear-gradient(105deg,#1b110c,#5d4037 8%,#3e2723 20%,#4e342e 52%,#271711 82%,#6d4c41 94%,#150c08);box-shadow:inset 0 0 0 2px #d7ccc8,inset 0 0 0 6px #2d1e18,inset 0 20px 35px #ffab9122,0 8px 0 #150c08,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #ffab91;border-radius:12px;color:#fff;background:radial-gradient(ellipse at 50% 0,#ff7043,#3e2723 70%);box-shadow:inset 0 0 0 3px #271711,inset 0 -11px 18px #000d,0 4px 0 #150c08;text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #8d6e63;border-radius:8px;background:linear-gradient(#271711,#150c08)}
.stat{flex:1;border-right:1px solid #8d6e63;color:#d7ccc8;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#ffccbc;font-size:14px}
.frame{position:relative;padding:6px;border:4px solid #4e342e;border-radius:14px;background:#bbada0}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:100%;height:190px;padding:6px;background:#bbada0;border-radius:8px}
.cell{display:flex;align-items:center;justify-content:center;border-radius:6px;font-weight:bold;font-size:16px;background:#cdc1b4;color:#776e65;transition:transform .1s}
.dpad{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;width:170px;margin:6px auto 0;touch-action:none}
.dpad button{height:34px;border:2px solid #8d6e63;border-radius:8px;background:#4e342e;color:#ffccbc;font-weight:bold;cursor:pointer;-webkit-tap-highlight-color:transparent}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000eb}.over.on{display:grid}
.over button{padding:0 20px;height:40px;margin-top:10px;background:#ff7043;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer}
</style></head><body>
<div class="machine">
<div class="title">2048 PUZZLE</div>
<div class="stats"><div class="stat">SCORE<b id="sc">0</b></div><div class="stat">BEST<b id="bs">0</b></div></div>
<div class="frame"><div class="grid" id="grid"></div></div>
<div class="dpad">
<div></div><button id="up">▲</button><div></div>
<button id="left">◀</button><button id="down">▼</button><button id="right">▶</button>
</div>
<div class="over" id="over"><div><h2>GAME OVER</h2><div id="fs"></div><button id="rb">RETRY</button></div></div>
</div>
<script>(()=>{
const gridEl=document.getElementById("grid"),scEl=document.getElementById("sc"),bsEl=document.getElementById("bs"),fs=document.getElementById("fs"),over=document.getElementById("over"),rb=document.getElementById("rb");
const colors={0:"#cdc1b4",2:"#eee4da",4:"#ede0c8",8:"#f2b179",16:"#f59563",32:"#f67c5f",64:"#f65e3b",128:"#edcf72",256:"#edcc61",512:"#edc850",1024:"#edc53f",2048:"#edc22e"};
let board=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],score=0,best=0;
try{best=Number(localStorage.getItem("2048_best"))||0}catch(e){}bsEl.textContent=best;
function spawn(){
const empties=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(!board[r][c])empties.push({r,c});
if(!empties.length)return;
const p=empties[Math.floor(Math.random()*empties.length)];
board[p.r][p.c]=Math.random()<0.9?2:4;
}
function reset(){board=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];score=0;scEl.textContent=0;over.classList.remove("on");spawn();spawn();render()}
function render(){
gridEl.innerHTML="";
for(let r=0;r<4;r++)for(let c=0;c<4;c++){
const v=board[r][c],d=document.createElement("div");
d.className="cell";d.textContent=v||"";
d.style.background=colors[v]||"#3c3a32";
d.style.color=v>4?"#f9f6f2":"#776e65";
if(v>=1024)d.style.fontSize="13px";
gridEl.appendChild(d);
}
}
function slide(row){
let arr=row.filter(x=>x),gained=0;
for(let i=0;i<arr.length-1;i++){
if(arr[i]===arr[i+1]){arr[i]*=2;score+=arr[i];gained+=arr[i];arr.splice(i+1,1)}
}
while(arr.length<4)arr.push(0);
return {arr,gained};
}
function move(dir){
let moved=false,prev=JSON.stringify(board);
if(dir==="left"){for(let r=0;r<4;r++)board[r]=slide(board[r]).arr}
else if(dir==="right"){for(let r=0;r<4;r++)board[r]=slide(board[r].reverse()).arr.reverse()}
else if(dir==="up"){
for(let c=0;c<4;c++){
let col=[board[0][c],board[1][c],board[2][c],board[3][c]];
let res=slide(col).arr;for(let r=0;r<4;r++)board[r][c]=res[r];
}
}else if(dir==="down"){
for(let c=0;c<4;c++){
let col=[board[3][c],board[2][c],board[1][c],board[0][c]];
let res=slide(col).arr;for(let r=0;r<4;r++)board[3-r][c]=res[r];
}
}
if(JSON.stringify(board)!==prev){spawn();scEl.textContent=score;render();checkOver()}
}
function checkOver(){
for(let r=0;r<4;r++)for(let c=0;c<4;c++){
if(!board[r][c])return;
if(r<3&&board[r][c]===board[r+1][c])return;
if(c<3&&board[r][c]===board[r][c+1])return;
}
best=Math.max(best,score);bsEl.textContent=best;fs.textContent="Score: "+score;over.classList.add("on");
try{localStorage.setItem("2048_best",best)}catch(e){}
}
document.getElementById("up").onclick=()=>move("up");
document.getElementById("down").onclick=()=>move("down");
document.getElementById("left").onclick=()=>move("left");
document.getElementById("right").onclick=()=>move("right");
rb.onclick=reset;
let tx=0,ty=0;
gridEl.addEventListener("touchstart",e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY},{passive:true});
gridEl.addEventListener("touchend",e=>{
const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
if(Math.abs(dx)>Math.abs(dy)){move(dx>0?"right":"left")}else{move(dy>0?"down":"up")}
},{passive:true});
addEventListener("keydown",e=>{
if(e.code==="ArrowUp")move("up");if(e.code==="ArrowDown")move("down");
if(e.code==="ArrowLeft")move("left");if(e.code==="ArrowRight")move("right");
});
reset();
})()</script></body></html>`
        });
    }
};
