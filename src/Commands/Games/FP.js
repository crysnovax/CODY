// File: src/Commands/Games/flappy2.js

module.exports = {
    name: 'flappy2',
    alias: ['flappybirdv2', 'flappynew'],
    desc: 'Classic tap-to-fly arcade Flappy Bird with high score, sound effects, and obstacles',
    category: 'Games',
    usage: `${prefix}flappy2`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🐦', key: m.key } });

        await sock.sendHtmlMessage(m.chat, { html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"
>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
  -webkit-user-select: none;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
}

html,
body {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}

body {
  padding: 6px;
  display: flex;
  justify-content: center;
  align-items: stretch;
  background:
    radial-gradient(
      circle at 50% 12%,
      #1e3a5f,
      #0b1523 60%,
      #03070d
    );
}

/*
  IMPORTANT FOR WHATSAPP / WEBVIEW:
  The complete game is now allowed to shrink vertically.
*/
.arcade-box {
  position: relative;

  width: 100%;
  max-width: 420px;

  height: 100%;
  max-height: 100%;

  min-height: 0;

  padding: 9px;

  border: 3px solid #0f2742;
  border-radius: 18px;

  background:
    linear-gradient(
      135deg,
      #071729,
      #143d63 20%,
      #0a243c 55%,
      #184a78 85%,
      #051321
    );

  box-shadow:
    inset 0 0 0 2px #ffd23f,
    inset 0 0 0 5px #0a2338,
    inset 0 15px 30px rgba(78, 205, 196, 0.2),
    0 8px 24px rgba(0, 0, 0, 0.8);

  overflow: hidden;

  display: flex;
  flex-direction: column;
}

.arcade-box::before {
  content: "";
  position: absolute;
  inset: 4px;
  border: 2px solid rgba(255, 210, 63, 0.6);
  border-radius: 14px;
  pointer-events: none;
  z-index: 20;
}

.header {
  flex: 0 0 auto;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 6px;
  margin-bottom: 7px;

  min-height: 27px;
}

.title-badge {
  background: linear-gradient(90deg, #ffd23f, #ff9f1c);
  color: #0b1523;

  font-size: 13px;
  font-weight: 900;

  letter-spacing: 0.7px;

  padding: 4px 8px;
  border-radius: 7px;

  white-space: nowrap;

  text-shadow: 0 1px 0 rgba(255,255,255,0.4);

  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}

.stats-bar {
  display: flex;
  gap: 5px;

  flex-shrink: 0;
}

.stat-pill {
  background: rgba(0, 0, 0, 0.5);

  border: 1px solid rgba(255, 210, 63, 0.4);
  border-radius: 7px;

  padding: 3px 6px;

  font-size: 10px;
  font-weight: 800;

  color: #ffd23f;

  display: flex;
  align-items: center;
  gap: 3px;

  white-space: nowrap;
}

/*
  THE GAME AREA IS FLEXIBLE.
  It takes whatever vertical space remains.
*/
.screen-frame {
  position: relative;

  width: 100%;

  flex: 1 1 auto;
  min-height: 120px;

  border-radius: 11px;
  border: 3px solid #06111c;

  overflow: hidden;

  box-shadow:
    inset 0 0 12px rgba(0,0,0,0.8),
    0 4px 10px rgba(0,0,0,0.5);

  background: #4ec0ca;

  cursor: pointer;

  touch-action: none;
  -webkit-touch-callout: none;
}

#gameCanvas {
  display: block;

  width: 100%;
  height: 100%;

  touch-action: none;
}

/* =========================
   OVERLAYS
========================= */

.overlay {
  position: absolute;
  inset: 0;

  background: rgba(0, 0, 0, 0.65);

  display: flex;
  flex-direction: column;

  align-items: center;
  justify-content: center;

  gap: 7px;

  color: #fff;

  z-index: 10;

  padding: 10px;

  text-align: center;
}

.overlay.hidden {
  display: none;
}

.overlay h2 {
  font-size: clamp(20px, 7vw, 26px);

  font-weight: 900;

  color: #ffd23f;

  text-shadow: 0 2px 8px rgba(0,0,0,0.8);

  letter-spacing: 1px;
}

.overlay-score-box {
  background: rgba(11, 21, 35, 0.85);

  border: 2px solid #ffd23f;

  border-radius: 10px;

  padding: 8px 18px;

  text-align: center;

  min-width: 145px;

  box-shadow: 0 4px 15px rgba(0,0,0,0.6);
}

.overlay-score-label {
  font-size: 10px;

  color: #94a3b8;

  font-weight: 700;
}

.overlay-score-val {
  font-size: 21px;

  font-weight: 900;

  color: #fff;
}

.medal-icon {
  font-size: 26px;

  margin-top: 3px;
}

/* =========================
   CONTROLS
========================= */

.controls-area {
  flex: 0 0 auto;

  margin-top: 7px;

  display: flex;

  gap: 7px;

  min-height: 46px;
}

.flap-btn {
  flex: 1;

  min-width: 0;

  height: 46px;

  background:
    linear-gradient(
      180deg,
      #ffd23f,
      #ff9f1c
    );

  border: 2px solid #fff;

  border-radius: 12px;

  color: #0b1523;

  font-size: 16px;

  font-weight: 900;

  letter-spacing: 1px;

  box-shadow:
    0 3px 0 #c77700,
    0 5px 12px rgba(255, 159, 28, 0.5);

  cursor: pointer;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 5px;

  transition:
    transform 0.08s,
    box-shadow 0.08s;

  touch-action: manipulation;

  -webkit-appearance: none;
  appearance: none;
}

.flap-btn:active {
  transform: translateY(2px);

  box-shadow:
    0 1px 0 #c77700,
    0 2px 8px rgba(255, 159, 28, 0.4);
}

.sound-toggle {
  width: 46px;
  height: 46px;

  flex: 0 0 46px;

  background: rgba(255, 255, 255, 0.1);

  border: 1px solid rgba(255, 255, 255, 0.2);

  border-radius: 12px;

  color: #fff;

  font-size: 17px;

  display: flex;
  align-items: center;
  justify-content: center;

  cursor: pointer;

  touch-action: manipulation;

  -webkit-appearance: none;
  appearance: none;
}

/* Small-height phones / WebViews */
@media (max-height: 430px) {

  body {
    padding: 3px;
  }

  .arcade-box {
    padding: 6px;
    border-radius: 14px;
  }

  .header {
    margin-bottom: 4px;
    min-height: 23px;
  }

  .title-badge {
    font-size: 11px;
    padding: 3px 6px;
  }

  .stat-pill {
    font-size: 9px;
    padding: 2px 5px;
  }

  .controls-area {
    margin-top: 4px;
    min-height: 39px;
  }

  .flap-btn,
  .sound-toggle {
    height: 39px;
  }

  .sound-toggle {
    width: 39px;
    flex-basis: 39px;
  }
}

@media (max-width: 320px) {

  .title-badge {
    font-size: 10px;
  }

  .stat-pill {
    font-size: 8px;
  }

  .flap-btn {
    font-size: 14px;
  }
}

@keyframes bounce {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(-10px);
  }
}
</style>
</head>

<body>

<div class="arcade-box">

  <div class="header">

    <div class="title-badge">
      🐥 FLAPPY BIRD
    </div>

    <div class="stats-bar">

      <div class="stat-pill">
        ⭐ <span id="scoreText">0</span>
      </div>

      <div class="stat-pill">
        🏆 <span id="bestText">0</span>
      </div>

    </div>

  </div>

  <div
    class="screen-frame"
    id="screenFrame"
  >

    <canvas id="gameCanvas"></canvas>

    <!-- START -->

    <div
      id="startOverlay"
      class="overlay"
    >

      <h2>READY?</h2>

      <div
        style="
          font-size:12px;
          color:#cbd5e1;
          font-weight:700;
        "
      >
        TAP SCREEN OR BUTTON TO FLY
      </div>

      <div
        style="
          font-size:30px;
          animation:bounce 0.8s infinite alternate;
        "
      >
        🐥
      </div>

    </div>

    <!-- GAME OVER -->

    <div
      id="overOverlay"
      class="overlay hidden"
    >

      <h2>GAME OVER</h2>

      <div class="overlay-score-box">

        <div class="overlay-score-label">
          SCORE
        </div>

        <div
          class="overlay-score-val"
          id="finalScore"
        >
          0
        </div>

        <div
          class="overlay-score-label"
          style="margin-top:5px"
        >
          BEST
        </div>

        <div
          class="overlay-score-val"
          id="finalBest"
          style="color:#ffd23f"
        >
          0
        </div>

        <div
          class="medal-icon"
          id="medalIcon"
        >
          🥉
        </div>

      </div>

      <div
        style="
          font-size:11px;
          color:#94a3b8;
          margin-top:3px;
        "
      >
        Tap Flap or Screen to Restart
      </div>

    </div>

  </div>

  <div class="controls-area">

    <button
      id="btnFlap"
      class="flap-btn"
      type="button"
    >
      <span>FLAP</span>
      <span>🐥</span>
    </button>

    <button
      id="btnSound"
      class="sound-toggle"
      type="button"
    >
      🔊
    </button>

  </div>

</div>

<script>
(() => {

  "use strict";

  const canvas =
    document.getElementById("gameCanvas");

  const ctx =
    canvas.getContext("2d", {
      alpha: false
    });

  const frame =
    document.getElementById("screenFrame");

  const scoreEl =
    document.getElementById("scoreText");

  const bestEl =
    document.getElementById("bestText");

  const startOverlay =
    document.getElementById("startOverlay");

  const overOverlay =
    document.getElementById("overOverlay");

  const finalScoreEl =
    document.getElementById("finalScore");

  const finalBestEl =
    document.getElementById("finalBest");

  const medalIconEl =
    document.getElementById("medalIcon");

  const btnFlap =
    document.getElementById("btnFlap");

  const btnSound =
    document.getElementById("btnSound");


  /* =========================
     GAME STATE
  ========================= */

  let W = 320;
  let H = 220;

  let gameState = "READY";

  let soundEnabled = true;

  let audioCtx = null;

  let highScore = 0;

  try {

    highScore =
      Number(
        localStorage.getItem("flappy_best")
      ) || 0;

  } catch (e) {}

  bestEl.textContent = highScore;


  /* =========================
     AUDIO
  ========================= */

  function initAudio() {

    try {

      if (!audioCtx) {

        const AudioContext =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioContext) {
          return;
        }

        audioCtx =
          new AudioContext();
      }

      if (
        audioCtx.state === "suspended"
      ) {

        audioCtx.resume().catch(() => {});

      }

    } catch (e) {}

  }


  function playSound(type) {

    if (!soundEnabled || !audioCtx) {
      return;
    }

    try {

      const t =
        audioCtx.currentTime;

      const osc =
        audioCtx.createOscillator();

      const gain =
        audioCtx.createGain();


      if (type === "flap") {

        osc.type = "sine";

        osc.frequency.setValueAtTime(
          400,
          t
        );

        osc.frequency.exponentialRampToValueAtTime(
          800,
          t + 0.1
        );

        gain.gain.setValueAtTime(
          0.25,
          t
        );

        gain.gain.exponentialRampToValueAtTime(
          0.01,
          t + 0.1
        );

        osc.connect(gain);
        gain.connect(
          audioCtx.destination
        );

        osc.start(t);
        osc.stop(t + 0.11);

      }


      else if (type === "score") {

        osc.type = "triangle";

        osc.frequency.setValueAtTime(
          587.33,
          t
        );

        osc.frequency.setValueAtTime(
          880,
          t + 0.08
        );

        gain.gain.setValueAtTime(
          0.25,
          t
        );

        gain.gain.exponentialRampToValueAtTime(
          0.01,
          t + 0.25
        );

        osc.connect(gain);
        gain.connect(
          audioCtx.destination
        );

        osc.start(t);
        osc.stop(t + 0.26);

      }


      else if (type === "hit") {

        osc.type = "sawtooth";

        osc.frequency.setValueAtTime(
          250,
          t
        );

        osc.frequency.exponentialRampToValueAtTime(
          50,
          t + 0.2
        );

        gain.gain.setValueAtTime(
          0.35,
          t
        );

        gain.gain.exponentialRampToValueAtTime(
          0.01,
          t + 0.25
        );

        osc.connect(gain);
        gain.connect(
          audioCtx.destination
        );

        osc.start(t);
        osc.stop(t + 0.26);

      }

    } catch (e) {}

  }


  btnSound.addEventListener(
    "pointerdown",
    (e) => {

      e.preventDefault();
      e.stopPropagation();

      soundEnabled =
        !soundEnabled;

      btnSound.textContent =
        soundEnabled
          ? "🔊"
          : "🔇";

      if (soundEnabled) {
        initAudio();
      }

    },
    { passive: false }
  );


  /* =========================
     GAME OBJECTS
  ========================= */

  const bird = {

    x: 60,
    y: 100,

    vy: 0,

    radius: 12,

    rotation: 0

  };


  let pipes = [];

  let particles = [];

  let score = 0;

  let groundOffset = 0;


  const clouds = [

    {
      x: 30,
      y: 30,
      s: 0.8
    },

    {
      x: 160,
      y: 50,
      s: 1.2
    },

    {
      x: 280,
      y: 25,
      s: 0.9
    }

  ];


  /* =========================
     RESPONSIVE CANVAS
  ========================= */

  function resize() {

    const rect =
      frame.getBoundingClientRect();

    W =
      Math.max(
        160,
        Math.floor(rect.width)
      );

    H =
      Math.max(
        120,
        Math.floor(rect.height)
      );


    const dpr =
      Math.min(
        window.devicePixelRatio || 1,
        2
      );


    canvas.width =
      Math.floor(W * dpr);

    canvas.height =
      Math.floor(H * dpr);


    canvas.style.width =
      W + "px";

    canvas.style.height =
      H + "px";


    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );


    if (gameState === "READY") {

      bird.x = W * 0.25;

      bird.y =
        H * 0.45;

    }

  }


  /* =========================
     RESET
  ========================= */

  function resetGame() {

    bird.x =
      W * 0.25;

    bird.y =
      H * 0.45;

    bird.vy = 0;

    bird.rotation = 0;

    pipes = [];

    particles = [];

    score = 0;

    scoreEl.textContent = "0";

  }


  /* =========================
     PIPE GENERATION
  ========================= */

  function spawnPipe() {

    /*
      Gap scales slightly with screen size.
      This prevents impossible pipes on small WebViews.
    */

    const gap =
      Math.max(
        70,
        Math.min(
          100,
          H * 0.34
        )
      );


    const safeTop = 24;

    const safeBottom = 30;

    const available =
      H -
      24 -
      safeTop -
      safeBottom -
      gap;


    const topHeight =
      safeTop +
      Math.max(
        0,
        Math.random() *
        Math.max(
          1,
          available
        )
      );


    pipes.push({

      x: W + 20,

      width:
        Math.max(
          38,
          Math.min(
            48,
            W * 0.13
          )
        ),

      topHeight,

      bottomY:
        topHeight + gap,

      passed: false

    });

  }


  /* =========================
     FLAP
  ========================= */

  function handleFlap() {

    initAudio();


    if (gameState === "READY") {

      gameState =
        "PLAYING";

      startOverlay
        .classList
        .add("hidden");

      overOverlay
        .classList
        .add("hidden");


      bird.vy = -5.4;

      playSound("flap");

      return;
    }


    if (gameState === "PLAYING") {

      bird.vy = -5.4;

      playSound("flap");

      return;
    }


    if (gameState === "OVER") {

      resetGame();

      gameState =
        "PLAYING";

      startOverlay
        .classList
        .add("hidden");

      overOverlay
        .classList
        .add("hidden");

      bird.vy = -5.4;

      playSound("flap");

    }

  }


  /* =========================
     GAME OVER
  ========================= */

  function triggerGameOver() {

    if (
      gameState === "OVER"
    ) {
      return;
    }


    gameState =
      "OVER";


    playSound("hit");


    for (
      let i = 0;
      i < 20;
      i++
    ) {

      particles.push({

        x: bird.x,

        y: bird.y,

        vx:
          (Math.random() - 0.5) * 8,

        vy:
          (Math.random() - 0.5) * 8,

        color:
          [
            "#ffd23f",
            "#ff9f1c",
            "#ffffff",
            "#e71d36"
          ][
            Math.floor(
              Math.random() * 4
            )
          ],

        size:
          3 +
          Math.random() * 4,

        life: 1

      });

    }


    if (score > highScore) {

      highScore = score;

      bestEl.textContent =
        highScore;

      try {

        localStorage.setItem(
          "flappy_best",
          String(highScore)
        );

      } catch (e) {}

    }


    finalScoreEl.textContent =
      score;

    finalBestEl.textContent =
      highScore;


    if (score >= 30) {

      medalIconEl.textContent =
        "👑";

    }

    else if (score >= 20) {

      medalIconEl.textContent =
        "🥇";

    }

    else if (score >= 10) {

      medalIconEl.textContent =
        "🥈";

    }

    else {

      medalIconEl.textContent =
        "🥉";

    }


    setTimeout(() => {

      if (
        gameState === "OVER"
      ) {

        overOverlay
          .classList
          .remove("hidden");

      }

    }, 350);

  }


  /* =========================
     INPUT
  ========================= */

  function inputHandler(e) {

    e.preventDefault();

    handleFlap();

  }


  btnFlap.addEventListener(
    "pointerdown",
    inputHandler,
    { passive: false }
  );


  frame.addEventListener(
    "pointerdown",
    inputHandler,
    { passive: false }
  );


  window.addEventListener(
    "keydown",
    (e) => {

      if (
        e.code === "Space" ||
        e.code === "ArrowUp"
      ) {

        e.preventDefault();

        handleFlap();

      }

    }
  );


  /* =========================
     GAME UPDATE
  ========================= */

  function update(dt) {

    /*
      Clamp delta time to prevent huge
      physics jumps when WebView pauses.
    */

    dt =
      Math.min(
        Math.max(dt, 0),
        2
      );


    /* Clouds */

    for (const c of clouds) {

      c.x -=
        0.3 * dt;

      if (
        c.x < -60
      ) {

        c.x =
          W + 40;

      }

    }


    /* READY */

    if (
      gameState === "READY"
    ) {

      bird.y =
        H * 0.45 +
        Math.sin(
          performance.now() / 250
        ) * 8;

      bird.rotation = 0;

      groundOffset =
        (
          groundOffset +
          2 * dt
        ) % 18;

      return;

    }


    /* PLAYING */

    if (
      gameState === "PLAYING"
    ) {

      /*
        Physics
      */

      bird.vy +=
        0.28 * dt;

      bird.y +=
        bird.vy * dt;


      /*
        Rotation
      */

      if (
        bird.vy < 0
      ) {

        bird.rotation =
          Math.max(
            -0.45,
            bird.rotation -
            0.1 * dt
          );

      }

      else {

        bird.rotation =
          Math.min(
            1.2,
            bird.rotation +
            0.06 * dt
          );

      }


      /* Ground */

      groundOffset =
        (
          groundOffset +
          2.2 * dt
        ) % 18;


      /* Pipes */

      for (
        let i = pipes.length - 1;
        i >= 0;
        i--
      ) {

        const p =
          pipes[i];


        p.x -=
          2.2 * dt;


        /*
          SCORE
        */

        if (
          !p.passed &&
          p.x + p.width <
          bird.x
        ) {

          p.passed = true;

          score++;

          scoreEl.textContent =
            score;

          playSound("score");

        }


        /*
          COLLISION
        */

        const bx =
          bird.x;

        const by =
          bird.y;

        const br =
          bird.radius - 2;


        const inPipeX =
          bx + br > p.x &&
          bx - br <
          p.x + p.width;


        if (inPipeX) {

          const hitTop =
            by - br <
            p.topHeight;


          const hitBottom =
            by + br >
            p.bottomY;


          if (
            hitTop ||
            hitBottom
          ) {

            triggerGameOver();

          }

        }

      }


      /* Remove offscreen pipes */

      pipes =
        pipes.filter(
          (p) => p.x + p.width > -10
        );


      /* Ground / ceiling collision */

      if (
        bird.y + bird.radius >
        H - 22
      ) {

        bird.y =
          H - 22 - bird.radius;

        triggerGameOver();

      }

      if (
        bird.y - bird.radius < 0
      ) {

        bird.y =
          bird.radius;

        bird.vy = 0;

      }

    }


    /* OVER */

    if (
      gameState === "OVER"
    ) {

      bird.vy +=
        0.28 * dt;

      bird.y +=
        bird.vy * dt;

      bird.rotation =
        Math.min(
          1.4,
          bird.rotation +
          0.08 * dt
        );

      if (
        bird.y + bird.radius >
        H - 22
      ) {

        bird.y =
          H - 22 - bird.radius;

        bird.vy = 0;

      }

    }


    /* Particles */

    for (
      let i = particles.length - 1;
      i >= 0;
      i--
    ) {

      const pt =
        particles[i];

      pt.x += pt.vx * dt;

      pt.y += pt.vy * dt;

      pt.vy += 0.2 * dt;

      pt.life -= 0.04 * dt;

      if (pt.life <= 0) {

        particles.splice(i, 1);

      }

    }

  }


  /* =========================
     DRAW
  ========================= */

  function drawCloud(c) {

    const s = c.s;

    ctx.save();

    ctx.globalAlpha = 0.85;

    ctx.fillStyle = "#ffffff";

    ctx.beginPath();

    ctx.arc(c.x, c.y, 14 * s, 0, Math.PI * 2);

    ctx.arc(c.x + 16 * s, c.y + 4 * s, 11 * s, 0, Math.PI * 2);

    ctx.arc(c.x - 14 * s, c.y + 4 * s, 10 * s, 0, Math.PI * 2);

    ctx.fill();

    ctx.restore();

  }


  function drawPipe(p) {

    ctx.fillStyle = "#5ec95e";

    ctx.strokeStyle = "#2e7d32";

    ctx.lineWidth = 3;


    /* Top pipe */

    ctx.fillRect(p.x, 0, p.width, p.topHeight);

    ctx.strokeRect(p.x, 0, p.width, p.topHeight);

    ctx.fillRect(
      p.x - 4,
      p.topHeight - 16,
      p.width + 8,
      16
    );

    ctx.strokeRect(
      p.x - 4,
      p.topHeight - 16,
      p.width + 8,
      16
    );


    /* Bottom pipe */

    ctx.fillRect(
      p.x,
      p.bottomY,
      p.width,
      H - 22 - p.bottomY
    );

    ctx.strokeRect(
      p.x,
      p.bottomY,
      p.width,
      H - 22 - p.bottomY
    );

    ctx.fillRect(
      p.x - 4,
      p.bottomY,
      p.width + 8,
      16
    );

    ctx.strokeRect(
      p.x - 4,
      p.bottomY,
      p.width + 8,
      16
    );

  }


  function drawBird() {

    ctx.save();

    ctx.translate(bird.x, bird.y);

    ctx.rotate(bird.rotation);


    ctx.fillStyle = "#ffd23f";

    ctx.strokeStyle = "#c77700";

    ctx.lineWidth = 2;

    ctx.beginPath();

    ctx.arc(0, 0, bird.radius, 0, Math.PI * 2);

    ctx.fill();

    ctx.stroke();


    /* Wing */

    ctx.fillStyle = "#ff9f1c";

    ctx.beginPath();

    ctx.ellipse(-3, 3, 7, 4, 0.3, 0, Math.PI * 2);

    ctx.fill();


    /* Eye */

    ctx.fillStyle = "#0b1523";

    ctx.beginPath();

    ctx.arc(5, -4, 2, 0, Math.PI * 2);

    ctx.fill();


    /* Beak */

    ctx.fillStyle = "#ff6b35";

    ctx.beginPath();

    ctx.moveTo(bird.radius - 2, -2);

    ctx.lineTo(bird.radius + 7, 0);

    ctx.lineTo(bird.radius - 2, 4);

    ctx.closePath();

    ctx.fill();


    ctx.restore();

  }


  function draw() {

    /* Sky */

    ctx.fillStyle = "#4ec0ca";

    ctx.fillRect(0, 0, W, H);


    /* Clouds */

    for (const c of clouds) {

      drawCloud(c);

    }


    /* Pipes */

    for (const p of pipes) {

      drawPipe(p);

    }


    /* Ground */

    ctx.fillStyle = "#ded895";

    ctx.fillRect(0, H - 22, W, 22);

    ctx.fillStyle = "#c2b464";

    for (
      let x = -groundOffset;
      x < W;
      x += 18
    ) {

      ctx.fillRect(x, H - 22, 9, 22);

    }


    /* Bird */

    drawBird();


    /* Particles */

    for (const pt of particles) {

      ctx.save();

      ctx.globalAlpha =
        Math.max(0, pt.life);

      ctx.fillStyle = pt.color;

      ctx.fillRect(
        pt.x - pt.size / 2,
        pt.y - pt.size / 2,
        pt.size,
        pt.size
      );

      ctx.restore();

    }

  }


  /* =========================
     PIPE SPAWN TIMER
  ========================= */

  let pipeTimer = 0;

  const PIPE_INTERVAL = 90;


  /* =========================
     MAIN LOOP
  ========================= */

  let lastTime = null;

  function loop(now) {

    if (lastTime === null) {

      lastTime = now;

    }

    const dt =
      (now - lastTime) / 16.6667;

    lastTime = now;


    if (gameState === "PLAYING") {

      pipeTimer += dt;

      if (pipeTimer >= PIPE_INTERVAL) {

        pipeTimer = 0;

        spawnPipe();

      }

    }


    update(dt);

    draw();


    requestAnimationFrame(loop);

  }


  /* =========================
     INIT
  ========================= */

  window.addEventListener(
    "resize",
    resize
  );

  resize();

  requestAnimationFrame(loop);

})();
</script>

</body>
</html>`
        });
    }
};
