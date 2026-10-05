// File: src/Commands/Games/spaceinvaders.js

module.exports = {
    name: 'spaceinvaders',
    alias: ['invaders'],
    desc: 'Retro arcade Space Invaders alien defense shooter with lasers and enemy waves',
    category: 'Games',
    usage: `${prefix}spaceinvaders`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '👾', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#1a0033,#090014 60%,#000)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #1a0033;border-radius:22px;background:linear-gradient(105deg,#000,#2a0845 8%,#100020 20%,#3b096c 52%,#100020 82%,#6411ad 94%,#000);box-shadow:inset 0 0 0 2px #b5179e,inset 0 0 0 6px #100020,0 8px 0 #000,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #b5179e;border-radius:12px;color:#fff;background:radial-gradient(ellipse at 50% 0,#7209b7,#2a0845 70%);text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #7209b7;border-radius:8px;background:#000}
.stat{flex:1;border-right:1px solid #7209b7;color:#e0aaff;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#4cc9f0;font-size:15px}
.frame{position:relative;padding:6px;border:4px solid #3b096c;border-radius:14px;background:#000}
.reelbox{height:200px;border:2px solid #222;border-radius:9px;background:#05000a;overflow:hidden;position:relative}
.reelbox canvas{display:block;width:100%;height:100%;touch-action:none}
.ctrls{display:grid;grid-template-columns:1fr 1.3fr 1fr;gap:6px;margin:8px 2px 0}
.ctrls button{height:42px;border:2px solid #b5179e;border-radius:10px;background:#3b096c;color:#fff;font-weight:bold;font-size:15px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ctrls .btn-fire{background:#f72585;border-color:#ff70a6}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000f0}.over.on{display:grid}
.over button{padding:0 22px;height:40px;margin-top:10px;background:#4cc9f0;color:#000;border:none;border-radius:8px;font-weight:bold}
</style></head><body>
<div class="machine">
<div class="title">SPACE INVADERS</div>
<div class="stats"><div class="stat">SCORE<b id="sc">0</b></div><div class="stat">LIVES<b id="lv">3</b></div><div class="stat">WAVE<b id="wv">1</b></div></div>
<div class="frame"><div class="reelbox"><canvas id="gc"></canvas></div></div>
<div class="ctrls"><button id="btnL">◀ LEFT</button><button id="btnF" class="btn-fire">🔥 FIRE</button><button id="btnR">RIGHT ▶</button></div>
<div class="over" id="over"><div><h2 id="res">GAME OVER</h2><button id="rb">PLAY AGAIN</button></div></div>
</div>
<script>(()=>{
const c=document.getElementById("gc"),x=c.getContext("2d"),box=c.parentElement,scEl=document.getElementById("sc"),lvEl=document.getElementById("lv"),wvEl=document.getElementById("wv"),over=document.getElementById("over"),res=document.getElementById("res"),rb=document.getElementById("rb");
let W,H,player,bullets=[],aliens=[],alienBullets=[],score=0,lives=3,wave=1,alive=false,alienDir=1,alienSpeed=0.8;
function size(){W=box.clientWidth;H=box.clientHeight;c.width=W;c.height=H}
function spawnAliens(){
aliens=[];const rows=3,cols=6,spacingX=W/(cols+1);
for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){
aliens.push({x:spacingX*(k+1),y:20+r*24,r:8,alive:true,type:r});
}
}
function reset(){
size();player={x:W/2,y:H-20,w:24,h:14};bullets=[];alienBullets=[];score=0;lives=3;wave=1;alive=true;
scEl.textContent=0;lvEl.textContent=3;wvEl.textContent=1;over.classList.remove("on");
spawnAliens();
}
let moveL=false,moveR=false;
function bindBtn(btn,down,up){
btn.addEventListener("pointerdown",e=>{e.preventDefault();down()});
btn.addEventListener("pointerup",e=>{e.preventDefault();up()});
btn.addEventListener("pointercancel",e=>{e.preventDefault();up()});
}
bindBtn(document.getElementById("btnL"),()=>moveL=true,()=>moveL=false);
bindBtn(document.getElementById("btnR"),()=>moveR=true,()=>moveR=false);
document.getElementById("btnF").onclick=fire;
function fire(){if(alive&&bullets.length<4)bullets.push({x:player.x,y:player.y-8,vy:-5})}
rb.onclick=reset;
addEventListener("keydown",e=>{
if(e.code==="ArrowLeft"||e.code==="KeyA")moveL=true;
if(e.code==="ArrowRight"||e.code==="KeyD")moveR=true;
if(e.code==="Space"||e.code==="ArrowUp")fire();
});
addEventListener("keyup",e=>{
if(e.code==="ArrowLeft"||e.code==="KeyA")moveL=false;
if(e.code==="ArrowRight"||e.code==="KeyD")moveR=false;
});
function update(){
if(!alive)return;
if(moveL)player.x-=4;if(moveR)player.x+=4;
player.x=Math.max(14,Math.min(W-14,player.x));
for(let i=bullets.length-1;i>=0;i--){
bullets[i].y+=bullets[i].vy;
if(bullets[i].y<0)bullets.splice(i,1);
}
let edge=false;
for(const a of aliens){
if(!a.alive)continue;
a.x+=alienDir*alienSpeed;
if(a.x<12||a.x>W-12)edge=true;
}
if(edge){alienDir*=-1;for(const a of aliens){if(a.alive)a.y+=10}}
for(const b of bullets){
for(const a of aliens){
if(!a.alive)continue;
if(Math.hypot(b.x-a.x,b.y-a.y)<a.r+3){
a.alive=false;b.y=-100;score+=25;scEl.textContent=score;
}
}
}
if(Math.random()<0.035){
const liveAliens=aliens.filter(a=>a.alive);
if(liveAliens.length){
const shooter=liveAliens[Math.floor(Math.random()*liveAliens.length)];
alienBullets.push({x:shooter.x,y:shooter.y+10,vy:2.5});
}
}
for(let i=alienBullets.length-1;i>=0;i--){
const ab=alienBullets[i];ab.y+=ab.vy;
if(Math.abs(ab.x-player.x)<player.w/2&&Math.abs(ab.y-player.y)<player.h/2){
alienBullets.splice(i,1);lives--;lvEl.textContent=lives;
if(lives<=0){alive=false;res.textContent="GAME OVER";over.classList.add("on")}
}else if(ab.y>H)alienBullets.splice(i,1);
}
if(!aliens.some(a=>a.alive)){
wave++;wvEl.textContent=wave;alienSpeed+=0.3;spawnAliens();
}
for(const a of aliens){
if(a.alive&&a.y>player.y-10){alive=false;res.textContent="INVASION FAILED";over.classList.add("on")}
}
}
function draw(){
x.fillStyle="#05000a";x.fillRect(0,0,W,H);
x.fillStyle="#4cc9f0";
x.beginPath();x.moveTo(player.x,player.y-player.h/2);x.lineTo(player.x-player.w/2,player.y+player.h/2);x.lineTo(player.x+player.w/2,player.y+player.h/2);x.fill();
x.fillStyle="#f72585";
for(const b of bullets){x.fillRect(b.x-1.5,b.y-4,3,8)}
x.fillStyle="#ffd166";
for(const ab of alienBullets){x.fillRect(ab.x-1.5,ab.y-4,3,8)}
for(const a of aliens){
if(!a.alive)continue;
x.fillStyle=a.type===0?"#ff4d6d":a.type===1?"#06d6a0":"#ffd166";
x.beginPath();x.arc(a.x,a.y,a.r,0,Math.PI*2);x.fill();
x.fillStyle="#000";x.beginPath();x.arc(a.x-3,a.y-2,2,0,Math.PI*2);x.arc(a.x+3,a.y-2,2,0,Math.PI*2);x.fill();
}
}
function loop(){update();draw();requestAnimationFrame(loop)}
size();reset();loop();
})()</script></body></html>`
        });
    }
};
