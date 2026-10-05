// File: src/Commands/Games/pong.js

module.exports = {
    name: 'tbt',
    alias: ['tabletennis'],
    desc: 'Classic table tennis Pong arcade game vs AI opponent',
    category: 'Games',
    usage: `${prefix}pong`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🏓', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#263238,#10171a 60%,#05080a)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #10171a;border-radius:22px;background:linear-gradient(105deg,#05080a,#263238 8%,#10171a 20%,#37474f 52%,#10171a 82%,#455a64 94%,#05080a);box-shadow:inset 0 0 0 2px #78909c,inset 0 0 0 6px #10171a,0 8px 0 #05080a,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #78909c;border-radius:12px;color:#eceff1;background:radial-gradient(ellipse at 50% 0,#546e7a,#263238 70%);text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #546e7a;border-radius:8px;background:#05080a}
.stat{flex:1;border-right:1px solid #546e7a;color:#b0bec5;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#fff;font-size:16px}
.frame{position:relative;padding:6px;border:4px solid #37474f;border-radius:14px;background:#000}
.reelbox{height:200px;border:2px solid #37474f;border-radius:9px;background:#000;overflow:hidden;position:relative}
.reelbox canvas{display:block;width:100%;height:100%;touch-action:none}
.ctrls{display:flex;gap:8px;margin:8px 2px 0}
.ctrls button{flex:1;height:42px;border:2px solid #78909c;border-radius:10px;background:#37474f;color:#fff;font-weight:bold;font-size:16px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000f0}.over.on{display:grid}
.over button{padding:0 22px;height:40px;margin-top:10px;background:#78909c;color:#000;border:none;border-radius:8px;font-weight:bold}
</style></head><body>
<div class="machine">
<div class="title">RETRO PONG</div>
<div class="stats"><div class="stat">YOU<b id="p1">0</b></div><div class="stat">AI<b id="p2">0</b></div></div>
<div class="frame"><div class="reelbox"><canvas id="gc"></canvas></div></div>
<div class="ctrls"><button id="btnL">◀ LEFT</button><button id="btnR">RIGHT ▶</button></div>
<div class="over" id="over"><div><h2 id="res">GAME OVER</h2><button id="rb">PLAY AGAIN</button></div></div>
</div>
<script>(()=>{
const c=document.getElementById("gc"),x=c.getContext("2d"),box=c.parentElement,p1El=document.getElementById("p1"),p2El=document.getElementById("p2"),over=document.getElementById("over"),res=document.getElementById("res"),rb=document.getElementById("rb");
let W,H,pw=50,ph=8,playerX,aiX,ball,s1=0,s2=0,alive=true;
function size(){W=box.clientWidth;H=box.clientHeight;c.width=W;c.height=H}
function resetBall(dir){ball={x:W/2,y:H/2,vx:(Math.random()-0.5)*4,vy:dir*3.5,r:5}}
function reset(){size();playerX=W/2-pw/2;aiX=W/2-pw/2;s1=0;s2=0;p1El.textContent=0;p2El.textContent=0;alive=true;over.classList.remove("on");resetBall(1)}
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
playerX=Math.max(0,Math.min(W-pw,tx-pw/2));
},{passive:true});
rb.onclick=reset;
function update(){
if(!alive)return;
if(moveL)playerX-=5;if(moveR)playerX+=5;
playerX=Math.max(0,Math.min(W-pw,playerX));
const aiTarget=ball.x-pw/2;
aiX+=(aiTarget-aiX)*0.085;
aiX=Math.max(0,Math.min(W-pw,aiX));
ball.x+=ball.vx;ball.y+=ball.vy;
if(ball.x-ball.r<0||ball.x+ball.r>W){ball.vx*=-1}
if(ball.y+ball.r>H-14&&ball.x>=playerX&&ball.x<=playerX+pw&&ball.vy>0){
ball.vy*=-1.05;ball.vx=(ball.x-(playerX+pw/2))*0.16;
}
if(ball.y-ball.r<14&&ball.x>=aiX&&ball.x<=aiX+pw&&ball.vy<0){
ball.vy*=-1.05;ball.vx=(ball.x-(aiX+pw/2))*0.16;
}
if(ball.y>H){s2++;p2El.textContent=s2;if(s2>=5){endGame("AI WON!")}else{resetBall(-1)}}
if(ball.y<0){s1++;p1El.textContent=s1;if(s1>=5){endGame("YOU WON!")}else{resetBall(1)}}
}
function endGame(txt){alive=false;res.textContent=txt;over.classList.add("on")}
function draw(){
x.fillStyle="#000";x.fillRect(0,0,W,H);
x.strokeStyle="#333";x.setLineDash([4,4]);
x.beginPath();x.moveTo(0,H/2);x.lineTo(W,H/2);x.stroke();x.setLineDash([]);
x.fillStyle="#00e5ff";x.fillRect(playerX,H-14,pw,ph);
x.fillStyle="#ff4081";x.fillRect(aiX,6,pw,ph);
x.fillStyle="#fff";x.beginPath();x.arc(ball.x,ball.y,ball.r,0,Math.PI*2);x.fill();
}
function loop(){update();draw();requestAnimationFrame(loop)}
size();reset();loop();
})()</script></body></html>`
        });
    }
};
