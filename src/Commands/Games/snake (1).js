const { sendHtmlPrimitive } = require('./sendHtmlPrimitive');

function snakeHtml() {
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0;background:transparent;font-family:Arial,sans-serif;overscroll-behavior:none;touch-action:none}
body{padding:6px;background:radial-gradient(circle at 50% 4%,#075985,#061323 74%)}
.card{padding:12px;border:2px solid #38bdf8;border-radius:20px;background:linear-gradient(145deg,#06192d,#0b3551 54%,#061321);color:#dff6ff;box-shadow:inset 0 0 0 3px #0b4262,0 8px 20px #000b}
.title{text-align:center;color:#b9efff;font:bold 23px Arial Black,Arial,sans-serif;letter-spacing:1px;text-shadow:0 0 12px #18bfff;animation:pulseGlow 2s ease-in-out infinite}
@keyframes pulseGlow{0%,100%{text-shadow:0 0 12px #18bfff}50%{text-shadow:0 0 25px #18bfff,0 0 50px #18bfff55}}
.sub{text-align:center;margin:2px 0 8px;color:#7fc2df;font:10px monospace}
.boardWrap{position:relative}
.topBar{display:flex;justify-content:space-between;padding:4px 0 8px;font:bold 12px monospace;color:#a8d8ea}
.topBar select{padding:2px 6px;border-radius:6px;background:#0a2a3a;color:#a8d8ea;border:1px solid #2a6a8a}
.score{position:absolute;z-index:2;top:7px;left:0;right:0;text-align:center;color:#d4ffd7;font:bold 13px monospace;text-shadow:0 0 8px #39ff6d;animation:pulseScore 1.5s ease-in-out infinite}
@keyframes pulseScore{0%,100%{text-shadow:0 0 8px #39ff6d}50%{text-shadow:0 0 20px #39ff6d,0 0 40px #39ff6d33}}
.board{display:grid;grid-template-columns:repeat(20,1fr);gap:1px;padding:7px;border:2px solid #24874c;border-radius:13px;background:#000;box-shadow:inset 0 0 24px #001b09;position:relative;transition:all .5s}
.cell{aspect-ratio:1;background:#020d07;box-shadow:inset 0 0 0 1px #0b3019;transition:all .15s}
/* Environment: Grass (default) */
.env-grass .cell{background:#0a1a0a;box-shadow:inset 0 0 0 1px #1a3a1a}
.env-grass .cell.snake{background:linear-gradient(135deg,#66ff44,#33aa22);box-shadow:0 0 8px #55ff38,inset 0 0 10px #88ff66}
.env-grass .cell.head{background:linear-gradient(135deg,#88ff66,#44cc33);box-shadow:0 0 15px #66ff44,inset 0 0 15px #aaff88}
/* Environment: Rocky */
.env-rocky .cell{background:#1a1a0a;box-shadow:inset 0 0 0 1px #3a3a1a}
.env-rocky .cell.snake{background:linear-gradient(135deg,#cc8844,#886633);box-shadow:0 0 8px #bb7733,inset 0 0 10px #ddaa66}
.env-rocky .cell.head{background:linear-gradient(135deg,#ddaa66,#996633);box-shadow:0 0 15px #cc8833,inset 0 0 15px #eebb77}
.env-rocky .cell.obstacle{background:#6a4a2a;box-shadow:inset 0 0 10px #8a6a4a,0 0 5px #4a2a1a;border-radius:3px}
/* Environment: Castle */
.env-castle .cell{background:#0a0a1a;box-shadow:inset 0 0 0 1px #1a1a3a}
.env-castle .cell.snake{background:linear-gradient(135deg,#8899ff,#4455cc);box-shadow:0 0 8px #6688ff,inset 0 0 10px #aabbff}
.env-castle .cell.head{background:linear-gradient(135deg,#aabbff,#5566dd);box-shadow:0 0 15px #8899ff,inset 0 0 15px #ccddff}
.env-castle .cell.obstacle{background:#4a3a6a;box-shadow:inset 0 0 10px #6a5a8a,0 0 5px #3a2a5a;border-radius:3px}
/* Environment: Desert */
.env-desert .cell{background:#1a1a0a;box-shadow:inset 0 0 0 1px #3a3a1a}
.env-desert .cell.snake{background:linear-gradient(135deg,#ddaa44,#bb8822);box-shadow:0 0 8px #cc9933,inset 0 0 10px #eebb66}
.env-desert .cell.head{background:linear-gradient(135deg,#eebb66,#cc8833);box-shadow:0 0 15px #ddaa44,inset 0 0 15px #ffcc88}
.env-desert .cell.obstacle{background:#6a5a3a;box-shadow:inset 0 0 10px #8a7a5a,0 0 5px #4a3a2a;border-radius:3px}
/* Environment: Ice */
.env-ice .cell{background:#0a1a1a;box-shadow:inset 0 0 0 1px #1a3a3a}
.env-ice .cell.snake{background:linear-gradient(135deg,#88ddff,#44aadd);box-shadow:0 0 8px #66ccff,inset 0 0 10px #aaefff}
.env-ice .cell.head{background:linear-gradient(135deg,#aaefff,#55bbdd);box-shadow:0 0 15px #88ddff,inset 0 0 15px #ccffff}
.env-ice .cell.obstacle{background:#3a6a7a;box-shadow:inset 0 0 10px #5a8a9a,0 0 5px #2a4a5a;border-radius:3px}
.cell.snake{transition:all .3s cubic-bezier(.34,1.56,.64,1);border-radius:40% 40% 30% 30%}
.cell.head{transition:all .3s cubic-bezier(.34,1.56,.64,1);border-radius:30% 30% 40% 40%;transform:scale(1.08)}
.cell.food{background:radial-gradient(circle,#ffdd44,#ff8800);box-shadow:0 0 15px #ff8800,0 0 30px #ff880044;animation:pulseFood 1s ease-in-out infinite;border-radius:50%}
@keyframes pulseFood{0%,100%{transform:scale(1);box-shadow:0 0 15px #ff8800,0 0 30px #ff880044}50%{transform:scale(1.15);box-shadow:0 0 25px #ff8800,0 0 50px #ff880066}}
.cell.obstacle{background:#4a2a1a;box-shadow:inset 0 0 10px #6a4a2a,0 0 5px #2a1a0a;border-radius:4px;transform:rotate(45deg)}
.cell.obstacle::after{content:'▲';color:#2a1a0a;font-size:10px;display:flex;justify-content:center;align-items:center;height:100%;opacity:.3}
.message{height:34px;margin:8px 0;display:grid;place-items:center;border:1px solid #2b8c54;border-radius:8px;background:#031008;color:#bcffc2;font:bold 12px monospace;transition:all .3s}
.controls{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-width:260px;margin:0 auto}
.controls button{height:42px;border:2px solid #238d50;border-radius:11px;color:#d8ffe0;background:linear-gradient(#155e35,#07341c);font-size:21px;font-weight:900;cursor:pointer;touch-action:manipulation;transition:all .1s;user-select:none}
.controls button:active{transform:scale(.88);background:#1b8345}
.up{grid-column:2}.left{grid-column:1;grid-row:2}.down{grid-column:2;grid-row:2}.right{grid-column:3;grid-row:2}
.bottomRow{display:flex;gap:8px;margin-top:8px;justify-content:center;flex-wrap:wrap}
.restart{flex:1;min-width:100px;height:39px;border:2px solid #238d50;border-radius:11px;color:#d8ffe0;background:linear-gradient(#196d3c,#0a3c22);font-weight:900;cursor:pointer;transition:all .2s}
.restart:active{transform:scale(.95)}
.levelSelect{padding:0 10px;height:39px;border:2px solid #238d50;border-radius:11px;background:#0a3c22;color:#d8ffe0;font-weight:900;cursor:pointer}
.hint{text-align:center;margin:7px 0 0;color:#7fc58d;font:10px monospace}
.levelBadge{display:inline-block;padding:2px 12px;border-radius:20px;background:#0a3c22;border:1px solid #2b8c54;font:bold 11px monospace;color:#7fc58d}
</style></head><body><div class="card">
<div class="title">🐍 SNAKE</div>
<div class="sub">USE THE CONTROLS OR SWIPE THE BOARD</div>
<div class="topBar">
  <span class="levelBadge" id="levelBadge">🌿 LEVEL 1</span>
  <select id="envSelect" style="background:#0a2a3a;color:#a8d8ea;border:1px solid #2a6a8a;border-radius:6px;padding:2px 8px;font:bold 11px monospace">
    <option value="grass">🌿 Grass</option>
    <option value="rocky">🪨 Rocky</option>
    <option value="castle">🏰 Castle</option>
    <option value="desert">🏜️ Desert</option>
    <option value="ice">❄️ Ice</option>
  </select>
</div>
<div class="boardWrap"><div class="score">SCORE: <span id="score">0</span></div>
<div class="board" id="board"></div></div>
<div class="message" id="message">Tap a control to start</div>
<div class="controls">
  <button class="up" id="up">▲</button>
  <button class="left" id="left">◀</button>
  <button class="down" id="down">▼</button>
  <button class="right" id="right">▶</button>
</div>
<div class="bottomRow">
  <button class="restart" id="restart">🔄 Restart</button>
  <select class="levelSelect" id="levelSelect">
    <option value="1">⭐ Level 1</option>
    <option value="2">⭐⭐ Level 2</option>
    <option value="3">⭐⭐⭐ Level 3</option>
    <option value="4">⭐⭐⭐⭐ Level 4</option>
    <option value="5">⭐⭐⭐⭐⭐ Level 5</option>
  </select>
</div>
<div class="hint">Eat the golden food · avoid obstacles · reach the next level!</div>
</div>
<script>
(function(){
const board=document.getElementById('board');
const message=document.getElementById('message');
const scoreEl=document.getElementById('score');
const levelBadge=document.getElementById('levelBadge');
const envSelect=document.getElementById('envSelect');
const levelSelect=document.getElementById('levelSelect');

let cells=[], snake=[], food=null, obstacles=[], dir={x:1,y:0}, next={x:1,y:0};
let timer=null, running=false, score=0, level=1, maxLevel=5;
let W=20, H=20, speed=380, baseSpeed=380;
let env='grass';

// Create board
for(let i=0;i<W*H;i++){let c=document.createElement('div');c.className='cell';board.appendChild(c);cells.push(c)}

function idx(x,y){return y*W+x}
function clearBoard(){cells.forEach(c=>c.className='cell')}
function setEnv(e){env=e;board.className='board env-'+e;}

function generateObstacles(count){
  obstacles=[];
  let attempts=0;
  while(obstacles.length<count && attempts<1000){
    attempts++;
    let x=Math.floor(Math.random()*W), y=Math.floor(Math.random()*H);
    if(!snake.some(s=>s.x===x&&s.y===y) && 
       !(food && food.x===x && food.y===y) &&
       !obstacles.some(o=>o.x===x&&o.y===y) &&
       !(x>=W/2-1 && x<=W/2+1 && y>=H/2-1 && y<=H/2+1)){
      obstacles.push({x,y});
    }
  }
}

function placeFood(){
  let open=[];
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)
    if(!snake.some(s=>s.x===x&&s.y===y) && 
       !obstacles.some(o=>o.x===x&&o.y===y))
      open.push({x,y});
  food=open.length?open[Math.floor(Math.random()*open.length)]:null;
}

function draw(){
  clearBoard();
  snake.forEach((s,i)=>{
    let cls='cell snake';
    if(i===0) cls+=' head';
    cells[idx(s.x,s.y)].className=cls;
  });
  if(food) cells[idx(food.x,food.y)].className='cell food';
  obstacles.forEach(o=>cells[idx(o.x,o.y)].className='cell obstacle');
  scoreEl.textContent=score;
}

function resetIdle(){
  running=false;clearInterval(timer);timer=null;
  snake=[];food=null;obstacles=[];score=0;
  dir={x:1,y:0};next={x:1,y:0};
  scoreEl.textContent='0';
  clearBoard();
  message.textContent='Tap a control to start';
  levelBadge.textContent='🌿 LEVEL 1';
  board.className='board env-'+env;
}

function end(){
  running=false;clearInterval(timer);timer=null;
  message.textContent='💀 Game over — score '+score+' · tap Restart';
  draw();
}

function checkLevelUp(){
  let target=level*10;
  if(score>=target && level<maxLevel){
    level++;
    speed=Math.max(150,baseSpeed - (level-1)*40);
    levelBadge.textContent='⭐'.repeat(level)+' LEVEL '+level;
    message.textContent='🎉 LEVEL UP! Level '+level+' — Speed: '+(baseSpeed-speed)+'ms faster';
    clearInterval(timer);
    // Add more obstacles for next level
    let obstacleCount = 5 + (level-1)*3;
    generateObstacles(obstacleCount);
    placeFood();
    draw();
    timer=setInterval(step,speed);
  }
}

function step(){
  if(!running)return;
  dir=next;
  let head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  
  // Wall collision
  if(head.x<0||head.x>=W||head.y<0||head.y>=H) return end();
  
  // Obstacle collision
  if(obstacles.some(o=>o.x===head.x&&o.y===head.y)) return end();
  
  // Self collision
  if(snake.some(s=>s.x===head.x&&s.y===head.y)) return end();
  
  snake.unshift(head);
  let ate=false;
  if(food&&head.x===food.x&&head.y===food.y){
    score+=10;
    message.textContent='🍽️ +10 points!';
    ate=true;
    placeFood();
    checkLevelUp();
  } else {
    snake.pop();
  }
  draw();
}

function start(x,y){
  clearInterval(timer);
  let cx=Math.floor(W/2), cy=Math.floor(H/2);
  dir={x,y}; next={x,y};
  snake=[{x:cx,y:cy},{x:cx-x,y:cy-y},{x:cx-2*x,y:cy-2*y}];
  score=0; running=true; level=1;
  speed=baseSpeed;
  levelBadge.textContent='🌿 LEVEL 1';
  document.getElementById('levelSelect').value='1';
  
  // Generate initial obstacles
  generateObstacles(5);
  placeFood();
  message.textContent='🐍 Running — eat the golden food!';
  draw();
  timer=setInterval(step,speed);
}

function turn(x,y){
  if(!running) return start(x,y);
  if(x!==-dir.x||y!==-dir.y) next={x,y};
}

// Controls
document.getElementById('up').onclick=()=>turn(0,-1);
document.getElementById('down').onclick=()=>turn(0,1);
document.getElementById('left').onclick=()=>turn(-1,0);
document.getElementById('right').onclick=()=>turn(1,0);
document.getElementById('restart').onclick=()=>{resetIdle();start(1,0);};

// Level select
document.getElementById('levelSelect').onchange=function(){
  level=parseInt(this.value);
  speed=Math.max(150,baseSpeed - (level-1)*40);
  levelBadge.textContent='⭐'.repeat(level)+' LEVEL '+level;
  if(running){
    clearInterval(timer);
    let obstacleCount = 5 + (level-1)*3;
    generateObstacles(obstacleCount);
    placeFood();
    draw();
    timer=setInterval(step,speed);
    message.textContent='⚡ Level changed to '+level;
  }
};

// Environment select
envSelect.onchange=function(){
  env=this.value;
  board.className='board env-'+env;
  message.textContent='🌍 Environment: '+env;
};

// Keyboard
document.addEventListener('keydown',function(e){
  if(e.key==='ArrowUp'){e.preventDefault();turn(0,-1);}
  if(e.key==='ArrowDown'){e.preventDefault();turn(0,1);}
  if(e.key==='ArrowLeft'){e.preventDefault();turn(-1,0);}
  if(e.key==='ArrowRight'){e.preventDefault();turn(1,0);}
});

// Swipe
let tx=0,ty=0;
board.addEventListener('touchstart',e=>{let t=e.changedTouches[0];tx=t.clientX;ty=t.clientY},{passive:true});
board.addEventListener('touchend',e=>{
  let t=e.changedTouches[0],dx=t.clientX-tx,dy=t.clientY-ty;
  if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
  if(Math.abs(dx)>Math.abs(dy)) turn(dx>0?1:-1,0);
  else turn(0,dy>0?1:-1);
},{passive:true});

resetIdle();
})();
</script></body></html>`;
}

module.exports = {
    name: 'snake',
    alias: ['bluesnake', 'snakegame'],
    desc: '🐍 Interactive Snake with 5 environments, levels & obstacles!',
    category: 'Games',
    usage: '.snake',
    execute: async (sock, m, { reply }) => {
        try {
            await sendHtmlPrimitive(sock, m.chat, snakeHtml());
        } catch (error) {
            console.error('[SNAKE ERROR]', error.message);
            return reply('🐍 Could not start Snake. Please try again.');
        }
    }
};