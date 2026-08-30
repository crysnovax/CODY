/**
 * Blackjack — Complete HTML5 Canvas game rendered inside WhatsApp chat bubbles.
 * Pattern follows slots.js: delegates ALL game logic + rendering to the HTML payload.
 */

const BLACKJACK_HTML = `<html><head><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;overflow:hidden;background:transparent;font-family:'Segoe UI',Arial,sans-serif}
body{padding:8px;background:radial-gradient(ellipse at 50% 30%,#1a6b3c,#0d4a24 55%,#062e15)}
.table{position:relative;border-radius:20px;border:4px solid #8b6914;background:radial-gradient(ellipse at 50% 40%,#1e8c4e,#14703a 50%,#0b5228);box-shadow:inset 0 0 30px #00000044,0 8px 0 #5a3d0a,0 14px 25px #00000088;padding:10px;overflow:hidden}
.table::before{content:'';position:absolute;inset:6px;border:2px solid #b8941a55;border-radius:16px;pointer-events:none}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:6px 10px;border-radius:10px;background:#00000066;border:1px solid #b8941a44}
.title{font:bold 18px 'Georgia',serif;color:#ffd700;text-shadow:0 2px 4px #000a,0 0 10px #ffd70055;letter-spacing:2px}
.timer{font:bold 12px monospace;color:#ff6b6b;text-shadow:0 0 6px #ff000066}
.area{position:relative;display:flex;justify-content:center;gap:4px;margin:6px 0;min-height:85px;align-items:center}
.label{font-size:10px;color:#b8941aaa;text-align:center;margin-bottom:3px;letter-spacing:1px;text-transform:uppercase}
.card{width:55px;height:80px;border-radius:6px;background:#fff;border:1px solid #ccc;box-shadow:0 2px 6px #00000044;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;font-weight:bold;position:relative;transform:rotateY(0);transition:transform .4s;flex-shrink:0}
.card.red{color:#dc143c}
.card.black{color:#1a1a1a}
.card .rank{font-size:18px;line-height:1}
.card .suit{font-size:16px;line-height:1}
.card .corner{position:absolute;font-size:8px;line-height:1}
.card .corner.tl{top:3px;left:4px}
.card .corner.br{bottom:3px;right:4px;transform:rotate(180deg)}
.card.back{background:repeating-linear-gradient(45deg,#1a237e,#1a237e 3px,#283593 3px,#283593 6px);border:2px solid #ffd700}
.card.back::after{content:'🂠';font-size:28px;filter:brightness(.7)}
.card.deal{animation:dealIn .4s ease-out both}
@keyframes dealIn{from{opacity:0;transform:translateY(-30px) rotate(-10deg) scale(.7)}to{opacity:1;transform:translateY(0) rotate(0) scale(1)}}
.hand-total{font:bold 13px monospace;color:#ffd700;text-shadow:0 0 5px #ffd70055;margin-top:4px}
.controls{display:flex;gap:8px;justify-content:center;margin-top:8px}
.btn{padding:8px 18px;border:2px solid;border-radius:10px;font:bold 13px 'Segoe UI',sans-serif;cursor:pointer;text-transform:uppercase;letter-spacing:1px;touch-action:none;transition:all .15s}
.btn:active{transform:scale(.95)}
.btn.hit{background:linear-gradient(#22c55e,#15803d);border-color:#16a34a;color:#fff;box-shadow:0 3px 0 #14532d,0 0 10px #22c55e44}
.btn.stand{background:linear-gradient(#ef4444,#b91c1c);border-color:#dc2626;color:#fff;box-shadow:0 3px 0 #7f1d1d,0 0 10px #ef444444}
.btn.double{background:linear-gradient(#f59e0b,#d97706);border-color:#f59e0b;color:#fff;box-shadow:0 3px 0 #92400e,0 0 10px #f59e0b44}
.btn.new{background:linear-gradient(#8b5cf6,#6d28d9);border-color:#7c3aed;color:#fff;box-shadow:0 3px 0 #4c1d95,0 0 10px #8b5cf644}
.btn:disabled{opacity:.4;transform:none;cursor:default}
.bet-area{display:flex;gap:6px;justify-content:center;margin:6px 0}
.chip{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font:bold 10px monospace;border:3px dashed;color:#fff;cursor:pointer;touch-action:none;transition:transform .15s;box-shadow:0 2px 6px #0006}
.chip:active{transform:scale(.9)}
.chip.c10{background:radial-gradient(circle,#ef4444,#991b1b);border-color:#fca5a5}
.chip.c25{background:radial-gradient(circle,#22c55e,#166534);border-color:#86efac}
.chip.c50{background:radial-gradient(circle,#3b82f6,#1e3a5f);border-color:#93c5fd}
.chip.c100{background:radial-gradient(circle,#f59e0b,#92400e);border-color:#fde68a}
.bet-display{text-align:center;font:bold 12px monospace;color:#ffd700;margin:4px 0}
.result{position:absolute;inset:0;display:grid;place-items:center;background:#000000cc;border-radius:16px;z-index:10;opacity:0;pointer-events:none;transition:opacity .3s}
.result.show{opacity:1;pointer-events:auto}
.result-text{font:bold 28px Georgia,serif;text-align:center;text-shadow:0 0 20px currentColor}
.result-sub{font:14px monospace;color:#ccc;margin-top:6px}
.message{height:24px;display:grid;place-items:center;font:bold 11px monospace;color:#ffd700;text-shadow:0 0 5px #ffd70055}
.info{display:flex;justify-content:space-between;font:10px monospace;color:#b8941a88;margin-top:4px}
.particles{position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:16px}
.spark{position:absolute;width:4px;height:4px;border-radius:50%;animation:sparkFly .8s ease-out forwards}
@keyframes sparkFly{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(0)}}
.glow{animation:glow .6s ease-in-out infinite alternate}
@keyframes glow{from{box-shadow:0 0 5px currentColor}to{box-shadow:0 0 20px currentColor,0 0 40px currentColor}}
.dealer-label,.player-label{font:bold 9px monospace;color:#ffd70088;text-align:center;letter-spacing:1px}
</style></head><body>
<div class="table" id="table">
  <div class="header">
    <div class="title">♠ BLACKJACK ♥</div>
    <div class="timer" id="balance">💰 1000</div>
  </div>
  <div class="dealer-label">DEALER</div>
  <div class="area" id="dealer"></div>
  <div class="hand-total" id="dealerTotal"></div>
  <div style="height:1px;background:linear-gradient(90deg,transparent,#b8941a44,transparent);margin:6px 0"></div>
  <div class="player-label">PLAYER</div>
  <div class="area" id="player"></div>
  <div class="hand-total" id="playerTotal"></div>
  <div class="bet-display" id="betDisplay">BET: 0</div>
  <div class="bet-area" id="betArea"></div>
  <div class="message" id="message">Place your bets!</div>
  <div class="controls" id="controls"></div>
  <div class="info"><span>♠♥♦♣ BLACKJACK</span><span id="stats">W:0 L:0</span></div>
  <div class="result" id="result">
    <div><div class="result-text" id="resultText"></div><div class="result-sub" id="resultSub"></div></div>
  </div>
  <div class="particles" id="particles"></div>
</div>
<script>
(function(){
var SUITS=['♠','♥','♦','♣'],RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
var VALUES={A:11,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:10,Q:10,K:10};
var deck=[],dealer=[],player=[],bet=0,balance=1000,wins=0,losses=0,phase='betting';
var $=function(id){return document.getElementById(id)};

function shuffle(){deck=[];for(var d=0;d<4;d++)for(var s=0;s<4;s++)for(var r=0;r<13;r++)deck.push({suit:SUITS[s],rank:RANKS[r],value:VALUES[RANKS[r]],red:s>=1});for(var i=deck.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=deck[i];deck[i]=deck[j];deck[j]=t}}

function handValue(h){var v=0,a=0;for(var i=0;i<h.length;i++){v+=h[i].value;if(h[i].rank==='A')a++}while(v>21&&a>0){v-=10;a--}return v}

function cardHtml(c,back,del){
  var cls='card'+(c.red?' red':' black')+(del?' deal':'');
  if(back)return '<div class="'+cls+' back"></div>';
  return '<div class="'+cls+'"><span class="corner tl">'+c.rank+'<br>'+c.suit+'</span><span class="rank">'+c.rank+'</span><span class="suit">'+c.suit+'</span><span class="corner br">'+c.rank+'<br>'+c.suit+'</span></div>';
}

function render(){
  var dH=$('dealer'),pH=$('player');
  dH.innerHTML='';pH.innerHTML='';
  for(var i=0;i<dealer.length;i++){
    var back=(i===1&&phase!=='done');
    dH.innerHTML+=cardHtml(dealer[i],back,i===dealer.length-1);
  }
  for(var i=0;i<player.length;i++){
    pH.innerHTML+=cardHtml(player[i],false,i===player.length-1);
  }
  var pv=handValue(player);
  $('playerTotal').textContent=player.length?pv+'':'';
  if(phase==='done'){
    var dv=handValue(dealer);
    $('dealerTotal').textContent=dealer.length?dv+'':'';
  }else{
    $('dealerTotal').textContent=dealer.length>1?'? + '+VALUES[dealer[0].rank]:dealer.length?VALUES[dealer[0].rank]+'':'';
  }
  $('betDisplay').textContent='BET: '+bet;
  $('balance').textContent='💰 '+balance;
  $('stats').textContent='W:'+wins+' L:'+losses;
}

function renderBets(){
  var b=$('betArea');
  if(phase!=='betting'){b.innerHTML='';return}
  b.innerHTML='<div class="chip c10" onclick="window._bjBet(10)">10</div><div class="chip c25" onclick="window._bjBet(25)">25</div><div class="chip c50" onclick="window._bjBet(50)">50</div><div class="chip c100" onclick="window._bjBet(100)">100</div><div class="chip" style="background:radial-gradient(#6b7280,#374151);border-color:#9ca3af;width:50px" onclick="window._bjDeal()">DEAL</div>';
}

function renderControls(){
  var c=$('controls');
  if(phase==='playing'){
    var pv=handValue(player);
    c.innerHTML='<button class="btn hit" onclick="window._bjHit()">HIT</button><button class="btn stand" onclick="window._bjStand()">STAND</button>';
    if(player.length===2&&bet*2<=balance)c.innerHTML+='<button class="btn double" onclick="window._bjDouble()">DOUBLE</button>';
  }else if(phase==='done'){
    c.innerHTML='<button class="btn new" onclick="window._bjNew()">NEW HAND</button>';
  }else{c.innerHTML=''}
}

function sparks(win){
  var p=$('particles');p.innerHTML='';
  var cols=win?['#ffd700','#22c55e','#4ade80','#fbbf24']:['#ef4444','#f87171'];
  for(var i=0;i<(win?25:10);i++){
    var s=document.createElement('div');s.className='spark';
    s.style.cssText='left:'+(30+Math.random()*40)+'%;top:'+(30+Math.random()*40)+'%;background:'+cols[i%cols.length]+';--dx:'+(Math.random()-0.5)*150+'px;--dy:'+(Math.random()-0.5)*150+'px;animation-delay:'+Math.random()*0.2+'s';
    p.appendChild(s);
  }
}

function showResult(win,push){
  var r=$('result'),t=$('resultText'),s=$('resultSub');
  if(push){t.textContent='PUSH';t.style.color='#fbbf24';s.textContent='Bet returned';$('message').textContent='Push — bet returned'}
  else if(win){t.textContent='YOU WIN!';t.style.color='#22c55e';s.textContent='+'+bet+' credits';$('message').textContent='Blackjack!';sparks(true)}
  else{t.textContent='BUST!';t.style.color='#ef4444';s.textContent='-'+bet+' credits';$('message').textContent='Dealer wins';sparks(false)}
  r.classList.add('show');
}

function dealerPlay(){
  phase='done';
  (function reveal(){
    render();renderControls();
    if(handValue(dealer)<17){
      setTimeout(function(){dealer.push(deck.pop());reveal()},500);
    }else{
      var dv=handValue(dealer),pv=handValue(player);
      var push=(dv===pv);
      var win=(dv>21)||(pv<=21&&pv>dv)||(player.length===2&&pv===21);
      if(player.length===2&&pv===21&&!(dealer.length===2&&dv===21))win=true;
      if(dealer.length===2&&dv===21&&!(player.length===2&&pv===21))win=false;
      if(push)win=false;
      if(win){balance+=bet;wins++}else if(!push){balance-=bet;losses++}
      render();showResult(win,push);
    }
  })();
}

window._bjBet=function(amt){
  if(phase!=='betting')return;
  if(balance>=amt){bet+=amt;balance-=amt;render();renderBets()}
};

window._bjDeal=function(){
  if(phase!=='betting'||bet<10)return;
  phase='playing';shuffle();
  player=[deck.pop(),deck.pop()];dealer=[deck.pop(),deck.pop()];
  $('message').textContent='Hit or Stand?';
  render();renderBets();renderControls();
  if(handValue(player)===21){setTimeout(dealerPlay,400)}
};

window._bjHit=function(){
  if(phase!=='playing')return;
  player.push(deck.pop());render();renderControls();
  if(handValue(player)>21){phase='done';balance-=bet;losses++;$('message').textContent='BUST!';render();showResult(false,false)}
};

window._bjStand=function(){
  if(phase!=='playing')return;dealerPlay();
};

window._bjDouble=function(){
  if(phase!=='playing'||player.length!==2)return;
  balance-=bet;bet*=2;player.push(deck.pop());render();
  if(handValue(player)>21){phase='done';losses++;$('message').textContent='BUST!';render();showResult(false,false)}
  else{dealerPlay()}
};

window._bjNew=function(){
  $('result').classList.remove('show');
  $('particles').innerHTML='';
  if(balance<10){balance=1000;$('message').textContent='Reset to 1000 credits!'}
  bet=0;phase='betting';player=[];dealer=[];
  $('message').textContent='Place your bets!';
  render();renderBets();renderControls();
};

shuffle();render();renderBets();renderControls();
</script></body></html>`;

module.exports = {
    name: 'blackjack',
    alias: ['bj', '21'],
    desc: 'Play a full interactive blackjack game rendered inside WhatsApp!',
    category: 'Games',
    usage: '.blackjack',
    execute: async (sock, m, { reply }) => {
        if (typeof sock.sendHtmlMessage === 'function') {
            return sock.sendHtmlMessage(m.chat, { html: BLACKJACK_HTML }, { quoted: m });
        }
        return reply('Blackjack requires @crysnovax/baileys with HTML support. Update the package.');
    }
};
