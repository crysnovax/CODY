// File: src/Commands/Games/memory.js

module.exports = {
    name: 'memory',
    alias: ['memorymatch'],
    desc: 'Flip and match pairs of cards in the shortest moves and time',
    category: 'Games',
    usage: `${prefix}memory`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🃏', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;overflow:hidden;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;padding:0}
body{padding:8px;background:radial-gradient(circle at 50% 12%,#00695c,#004d40 60%,#00251a)}
.machine{position:relative;overflow:hidden;padding:12px;border:3px solid #004d40;border-radius:22px;background:linear-gradient(105deg,#00251a,#00695c 8%,#004d40 20%,#00796b 52%,#004d40 82%,#00897b 94%,#00251a);box-shadow:inset 0 0 0 2px #80cbc4,inset 0 0 0 6px #004d40,0 8px 0 #00251a,0 14px 24px #000c;touch-action:none}
.title{padding:8px 4px 6px;border:2px solid #80cbc4;border-radius:12px;color:#fff;background:radial-gradient(ellipse at 50% 0,#26a69a,#004d40 70%);text-align:center;font:bold 22px Impact,Arial Black,sans-serif;letter-spacing:2px}
.stats{display:flex;margin:8px 2px;padding:4px;border:2px solid #00897b;border-radius:8px;background:#00251a}
.stat{flex:1;border-right:1px solid #00897b;color:#80cbc4;text-align:center;font:bold 10px monospace}.stat:last-child{border:0}.stat b{display:block;margin-top:2px;color:#fff;font-size:15px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;width:100%;height:200px;padding:4px;perspective:600px}
.card{display:flex;align-items:center;justify-content:center;background:#004d40;border:2px solid #80cbc4;border-radius:8px;font-size:24px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .3s;user-select:none}
.card.flipped{background:#e0f2f1;transform:rotateY(180deg)}
.card.matched{background:#a7ffeb;border-color:#00bfa5}
.reset-btn{width:100%;height:40px;margin-top:8px;border:2px solid #80cbc4;border-radius:10px;background:#00796b;color:#fff;font-weight:bold;cursor:pointer}
.over{position:absolute;z-index:10;inset:0;display:none;place-items:center;text-align:center;color:#fff;background:#000000eb}.over.on{display:grid}
.over button{padding:0 22px;height:40px;margin-top:10px;background:#26a69a;color:#fff;border:none;border-radius:8px;font-weight:bold}
</style></head><body>
<div class="machine">
<div class="title">MEMORY MATCH</div>
<div class="stats"><div class="stat">MOVES<b id="mv">0</b></div><div class="stat">MATCHES<b id="mt">0/8</b></div></div>
<div class="grid" id="grid"></div>
<button id="rb" class="reset-btn">NEW GAME</button>
<div class="over" id="over"><div><h2>COMPLETED!</h2><div id="fs" style="margin-bottom:8px"></div><button id="rb2">PLAY AGAIN</button></div></div>
</div>
<script>(()=>{
const emojis=['🔥','⚡','💎','🚀','🎮','👑','🎯','⭐'];
const gridEl=document.getElementById("grid"),mvEl=document.getElementById("mv"),mtEl=document.getElementById("mt"),over=document.getElementById("over"),fs=document.getElementById("fs");
let cards=[],selected=[],moves=0,matches=0,busy=false;
function reset(){
const deck=[...emojis,...emojis].sort(()=>Math.random()-0.5);
gridEl.innerHTML="";moves=0;matches=0;selected=[];busy=false;
mvEl.textContent=0;mtEl.textContent="0/8";over.classList.remove("on");
deck.forEach((val,i)=>{
const d=document.createElement("div");
d.className="card";d.dataset.val=val;d.dataset.idx=i;
d.textContent="?";
d.onclick=()=>flip(d);
gridEl.appendChild(d);
});
}
function flip(card){
if(busy||card.classList.contains("flipped")||card.classList.contains("matched"))return;
card.classList.add("flipped");card.textContent=card.dataset.val;
selected.push(card);
if(selected.length===2){
moves++;mvEl.textContent=moves;busy=true;
const [c1,c2]=selected;
if(c1.dataset.val===c2.dataset.val){
setTimeout(()=>{
c1.classList.add("matched");c2.classList.add("matched");
matches++;mtEl.textContent=matches+"/8";selected=[];busy=false;
if(matches===8){fs.textContent="Cleared in "+moves+" moves!";over.classList.add("on")}
},300);
}else{
setTimeout(()=>{
c1.classList.remove("flipped");c1.textContent="?";
c2.classList.remove("flipped");c2.textContent="?";
selected=[];busy=false;
},700);
}
}
}
document.getElementById("rb").onclick=reset;
document.getElementById("rb2").onclick=reset;
reset();
})()</script></body></html>`
        });
    }
};
