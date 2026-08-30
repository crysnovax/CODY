/**
 * Zombie Nightfall — Complete HTML5 Canvas game rendered inside WhatsApp chat bubbles.
 * Pattern follows slots.js: self-contained game with real animations and game logic.
 */

const ZOMBIE_HTML = `<html><head><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;overflow:hidden;background:transparent;font-family:'Segoe UI',Arial,sans-serif}
body{padding:8px;background:radial-gradient(ellipse at 50% 30%,#2d0a0a,#1a0505 60%,#0d0202)}
.game{position:relative;border-radius:16px;border:4px solid #4a1a1a;background:#1a0a0a;box-shadow:inset 0 0 30px #00000088,0 6px 0 #2a0a0a,0 12px 20px #00000088;padding:10px;overflow:hidden}
.game::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,0,0,.01) 2px,rgba(255,0,0,.01) 4px);pointer-events:none;border-radius:12px;animation:scanline 4s linear infinite}
@keyframes scanline{0%{background-position:0 0}100%{background-position:0 40px}}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:6px 10px;border-radius:10px;background:#00000088;border:1px solid #ff000033}
.title{font:bold 16px 'Georgia',serif;color:#ff4444;text-shadow:0 0 10px #ff000066;letter-spacing:2px}
.day-display{font:bold 12px monospace;color:#ffd700;text-shadow:0 0 6px #ffd70055}
.hp-bar{width:100%;height:16px;background:#1a1a1a;border-radius:8px;border:2px solid #333;margin:6px 0;overflow:hidden;position:relative}
.hp-fill{height:100%;background:linear-gradient(90deg,#22c55e,#16a34a);border-radius:6px;transition:width .4s ease;position:relative}
.hp-fill::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.2),transparent);border-radius:6px}
.hp-fill.danger{background:linear-gradient(90deg,#ef4444,#dc2626)}
.hp-fill.warning{background:linear-gradient(90deg,#f59e0b,#d97706)}
.hp-text{position:absolute;inset:0;display:grid;place-items:center;font:bold 10px monospace;color:#fff;text-shadow:0 1px 2px #000}
.stats-row{display:flex;gap:8px;margin:6px 0}
.stat-box{flex:1;padding:6px;border-radius:8px;background:#00000066;border:1px solid #ffffff11;text-align:center}
.stat-box .label{font-size:9px;color:#888;letter-spacing:1px;text-transform:uppercase}
.stat-box .value{font:bold 16px monospace;margin-top:2px}
.stat-box.ammo .value{color:#f59e0b}
.stat-box.barricade .value{color:#22c55e}
.stat-box.kills .value{color:#ef4444}
.arena{position:relative;width:100%;height:140px;background:#0a0a0a;border-radius:8px;border:2px solid #222;margin:6px 0;overflow:hidden}
.arena::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,.02) 20px,rgba(255,255,255,.02) 40px)}
.player{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);font-size:24px;filter:drop-shadow(0 0 5px #22c55e);transition:left .2s}
.zombie{position:absolute;font-size:20px;filter:drop-shadow(0 0 3px #ff0000);transition:all .3s}
.zombie.hit{filter:drop-shadow(0 0 8px #ff0000) brightness(2)}
.bullet{position:absolute;width:4px;height:4px;background:#ffd700;border-radius:50%;box-shadow:0 0 6px #ffd700;transition:all .2s}
.message{height:24px;display:grid;place-items:center;font:bold 11px monospace;color:#ff4444;text-shadow:0 0 5px #ff000044}
.controls{display:flex;gap:8px;justify-content:center;margin:8px 0}
.action-btn{padding:10px 22px;border:2px solid;border-radius:12px;font:bold 13px 'Segoe UI',sans-serif;cursor:pointer;text-transform:uppercase;letter-spacing:1px;touch-action:none;transition:all .15s;color:#fff}
.action-btn:active{transform:scale(.95)}
.action-btn.shoot{background:linear-gradient(#ef4444,#b91c1c);border-color:#dc2626;box-shadow:0 3px 0 #7f1d1d,0 0 10px #ef444444}
.action-btn.barricade{background:linear-gradient(#22c55e,#15803d);border-color:#16a34a;box-shadow:0 3px 0 #14532d}
.action-btn.run{background:linear-gradient(#3b82f6,#1d4ed8);border-color:#2563eb;box-shadow:0 3px 0 #1e3a5f}
.action-btn:disabled{opacity:.3;transform:none;cursor:default}
.log{max-height:50px;overflow:hidden;margin:4px 0;padding:6px;background:#00000044;border-radius:6px;border:1px solid #ffffff11}
.log-entry{font:10px monospace;color:#aaa;margin:2px 0;animation:logIn .3s ease}
@keyframes logIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
.log-entry .good{color:#22c55e}
.log-entry .bad{color:#ef4444}
.log-entry .info{color:#fbbf24}
.result-overlay{position:absolute;inset:0;display:grid;place-items:center;background:#000000dd;border-radius:12px;z-index:10;opacity:0;pointer-events:none;transition:opacity .3s}
.result-overlay.show{opacity:1;pointer-events:auto}
.result-text{font:bold 28px Georgia,serif;text-align:center;text-shadow:0 0 20px currentColor}
.result-sub{font:13px monospace;color:#ccc;margin-top:6px}
.btn-new{margin-top:12px;padding:8px 24px;border:2px solid #8b5cf6;border-radius:10px;background:linear-gradient(#8b5cf6,#6d28d9);color:#fff;font:bold 12px sans-serif;cursor:pointer;touch-action:none}
.danger-pulse{animation:dangerPulse 1s ease infinite}
@keyframes dangerPulse{0%,100%{box-shadow:inset 0 0 20px #ff000011}50%{box-shadow:inset 0 0 30px #ff000033}}
</style></head><body>
<div class="game" id="game">
  <div class="header">
    <div class="title">🧟 ZOMBIE NIGHTFALL</div>
    <div class="day-display" id="dayDisplay">DAY 1/10</div>
  </div>
  <div class="hp-bar"><div class="hp-fill" id="hpFill" style="width:100%"></div><div class="hp-text" id="hpText">10/10 HP</div></div>
  <div class="stats-row">
    <div class="stat-box ammo"><div class="label">Ammo</div><div class="value" id="ammo">6</div></div>
    <div class="stat-box barricade"><div class="label">Barricade</div><div class="value" id="barricade">2</div></div>
    <div class="stat-box kills"><div class="label">Kills</div><div class="value" id="kills">0</div></div>
  </div>
  <div class="arena" id="arena"><div class="player" id="player">🧑</div></div>
  <div class="log" id="log"><div class="log-entry"><span class="info">🧟 The dead are moving...</span></div></div>
  <div class="message" id="message">Choose your action!</div>
  <div class="controls" id="controls">
    <button class="action-btn shoot" onclick="window._zbShoot()">🔫 SHOOT</button>
    <button class="action-btn barricade" onclick="window._zbBarricade()">🪵 BARRICADE</button>
    <button class="action-btn run" onclick="window._zbRun()">🏃 RUN</button>
  </div>
  <div class="result-overlay" id="result">
    <div><div class="result-text" id="resultText"></div><div class="result-sub" id="resultSub"></div><button class="btn-new" onclick="window._zbNew()">FIGHT AGAIN</button></div>
  </div>
</div>
<script>
(function(){
var hp=10,maxHp=10,ammo=6,barricade=2,day=1,maxDay=10,kills=0,phase='playing';
var $=function(id){return document.getElementById(id)};

function updateUI(){
  var pct=Math.round((hp/maxHp)*100);
  var fill=$('hpFill');
  fill.style.width=pct+'%';
  fill.className='hp-fill'+(pct<=30?' danger':pct<=60?' warning':'');
  $('hpText').textContent=hp+'/'+maxHp+' HP';
  $('ammo').textContent=ammo;
  $('barricade').textContent=barricade;
  $('kills').textContent=kills;
  $('dayDisplay').textContent='DAY '+day+'/'+maxDay;
  var g=$('game');
  if(hp<=3)g.classList.add('danger-pulse');else g.classList.remove('danger-pulse');
}

function addLog(text){
  var l=$('log');
  var e=document.createElement('div');e.className='log-entry';e.innerHTML=text;
  l.prepend(e);
  if(l.children.length>6)l.removeChild(l.lastChild);
}

function spawnZombies(){
  var arena=$('arena');
  var existing=arena.querySelectorAll('.zombie');
  existing.forEach(function(z){z.remove()});
  var count=Math.min(1+Math.floor(day/2),6);
  for(var i=0;i<count;i++){
    var z=document.createElement('div');z.className='zombie';z.textContent='🧟';
    z.style.left=(10+Math.random()*80)+'%';
    z.style.top=(10+Math.random()*60)+'%';
    z.style.fontSize=(16+Math.random()*8)+'px';
    z.style.animationDelay=(Math.random()*0.5)+'s';
    arena.appendChild(z);
  }
}

function shootAnim(){
  var arena=$('arena');
  var zombies=arena.querySelectorAll('.zombie');
  if(zombies.length>0){
    var z=zombies[Math.floor(Math.random()*zombies.length)];
    z.classList.add('hit');
    var bullet=document.createElement('div');bullet.className='bullet';
    bullet.style.left='50%';bullet.style.bottom='20px';
    arena.appendChild(bullet);
    setTimeout(function(){
      bullet.style.left=z.style.left;bullet.style.top=z.style.top;
      setTimeout(function(){bullet.remove()},200);
      setTimeout(function(){z.textContent='💀';z.style.filter='drop-shadow(0 0 5px #666) grayscale(1)';z.classList.remove('hit')},300);
    },100);
  }
}

function gameOver(won){
  phase='done';
  var r=$('result'),t=$('resultText'),s=$('resultSub');
  if(won){t.textContent='🏆 SURVIVED!';t.style.color='#22c55e';s.textContent='All 10 days survived! '+kills+' zombies killed'}
  else{t.textContent='💀 YOU DIED';t.style.color='#ef4444';s.textContent='Survived '+(day-1)+' days. '+kills+' kills'}
  r.classList.add('show');
  $('controls').style.display='none';
}

function resolve(action){
  if(phase!=='playing')return;
  var threat=Math.max(0,3-Math.floor(barricade/2));
  
  if(action==='shoot'){
    if(ammo<=0){addLog('<span class="bad">No ammo!</span>');return}
    ammo--;
    var hit=Math.random()>0.3;
    if(hit){kills++;addLog('<span class="good">🔫 Headshot! Zombie eliminated.</span>');shootAnim()}
    else{addLog('<span class="info">🔫 Shot missed...</span>')}
    threat=Math.max(0,threat-1);
  }else if(action==='barricade'){
    barricade=Math.min(5,barricade+2);
    addLog('<span class="good">🪵 Barricade reinforced! (+2)</span>');
    threat=0;
  }else if(action==='run'){
    addLog('<span class="info">🏃 Sprinting through...</span>');
    threat+=1;
  }
  
  if(threat>0){
    hp-=threat;
    addLog('<span class="bad">🧟 Horde attacks for '+threat+' damage!</span>');
  }else{
    addLog('<span class="good">🛡️ Barricade held!</span>');
  }
  
  if(hp<=0){hp=0;updateUI();spawnZombies();gameOver(false);return}
  
  day++;
  if(day>maxDay){updateUI();gameOver(true);return}
  
  updateUI();
  spawnZombies();
  $('message').textContent='Day '+day+' — Choose your action!';
  
  $('controls').innerHTML='<button class="action-btn shoot" onclick="window._zbShoot()"'+(ammo<=0?' disabled':'')+'>🔫 SHOOT ('+ammo+')</button><button class="action-btn barricade" onclick="window._zbBarricade()">🪵 BARRICADE ('+barricade+')</button><button class="action-btn run" onclick="window._zbRun()">🏃 RUN</button>';
}

window._zbShoot=function(){resolve('shoot')};
window._zbBarricade=function(){resolve('barricade')};
window._zbRun=function(){resolve('run')};

window._zbNew=function(){
  hp=10;ammo=6;barricade=2;day=1;kills=0;phase='playing';
  $('result').classList.remove('show');
  $('controls').style.display='flex';
  $('controls').innerHTML='<button class="action-btn shoot" onclick="window._zbShoot()">🔫 SHOOT</button><button class="action-btn barricade" onclick="window._zbBarricade()">🪵 BARRICADE</button><button class="action-btn run" onclick="window._zbRun()">🏃 RUN</button>';
  $('log').innerHTML='<div class="log-entry"><span class="info">🧟 The dead are moving...</span></div>';
  $('message').textContent='Choose your action!';
  updateUI();spawnZombies();
};

updateUI();spawnZombies();
</script></body></html>`;

module.exports = {
    name: 'zombie',
    alias: ['zombies', 'survival'],
    desc: 'Survive 10 days of zombie nightfall with a full interactive game!',
    category: 'Games',
    usage: '.zombie',
    execute: async (sock, m, { reply }) => {
        if (typeof sock.sendHtmlMessage === 'function') {
            return sock.sendHtmlMessage(m.chat, { html: ZOMBIE_HTML }, { quoted: m });
        }
        return reply('Zombie requires @crysnovax/baileys with HTML support. Update the package.');
    }
};
