/**
 * Penalty Shootout — Complete HTML5 Canvas game rendered inside WhatsApp chat bubbles.
 * Pattern follows slots.js: self-contained game with real animations.
 */

const PENALTY_HTML = `<html><head><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;overflow:hidden;background:transparent;font-family:'Segoe UI',Arial,sans-serif}
body{padding:8px;background:radial-gradient(ellipse at 50% 100%,#1a5c1a,#0e3d0e 60%,#062406)}
.field{position:relative;border-radius:16px;border:4px solid #8b6914;background:#1e7a1e;box-shadow:inset 0 0 20px #00000044,0 6px 0 #5a3d0a,0 12px 20px #00000088;padding:10px;overflow:hidden}
.field::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 18px,rgba(255,255,255,.03) 18px,rgba(255,255,255,.03) 36px);pointer-events:none;border-radius:12px}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:6px 10px;border-radius:10px;background:#00000066;border:1px solid #ffffff22}
.title{font:bold 18px 'Georgia',serif;color:#ffd700;text-shadow:0 2px 4px #000a;letter-spacing:2px}
.score-display{font:bold 14px monospace;color:#fff;text-shadow:0 0 8px #ffd70088}
.goal-area{position:relative;width:100%;height:120px;margin:8px 0;border-radius:8px;background:linear-gradient(180deg,#1a3a1a,#0d240d);border:2px solid #ffffff22;overflow:hidden}
.goal-frame{position:absolute;top:0;left:50%;transform:translateX(-50%);width:80%;height:100%;border:4px solid #ccc;border-bottom:none;border-radius:4px 4px 0 0;box-shadow:0 0 15px #ffffff11}
.goal-net{position:absolute;top:0;left:50%;transform:translateX(-50%);width:calc(80% - 8px);height:calc(100% - 4px);background:repeating-linear-gradient(90deg,transparent,transparent 8px,rgba(255,255,255,.05) 8px,rgba(255,255,255,.05) 9px),repeating-linear-gradient(0deg,transparent,transparent 8px,rgba(255,255,255,.05) 8px,rgba(255,255,255,.05) 9px);pointer-events:none}
.goalkeeper{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);width:40px;height:50px;transition:left .3s cubic-bezier(.2,.8,.3,1);z-index:3}
.gk-body{width:100%;height:100%;background:radial-gradient(circle at 50% 30%,#e74c3c,#c0392b);border-radius:8px 8px 4px 4px;position:relative}
.gk-body::before{content:'🧤';position:absolute;top:-5px;left:-5px;font-size:14px}
.gk-body::after{content:'🧤';position:absolute;top:-5px;right:-5px;font-size:14px}
.gk-head{position:absolute;top:-12px;left:50%;transform:translateX(-50%);width:18px;height:18px;background:#f4d03f;border-radius:50%;border:2px solid #f39c12}
.gk-dive-left .gk-body{transform:rotate(-45deg) translateX(-15px)}
.gk-dive-right .gk-body{transform:rotate(45deg) translateX(15px)}
.gk-dive-center .gk-body{transform:scaleY(.6) translateY(10px)}
.ball{position:absolute;width:14px;height:14px;background:radial-gradient(circle at 35% 35%,#fff,#ddd 40%,#999);border-radius:50%;box-shadow:0 2px 4px #00000066;z-index:4;transition:all .4s cubic-bezier(.4,0,.2,1)}
.ball.goal{box-shadow:0 0 15px #ffd700,0 0 30px #ffd70066}
.ball.miss{box-shadow:0 0 10px #ef444466}
.grass{position:absolute;bottom:0;left:0;right:0;height:20px;background:linear-gradient(0deg,#0d3d0d,#1a5c1a);border-radius:0 0 12px 12px}
.targets{display:flex;gap:10px;justify-content:center;margin:8px 0}
.target-btn{padding:10px 20px;border:2px solid;border-radius:12px;font:bold 14px 'Segoe UI',sans-serif;cursor:pointer;text-transform:uppercase;letter-spacing:1px;touch-action:none;transition:all .15s;color:#fff}
.target-btn:active{transform:scale(.95)}
.target-btn.left{background:linear-gradient(#22c55e,#15803d);border-color:#16a34a;box-shadow:0 3px 0 #14532d}
.target-btn.center{background:linear-gradient(#3b82f6,#1d4ed8);border-color:#2563eb;box-shadow:0 3px 0 #1e3a5f}
.target-btn.right{background:linear-gradient(#f59e0b,#d97706);border-color:#f59e0b;box-shadow:0 3px 0 #92400e}
.shot-tracker{display:flex;gap:6px;justify-content:center;margin:8px 0}
.shot-dot{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:14px;border:2px solid #ffffff33;background:#00000044}
.shot-dot.goal{background:#22c55e44;border-color:#22c55e;animation:dotPop .3s ease}
.shot-dot.miss{background:#ef444444;border-color:#ef4444}
@keyframes dotPop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}
.message{height:28px;display:grid;place-items:center;font:bold 12px monospace;color:#ffd700;text-shadow:0 0 6px #ffd70055}
.result-overlay{position:absolute;inset:0;display:grid;place-items:center;background:#000000cc;border-radius:12px;z-index:10;opacity:0;pointer-events:none;transition:opacity .3s}
.result-overlay.show{opacity:1;pointer-events:auto}
.result-text{font:bold 26px Georgia,serif;text-align:center;text-shadow:0 0 20px currentColor}
.result-sub{font:14px monospace;color:#ccc;margin-top:6px}
.btn-new{margin-top:12px;padding:8px 24px;border:2px solid #8b5cf6;border-radius:10px;background:linear-gradient(#8b5cf6,#6d28d9);color:#fff;font:bold 12px sans-serif;cursor:pointer;touch-action:none}
.stats{display:flex;justify-content:space-between;font:10px monospace;color:#ffffff55;margin-top:4px}
</style></head><body>
<div class="field" id="field">
  <div class="header">
    <div class="title">⚽ PENALTY SHOOTOUT</div>
    <div class="score-display" id="scoreDisplay">0/5</div>
  </div>
  <div class="goal-area" id="goalArea">
    <div class="goal-net"></div>
    <div class="goal-frame"></div>
    <div class="goalkeeper" id="gk"><div class="gk-head"></div><div class="gk-body"></div></div>
    <div class="ball" id="ball" style="bottom:10px;left:50%;transform:translateX(-50%)"></div>
    <div class="grass"></div>
  </div>
  <div class="shot-tracker" id="tracker"></div>
  <div class="message" id="message">Pick your target!</div>
  <div class="targets" id="targets">
    <button class="target-btn left" onclick="window._pnShoot('left')">⬅ LEFT</button>
    <button class="target-btn center" onclick="window._pnShoot('center')">⬆ CENTER</button>
    <button class="target-btn right" onclick="window._pnShoot('right')">➡ RIGHT</button>
  </div>
  <div class="stats"><span>⚽ Penalty Shootout</span><span id="stats">G:0 S:0</span></div>
  <div class="result-overlay" id="result">
    <div><div class="result-text" id="resultText"></div><div class="result-sub" id="resultSub"></div><button class="btn-new" onclick="window._pnNew()">PLAY AGAIN</button></div>
  </div>
</div>
<script>
(function(){
var shot=0,score=0,saves=0,history=[],shootable=true;
var positions={left:'15%',center:'48%',right:'81%'};
var gkPositions=['left','center','right'];
var $=function(id){return document.getElementById(id)};

function updateTracker(){
  var t=$('tracker');t.innerHTML='';
  for(var i=0;i<5;i++){
    var d=document.createElement('div');d.className='shot-dot';
    if(i<history.length)d.className+=' '+(history[i]?'goal':'miss');
    d.textContent=i<history.length?(history[i]?'⚽':'✗'):(i+1);
    t.appendChild(d);
  }
}

function animate(target){
  shootable=false;
  var gk=document.getElementById('gk');
  var ball=document.getElementById('ball');
  var keeper=gkPositions[Math.floor(Math.random()*3)];
  
  // Goalkeeper dives
  gk.className='goalkeeper gk-dive-'+keeper;
  
  // Ball flies
  setTimeout(function(){
    ball.style.left=positions[target];
    ball.style.bottom='60px';
    
    var goal=(target!==keeper);
    
    setTimeout(function(){
      if(goal){
        ball.classList.add('goal');
        score++;
        history.push(true);
        $('message').textContent='⚽ GOOAAAL! Keeper went '+keeper;
      }else{
        ball.classList.add('miss');
        saves++;
        history.push(false);
        $('message').textContent='✗ SAVED! Keeper dived '+keeper;
      }
      updateTracker();
      $('scoreDisplay').textContent=(shot+1)+'/5';
      $('stats').textContent='G:'+score+' S:'+saves;
      
      setTimeout(function(){
        // Reset ball
        ball.className='ball';
        ball.style.left='50%';
        ball.style.bottom='10px';
        gk.className='goalkeeper';
        shot++;
        
        if(shot>=5){
          var won=score>=3;
          $('resultText').textContent=won?'🏆 YOU WIN!':'😞 YOU LOSE';
          $('resultText').style.color=won?'#22c55e':'#ef4444';
          $('resultSub').textContent=score+' of 5 goals scored';
          $('result').classList.add('show');
          $('message').textContent=won?'Champion!':'Better luck next time';
          $('targets').style.display='none';
        }else{
          shootable=true;
          $('message').textContent='Pick your target! ('+shot+'/5)';
        }
      },600);
    },500);
  },200);
}

window._pnShoot=function(target){
  if(!shootable||shot>=5)return;
  animate(target);
};

window._pnNew=function(){
  shot=0;score=0;saves=0;history=[];shootable=true;
  $('result').classList.remove('show');
  $('targets').style.display='flex';
  $('message').textContent='Pick your target!';
  $('scoreDisplay').textContent='0/5';
  $('stats').textContent='G:0 S:0';
  updateTracker();
};

updateTracker();
</script></body></html>`;

module.exports = {
    name: 'penalty',
    alias: ['football', 'soccer', 'ball'],
    desc: 'Play a full interactive penalty shootout game rendered inside WhatsApp!',
    category: 'Games',
    usage: '.penalty',
    execute: async (sock, m, { reply }) => {
        if (typeof sock.sendHtmlMessage === 'function') {
            return sock.sendHtmlMessage(m.chat, { html: PENALTY_HTML }, { quoted: m });
        }
        return reply('Penalty requires @crysnovax/baileys with HTML support. Update the package.');
    }
};
