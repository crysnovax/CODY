// File: src/Commands/Games/turbohighway.js

module.exports = {
    name: 'turbohighway',
    alias: ['th', 'turbo'],
    desc: 'Dodge traffic and rack up score in an endless highway racer',
    category: 'Games',
    usage: `${prefix}turbohighway`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🏎️', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#4a154b,#110419 60%,#05000a)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #360d3d;border-radius:22px;background:linear-gradient(105deg,#15021f,#501366 8%,#230530 20%,#460e59 52%,#1b0324 82%,#6a1c87 94%,#0f0117);box-shadow:inset 0 0 0 2px #ff4081,inset 0 0 0 6px #240530,inset 0 20px 35px #00e5ff22,0 8px 0 #15021f,0 14px 24px #000c;touch-action:none}
.machine:before{content:"";position:absolute;inset:6px;border:2px solid #ff4081;border-radius:18px;pointer-events:none;box-shadow:inset 0 0 11px #00e5ff}
.lights{height:8px;margin:0 12px 6px;border:2px solid #360d3d;border-radius:8px;background:repeating-radial-gradient(circle at 6px 50%,#fff 0 2px,#00e5ff 3px 5px,#ff4081 6px 12px);box-shadow:0 0 12px #ff4081;animation:lights .55s steps(2) infinite}
.title{padding:8px 4px 6px;border:2px solid #ff4081;border-radius:12px;color:#fff;background:radial-gradient(ellipse at 50% 0,#00e5ff,#4a154b 70%);box-shadow:inset 0 0 0 3px #230530,inset 0 -11px 18px #000d,0 4px 0 #15021f;text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px;text-shadow:0 2px #15021f}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #6a1c87;border-radius:8px;background:linear-gradient(#15021f,#05000a);box-shadow:inset 0 0 9px #000,0 3px 0 #230530}
.stat{flex:1;border-right:1px solid #6a1c87;color:#e1bee7;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#00e5ff;font-size:14px;text-shadow:0 0 6px #00e5ff}
.frame{position:relative;padding:6px;border:4px solid #501366;border-radius:14px;background:linear-gradient(90deg,#15021f,#ff4081 5%,#230530 10%,#230530 90%,#ff4081 95%,#15021f);box-shadow:inset 0 0 0 3px #05000a,0 4px 0 #15021f,0 8px 15px #000b}
.reelbox{height:200px;border:3px solid #05000a;border-radius:9px;background:#1a1a2e;overflow:hidden;position:relative}
.reelbox canvas{display:block;width:100%;height:100%;touch-action:none}
.message{height:30px;margin:8px 2px 6px;display:grid;place-items:center;border:2px solid #6a1c87;border-radius:8px;color:#00e5ff;background:#15021f;text-align:center;font:bold 13px monospace;text-shadow:0 0 7px #00e5ff}
.ctrls{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:6px;margin:0 2px;padding:6px;border:3px solid #501366;border-radius:12px;background:linear-gradient(#4a154b,#110419);box-shadow:inset 0 2px #ff4081,0 5px #15021f,0 9px 12px #0008}
button{height:46px;border:2px solid #ff4081;border-radius:10px;color:#fff;font-weight:900;touch-action:none;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;font-size:16px}
.btn-dir{background:linear-gradient(#7b1fa2,#4a148c);box-shadow:inset 0 2px 4px #e1bee7,0 3px #230530}
.btn-boost{background:radial-gradient(circle at 50% 32%,#ff4081,#c2185b 60%,#880e4f);box-shadow:inset 0 2px 5px #ff80ab,0 3px #880e4f;text-shadow:0 1px 3px #000}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#05000af2}.over.on{display:grid}
.over button{padding:0 24px;margin-top:12px;background:#00e5ff;color:#000;border:none}
@keyframes lights{50%{filter:brightness(1.8)}}
</style></head><body>
<div class="machine">
<div class="lights"></div>
<div class="title">TURBO HIGHWAY</div>
<div class="stats"><div class="stat">SCORE<b id="sc">0</b></div><div class="stat">SPEED<b id="spd">40 MPH</b></div><div class="stat">BEST<b id="bs">0</b></div></div>
<div class="frame"><div class="reelbox"><canvas id="gc"></canvas></div></div>
<div class="message" id="msg">STEER & DODGE TRAFFIC</div>
<div class="ctrls">
<button id="left" class="btn-dir" type="button">◀ LEFT</button>
<button id="boost" class="btn-boost" type="button">⚡ BOOST</button>
<button id="right" class="btn-dir" type="button">RIGHT ▶</button>
</div>
<div class="over" id="over"><div><h2>CRASHED!</h2><div id="fs" style="font-size:16px;font-weight:bold;margin-bottom:8px"></div><button id="rb" type="button">RACE AGAIN</button></div></div>
</div>
<script>(()=>{
const c=document.getElementById("gc"),x=c.getContext("2d"),box=c.parentElement,btnL=document.getElementById("left"),btnR=document.getElementById("right"),btnB=document.getElementById("boost"),rb=document.getElementById("rb"),over=document.getElementById("over"),msg=document.getElementById("msg"),scEl=document.getElementById("sc"),bsEl=document.getElementById("bs"),spdEl=document.getElementById("spd"),fs=document.getElementById("fs");
let W,H,player,enemies=[],coins=[],score=0,best=0,alive=false,speed=3,baseSpeed=3,minSpeed=3,maxSpeed=9,rampRate=0.0022,roadOffset=0,roadWidth,roadX;
try{best=Number(localStorage.getItem("car_best"))||0}catch(e){}bsEl.textContent=best;
function size(){W=box.clientWidth;H=box.clientHeight;c.width=W;c.height=H;roadWidth=W*0.74;roadX=(W-roadWidth)/2}
function mph(s){return Math.round(s*13.3)}
function reset(){size();player={x:W/2,y:H-46,w:24,h:40,vx:0};enemies=[];coins=[];score=0;alive=true;baseSpeed=minSpeed;speed=baseSpeed;scEl.textContent=0;spdEl.textContent=mph(speed)+" MPH";msg.textContent="DODGE CARS!";over.classList.remove("on")}
function spawnEnemy(){const laneW=roadWidth/3,lane=Math.floor(Math.random()*3),ex=roadX+lane*laneW+laneW/2;enemies.push({x:ex,y:-50,w:24,h:40,speed:Math.random()*2+2.5,color:['#e91e63','#ff9800','#00e676','#ffd600'][Math.floor(Math.random()*4)]})}
function spawnCoin(){const laneW=roadWidth/3,lane=Math.floor(Math.random()*3),cx=roadX+lane*laneW+laneW/2;coins.push({x:cx,y:-30,r:7,collected:false})}
function die(){if(!alive)return;alive=false;best=Math.max(best,score);bsEl.textContent=best;fs.textContent="Final Score: "+score;over.classList.add("on");try{localStorage.setItem("car_best",best)}catch(e){}}
let steerLeft=false,steerRight=false,boosting=false;
function setupTouch(btn,down,up){
btn.addEventListener("pointerdown",e=>{e.preventDefault();down()});
btn.addEventListener("pointerup",e=>{e.preventDefault();up()});
btn.addEventListener("pointercancel",e=>{e.preventDefault();up()});
}
setupTouch(btnL,()=>steerLeft=true,()=>steerLeft=false);
setupTouch(btnR,()=>steerRight=true,()=>steerRight=false);
setupTouch(btnB,()=>{boosting=true},()=>{boosting=false});
rb.addEventListener("pointerdown",e=>{e.preventDefault();reset()});
addEventListener("keydown",e=>{
if(e.code==="ArrowLeft"||e.code==="KeyA")steerLeft=true;
if(e.code==="ArrowRight"||e.code==="KeyD")steerRight=true;
if(e.code==="ArrowUp"||e.code==="Space")boosting=true;
});
addEventListener("keyup",e=>{
if(e.code==="ArrowLeft"||e.code==="KeyA")steerLeft=false;
if(e.code==="ArrowRight"||e.code==="KeyD")steerRight=false;
if(e.code==="ArrowUp"||e.code==="Space")boosting=false;
});
let lastSpawn=0,lastCoin=0;
function update(){
if(!alive)return;
if(steerLeft)player.x-=4.2;
if(steerRight)player.x+=4.2;
player.x=Math.max(roadX+14,Math.min(roadX+roadWidth-14,player.x));
baseSpeed=Math.min(maxSpeed,minSpeed+score*rampRate);
speed=boosting?Math.min(maxSpeed*1.8,baseSpeed*1.8):baseSpeed;
spdEl.textContent=mph(speed)+" MPH";
roadOffset=(roadOffset+speed*1.8)%40;
score+=Math.round(speed*0.1);
scEl.textContent=score;
if(Date.now()-lastSpawn>Math.max(600,1600-score*0.5)){spawnEnemy();lastSpawn=Date.now()}
if(Date.now()-lastCoin>2500){spawnCoin();lastCoin=Date.now()}
for(let i=enemies.length-1;i>=0;i--){
const e=enemies[i];e.y+=speed-e.speed+2;
if(Math.abs(player.x-e.x)<(player.w+e.w)*0.42&&Math.abs(player.y-e.y)<(player.h+e.h)*0.42){die()}
if(e.y>H+60)enemies.splice(i,1);
}
for(let i=coins.length-1;i>=0;i--){
const c=coins[i];c.y+=speed+1;
if(Math.hypot(player.x-c.x,player.y-c.y)<player.w+c.r){score+=50;scEl.textContent=score;coins.splice(i,1)}
else if(c.y>H+40)coins.splice(i,1);
}
}
function drawCar(cx,cy,color,isPlayer){
x.save();x.translate(cx,cy);
x.fillStyle=color;x.beginPath();x.roundRect(-11,-18,22,36,5);x.fill();
x.fillStyle="#111";
x.fillRect(-13,-14,4,8);x.fillRect(9,-14,4,8);x.fillRect(-13,6,4,8);x.fillRect(9,6,4,8);
x.fillStyle="#80deea";x.beginPath();x.roundRect(-7,-10,14,9,2);x.fill();
x.fillStyle="#00bcd4";x.beginPath();x.roundRect(-7,4,14,6,2);x.fill();
if(isPlayer&&boosting){
x.fillStyle="#ffeb3b";x.beginPath();x.moveTo(-6,18);x.lineTo(0,27);x.lineTo(6,18);x.fill();
x.fillStyle="#ff5722";x.beginPath();x.moveTo(-3,18);x.lineTo(0,23);x.lineTo(3,18);x.fill();
}
x.restore();
}
function draw(){
x.fillStyle="#1a1a2e";x.fillRect(0,0,W,H);
x.fillStyle="#2b2b40";x.fillRect(roadX,0,roadWidth,H);
x.fillStyle="#ff4081";x.fillRect(roadX-4,0,4,H);x.fillRect(roadX+roadWidth,0,4,H);
x.fillStyle="#e0e0e0";
const laneW=roadWidth/3;
for(let l=1;l<=2;l++){
const lx=roadX+l*laneW;
for(let y=-40+roadOffset;y<H;y+=40){x.fillRect(lx-2,y,4,22)}
}
for(const c of coins){
x.save();x.translate(c.x,c.y);
x.fillStyle="#ffd700";x.beginPath();x.arc(0,0,c.r,0,Math.PI*2);x.fill();
x.fillStyle="#fff";x.beginPath();x.arc(-2,-2,c.r*0.4,0,Math.PI*2);x.fill();
x.restore();
}
for(const e of enemies){drawCar(e.x,e.y,e.color,false)}
if(alive){drawCar(player.x,player.y,"#00e5ff",true)}
}
function loop(){update();draw();requestAnimationFrame(loop)}
size();reset();loop();
})()</script></body></html>`
        });
    }
};
