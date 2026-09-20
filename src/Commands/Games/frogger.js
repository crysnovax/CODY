// File: src/Commands/Games/frogger.js

module.exports = {
    name: 'frogger',
    alias: ['frog'],
    desc: 'Help the frog cross busy highways and rapid rivers safely to reach home',
    category: 'Games',
    usage: `${prefix}frogger`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🐸', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#1b5e20,#052207 60%,#000)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #052207;border-radius:22px;background:linear-gradient(105deg,#000,#1b5e20 8%,#0a310c 20%,#2e7d32 52%,#0a310c 82%,#388e3c 94%,#000);box-shadow:inset 0 0 0 2px #a5d6a7,inset 0 0 0 6px #052207,0 8px 0 #000,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #a5d6a7;border-radius:12px;color:#e8f5e9;background:radial-gradient(ellipse at 50% 0,#4caf50,#1b5e20 70%);text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #388e3c;border-radius:8px;background:#000}
.stat{flex:1;border-right:1px solid #388e3c;color:#a5d6a7;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#fff;font-size:15px}
.frame{position:relative;padding:6px;border:4px solid #2e7d32;border-radius:14px;background:#111}
.reelbox{height:190px;border:2px solid #222;border-radius:9px;background:#111;overflow:hidden;position:relative}
.reelbox canvas{display:block;width:100%;height:100%;touch-action:none}
.dpad{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;width:170px;margin:6px auto 0;touch-action:none}
.dpad button{height:34px;border:2px solid #a5d6a7;border-radius:8px;background:#2e7d32;color:#fff;font-weight:bold;font-size:14px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000f0}.over.on{display:grid}
.over button{padding:0 22px;height:40px;margin-top:10px;background:#4caf50;color:#000;border:none;border-radius:8px;font-weight:bold}
</style></head><body>
<div class="machine">
<div class="title">FROGGER HIGHWAY</div>
<div class="stats"><div class="stat">SCORE<b id="sc">0</b></div><div class="stat">LIVES<b id="lv">3</b></div></div>
<div class="frame"><div class="reelbox"><canvas id="gc"></canvas></div></div>
<div class="dpad">
<div></div><button id="up">▲</button><div></div>
<button id="left">◀</button><button id="down">▼</button><button id="right">▶</button>
</div>
<div class="over" id="over"><div><h2>GAME OVER</h2><div id="fs" style="margin-bottom:8px"></div><button id="rb">PLAY AGAIN</button></div></div>
</div>
<script>(()=>{
const c=document.getElementById("gc"),x=c.getContext("2d"),box=c.parentElement,scEl=document.getElementById("sc"),lvEl=document.getElementById("lv"),over=document.getElementById("over"),fs=document.getElementById("fs"),rb=document.getElementById("rb");
const rows=8,cols=10;let W,H,gridW,gridH,frog,cars=[],logs=[],score=0,lives=3,alive=false;
function size(){W=box.clientWidth;H=box.clientHeight;c.width=W;c.height=H;gridW=W/cols;gridH=H/rows}
function resetFrog(){frog={x:Math.floor(cols/2),y:rows-1}}
function reset(){
size();score=0;lives=3;alive=true;scEl.textContent=0;lvEl.textContent=3;over.classList.remove("on");
resetFrog();
cars=[
{y:rows-2,w:36,speed:2,color:'#ff5252',items:[{x:20},{x:120}]},
{y:rows-3,w:44,speed:-2.5,color:'#ffeb3b',items:[{x:80},{x:200}]},
{y:rows-4,w:32,speed:3,color:'#00e5ff',items:[{x:40},{x:160}]}
];
logs=[
{y:rows-6,w:55,speed:1.6,items:[{x:10},{x:110},{x:210}]},
{y:rows-7,w:65,speed:-1.8,items:[{x:40},{x:160}]}
];
}
function hop(dx,dy){
if(!alive)return;
frog.x=Math.max(0,Math.min(cols-1,frog.x+dx));
frog.y=Math.max(0,Math.min(rows-1,frog.y+dy));
if(dy<0)score+=10;scEl.textContent=score;
if(frog.y===0){score+=100;scEl.textContent=score;resetFrog()}
}
document.getElementById("up").onclick=()=>hop(0,-1);
document.getElementById("down").onclick=()=>hop(0,1);
document.getElementById("left").onclick=()=>hop(-1,0);
document.getElementById("right").onclick=()=>hop(1,0);
rb.onclick=reset;
addEventListener("keydown",e=>{
if(e.code==="ArrowUp")hop(0,-1);if(e.code==="ArrowDown")hop(0,1);
if(e.code==="ArrowLeft")hop(-1,0);if(e.code==="ArrowRight")hop(1,0);
});
function update(){
if(!alive)return;
const fx=frog.x*gridW+gridW/2,fy=frog.y*gridH+gridH/2;
for(const row of cars){
for(const item of row.items){
item.x+=row.speed;if(item.x>W+50)item.x=-50;if(item.x<-50)item.x=W+50;
if(frog.y===row.y&&Math.abs(fx-item.x)<row.w/2+gridW/3){hit()}
}
}
if(frog.y===rows-6||frog.y===rows-7){
let onLog=false;
for(const row of logs){
if(frog.y===row.y){
for(const item of row.items){
item.x+=row.speed;if(item.x>W+70)item.x=-70;if(item.x<-70)item.x=W+70;
if(Math.abs(fx-item.x)<row.w/2+gridW/4){onLog=true;frog.x+=(row.speed/gridW)}
}
}
}
if(!onLog){hit()}
}else{
for(const row of logs)for(const item of row.items){
item.x+=row.speed;if(item.x>W+70)item.x=-70;if(item.x<-70)item.x=W+70;
}
}
if(frog.x<0||frog.x>=cols)hit();
}
function hit(){
lives--;lvEl.textContent=lives;resetFrog();
if(lives<=0){alive=false;fs.textContent="Score: "+score;over.classList.add("on")}
}
function draw(){
x.fillStyle="#333";x.fillRect(0,0,W,H);
x.fillStyle="#1b5e20";x.fillRect(0,0,W,gridH);x.fillRect(0,(rows-5)*gridH,W,gridH);x.fillRect(0,(rows-1)*gridH,W,gridH);
x.fillStyle="#0277bd";x.fillRect(0,gridH,W,2*gridH);
for(const row of logs){
x.fillStyle="#8d6e63";
for(const item of row.items){
x.beginPath();x.roundRect(item.x-row.w/2,row.y*gridH+3,row.w,gridH-6,4);x.fill();
}
}
for(const row of cars){
x.fillStyle=row.color;
for(const item of row.items){
x.beginPath();x.roundRect(item.x-row.w/2,row.y*gridH+4,row.w,gridH-8,4);x.fill();
}
}
x.fillStyle="#76ff03";
x.beginPath();x.arc(frog.x*gridW+gridW/2,frog.y*gridH+gridH/2,gridW*0.38,0,Math.PI*2);x.fill();
x.fillStyle="#000";
x.beginPath();x.arc(frog.x*gridW+gridW/2-3,frog.y*gridH+gridH/2-3,2,0,Math.PI*2);x.arc(frog.x*gridW+gridW/2+3,frog.y*gridH+gridH/2-3,2,0,Math.PI*2);x.fill();
}
function loop(){update();draw();requestAnimationFrame(loop)}
size();reset();loop();
})()</script></body></html>`
        });
    }
};
