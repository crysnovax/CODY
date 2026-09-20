// File: src/Commands/Games/breakout.js

module.exports = {
    name: 'breakout',
    alias: ['brick'],
    desc: 'Classic breakout brick breaker arcade game with bouncy ball and colored bricks',
    category: 'Games',
    usage: `${prefix}breakout`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🧱', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#d84315,#4e1505 60%,#1a0500)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #4e1505;border-radius:22px;background:linear-gradient(105deg,#1a0500,#bf360c 8%,#3e1003 20%,#d84315 52%,#3e1003 82%,#e64a19 94%,#1a0500);box-shadow:inset 0 0 0 2px #ffab91,inset 0 0 0 6px #4e1505,0 8px 0 #1a0500,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #ffab91;border-radius:12px;color:#fff;background:radial-gradient(ellipse at 50% 0,#ff7043,#bf360c 70%);text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #e64a19;border-radius:8px;background:#1a0500}
.stat{flex:1;border-right:1px solid #e64a19;color:#ffccbc;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#fff;font-size:15px}
.frame{position:relative;padding:6px;border:4px solid #bf360c;border-radius:14px;background:#111}
.reelbox{height:200px;border:2px solid #333;border-radius:9px;background:#111;overflow:hidden;position:relative}
.reelbox canvas{display:block;width:100%;height:100%;touch-action:none}
.ctrls{display:flex;gap:8px;margin:8px 2px 0}
.ctrls button{flex:1;height:42px;border:2px solid #ff7043;border-radius:10px;background:#bf360c;color:#fff;font-weight:bold;font-size:16px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000f0}.over.on{display:grid}
.over button{padding:0 22px;height:40px;margin-top:10px;background:#ff7043;color:#fff;border:none;border-radius:8px;font-weight:bold}
</style></head><body>
<div class="machine">
<div class="title">BRICK BREAKER</div>
<div class="stats"><div class="stat">SCORE<b id="sc">0</b></div><div class="stat">LIVES<b id="lv">3</b></div><div class="stat">BRICKS<b id="bk">0</b></div></div>
<div class="frame"><div class="reelbox"><canvas id="gc"></canvas></div></div>
<div class="ctrls"><button id="btnL">◀ LEFT</button><button id="btnR">RIGHT ▶</button></div>
<div class="over" id="over"><div><h2 id="res">GAME OVER</h2><button id="rb">PLAY AGAIN</button></div></div>
</div>
<script>(()=>{
const c=document.getElementById("gc"),x=c.getContext("2d"),box=c.parentElement,scEl=document.getElementById("sc"),lvEl=document.getElementById("lv"),bkEl=document.getElementById("bk"),over=document.getElementById("over"),res=document.getElementById("res"),rb=document.getElementById("rb");
let W,H,pw=52,ph=8,px,ball,bricks=[],score=0,lives=3,alive=false;
const colors=['#f44336','#ff9800','#ffeb3b','#4caf50','#2196f3'];
function size(){W=box.clientWidth;H=box.clientHeight;c.width=W;c.height=H}
function reset(){
size();px=W/2-pw/2;score=0;lives=3;alive=true;scEl.textContent=0;lvEl.textContent=3;over.classList.remove("on");
ball={x:W/2,y:H-30,vx:2.5,vy:-3,r:5};
bricks=[];const rows=4,cols=7,bw=(W-16)/cols,bh=12;
for(let r=0;r<rows;r++)for(let k=0;k<cols;k++){
bricks.push({x:8+k*bw,y:14+r*(bh+4),w:bw-3,h:bh,c:colors[r%colors.length],alive:true});
}
bkEl.textContent=bricks.length;
}
let moveL=false,moveR=false;
function bindBtn(btn,down,up){
btn.addEventListener("pointerdown",e=>{e.preventDefault();down()});
btn.addEventListener("pointerup",e=>{e.preventDefault();up()});
btn.addEventListener("pointercancel",e=>{e.preventDefault();up()});
}
bindBtn(document.getElementById("btnL"),()=>moveL=true,()=>moveL=false);
bindBtn(document.getElementById("btnR"),()=>moveR=true,()=>moveR=false);
c.addEventListener("touchmove",e=>{
const rect=c.getBoundingClientRect(),tx=e.touches[0].clientX-rect.left;
px=Math.max(0,Math.min(W-pw,tx-pw/2));
},{passive:true});
rb.onclick=reset;
function update(){
if(!alive)return;
if(moveL)px-=5;if(moveR)px+=5;
px=Math.max(0,Math.min(W-pw,px));
ball.x+=ball.vx;ball.y+=ball.vy;
if(ball.x-ball.r<0||ball.x+ball.r>W)ball.vx*=-1;
if(ball.y-ball.r<0)ball.vy*=-1;
if(ball.y+ball.r>H-14&&ball.x>=px&&ball.x<=px+pw&&ball.vy>0){
ball.vy*=-1;ball.vx=(ball.x-(px+pw/2))*0.14;
}
let rem=0;
for(const b of bricks){
if(!b.alive)continue;
rem++;
if(ball.x>b.x&&ball.x<b.x+b.w&&ball.y>b.y&&ball.y<b.y+b.h){
b.alive=false;ball.vy*=-1;score+=20;scEl.textContent=score;
}
}
bkEl.textContent=rem;
if(rem===0){alive=false;res.textContent="YOU CLEARED ALL!";over.classList.add("on")}
if(ball.y>H){
lives--;lvEl.textContent=lives;
if(lives<=0){alive=false;res.textContent="GAME OVER";over.classList.add("on")}
else{ball={x:W/2,y:H-30,vx:2.5,vy:-3,r:5};px=W/2-pw/2}
}
}
function draw(){
x.fillStyle="#111";x.fillRect(0,0,W,H);
for(const b of bricks){
if(!b.alive)continue;
x.fillStyle=b.c;x.beginPath();x.roundRect(b.x,b.y,b.w,b.h,2);x.fill();
}
x.fillStyle="#00e5ff";x.beginPath();x.roundRect(px,H-14,pw,ph,3);x.fill();
x.fillStyle="#fff";x.beginPath();x.arc(ball.x,ball.y,ball.r,0,Math.PI*2);x.fill();
}
function loop(){update();draw();requestAnimationFrame(loop)}
size();reset();loop();
})()</script></body></html>`
        });
    }
};
