// File: src/Commands/Games/whack.js

module.exports = {
    name: 'whack',
    alias: ['mole', 'whackamole'],
    desc: 'Fast-paced reaction arcade game to whack popping moles before time runs out',
    category: 'Games',
    usage: `${prefix}whack`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🔨', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#e65100,#5d2200 60%,#1a0500)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #5d2200;border-radius:22px;background:linear-gradient(105deg,#1a0500,#e65100 8%,#4e1a00 20%,#ef6c00 52%,#4e1a00 82%,#ff9800 94%,#1a0500);box-shadow:inset 0 0 0 2px #ffe082,inset 0 0 0 6px #5d2200,0 8px 0 #1a0500,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #ffe082;border-radius:12px;color:#fff8e1;background:radial-gradient(ellipse at 50% 0,#ffa726,#e65100 70%);text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #ff9800;border-radius:8px;background:#1a0500}
.stat{flex:1;border-right:1px solid #ff9800;color:#ffe082;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#fff;font-size:15px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;height:190px;padding:6px;background:#3e2723;border-radius:12px;border:2px solid #ff9800}
.hole{position:relative;background:#271406;border-radius:50%;overflow:hidden;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;justify-content:center;border:3px solid #5d4037}
.mole{font-size:32px;transform:translateY(100%);transition:transform .12s;user-select:none}
.hole.active .mole{transform:translateY(0)}
.hole.hit .mole{transform:translateY(0) scale(0.8);filter:grayscale(1)}
.reset-btn{width:100%;height:40px;margin-top:8px;border:2px solid #ffe082;border-radius:10px;background:#ef6c00;color:#fff;font-weight:bold;cursor:pointer}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000eb}.over.on{display:grid}
.over button{padding:0 22px;height:40px;margin-top:10px;background:#ffa726;color:#000;border:none;border-radius:8px;font-weight:bold}
</style></head><body>
<div class="machine">
<div class="title">WHACK-A-MOLE</div>
<div class="stats"><div class="stat">SCORE<b id="sc">0</b></div><div class="stat">TIME<b id="tm">30s</b></div><div class="stat">BEST<b id="bs">0</b></div></div>
<div class="grid" id="grid"></div>
<button id="rb" class="reset-btn">START / RESTART</button>
<div class="over" id="over"><div><h2>TIME'S UP!</h2><div id="fs" style="margin-bottom:8px"></div><button id="rb2">PLAY AGAIN</button></div></div>
</div>
<script>(()=>{
const gridEl=document.getElementById("grid"),scEl=document.getElementById("sc"),tmEl=document.getElementById("tm"),bsEl=document.getElementById("bs"),over=document.getElementById("over"),fs=document.getElementById("fs");
let holes=[],score=0,timeLeft=30,timer=null,moleTimer=null,activeIdx=-1,best=0;
try{best=Number(localStorage.getItem("whack_best"))||0}catch(e){}bsEl.textContent=best;
for(let i=0;i<9;i++){
const h=document.createElement("div");h.className="hole";
const m=document.createElement("div");m.className="mole";m.textContent="🐹";
h.appendChild(m);
h.onpointerdown=()=>{if(h.classList.contains("active")&&!h.classList.contains("hit")){
h.classList.add("hit");score+=10;scEl.textContent=score;
}};
gridEl.appendChild(h);holes.push(h);
}
function popMole(){
holes.forEach(h=>h.className="hole");
if(timeLeft<=0)return;
activeIdx=Math.floor(Math.random()*holes.length);
holes[activeIdx].classList.add("active");
moleTimer=setTimeout(popMole,Math.max(450,900-score*5));
}
function reset(){
clearInterval(timer);clearTimeout(moleTimer);
score=0;timeLeft=30;scEl.textContent=0;tmEl.textContent="30s";over.classList.remove("on");
holes.forEach(h=>h.className="hole");
timer=setInterval(()=>{
timeLeft--;tmEl.textContent=timeLeft+"s";
if(timeLeft<=0){
clearInterval(timer);clearTimeout(moleTimer);holes.forEach(h=>h.className="hole");
best=Math.max(best,score);bsEl.textContent=best;fs.textContent="Score: "+score;
over.classList.add("on");try{localStorage.setItem("whack_best",best)}catch(e){}
}
},1000);
popMole();
}
document.getElementById("rb").onclick=reset;
document.getElementById("rb2").onclick=reset;
reset();
})()</script></body></html>`
        });
    }
};
