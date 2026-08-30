const games = new Map();
const ZONES = ['left', 'center', 'right'];

function buildHtml(game) {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const shots = game.history.map((h, i) => {
        const icon = h.goal ? '<span style="color:#00ff88">\u26BD</span>' : '<span style="color:#ff6b6b">\u2716</span>';
        return `<span style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;background:${h.goal?'rgba(0,255,136,.08)':'rgba(255,107,107,.08)'};border-radius:4px;font-size:11px;margin:0 2px;border:1px solid ${h.goal?'rgba(0,255,136,.2)':'rgba(255,107,107,.2)'};animation:pnCardIn .3s ease-out ${i*0.08}s both">${icon}</span>`;
    }).join('');
    const progressPct = Math.round((game.shot / 5) * 100);
    return `<style>
@keyframes pnScan{0%{background-position:0 0}100%{background-position:0 40px}}
@keyframes pnPulse{0%,100%{box-shadow:0 0 6px rgba(0,255,136,.2)}50%{box-shadow:0 0 16px rgba(0,255,136,.4)}}
@keyframes pnFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes pnCardIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
@keyframes pnBar{from{width:0}to{width:${progressPct}%}}
@keyframes pnGoalGlow{0%,100%{text-shadow:0 0 8px rgba(0,255,136,.3)}50%{text-shadow:0 0 20px rgba(0,255,136,.6)}}
</style>
<div style="font-family:'Courier New',Consolas,monospace;padding:0;background:#0a0e17;color:#c9d1d9;border-radius:10px;overflow:hidden;max-width:360px;border:1px solid #1c2333;animation:pnPulse 3s ease-in-out infinite">
  <div style="position:relative;overflow:hidden">
    <div style="position:absolute;top:0;left:0;right:0;height:100%;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,136,.01) 2px,rgba(0,255,136,.01) 4px);pointer-events:none;z-index:10;animation:pnScan 5s linear infinite"></div>
    <div style="background:linear-gradient(90deg,#111827,#0d1321);padding:10px 14px;border-bottom:1px solid #1c2333;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:#00ff88;animation:pnCardIn 1s ease-in-out infinite"></div>
        <span style="font-size:11px;color:#6b7280;letter-spacing:2px;text-transform:uppercase">\u26BD PENALTY SHOOTOUT</span>
      </div>
      <span style="font-size:10px;color:#4b5563">${ts}</span>
    </div>
    <div style="padding:14px 16px 10px;animation:pnFadeIn .4s ease-out">
      <!-- Goal icon -->
      <div style="text-align:center;margin-bottom:10px">
        <span style="font-size:36px;animation:pnGoalGlow 2s ease-in-out infinite">\u{1F945}</span>
      </div>
      <!-- Score box -->
      <div style="background:rgba(0,255,136,.05);border:1px solid rgba(0,255,136,.15);border-radius:8px;padding:10px 14px;margin-bottom:12px;text-align:center;animation:pnCardIn .5s ease-out">
        <div style="font-size:10px;color:#4b5563;letter-spacing:2px;margin-bottom:2px">SHOT ${game.shot + 1} / 5</div>
        <div style="font-size:28px;font-weight:800;color:#00ff88;animation:pnCardIn .3s">${game.score}</div>
        <div style="font-size:10px;color:#4b5563;letter-spacing:1px;margin-top:2px">GOALS</div>
      </div>
      <!-- Progress bar -->
      <div style="margin-bottom:12px">
        <div style="height:3px;background:#1c2333;border-radius:2px;overflow:hidden">
          <div style="height:100%;background:linear-gradient(90deg,#00ff88,#00ff8888);border-radius:2px;animation:pnBar 1s ease-out forwards"></div>
        </div>
      </div>
      <!-- Shot history -->
      ${shots ? `<div style="text-align:center;margin-bottom:12px;animation:pnFadeIn .3s">${shots}</div>` : ''}
      <!-- Targets -->
      <div style="display:flex;gap:8px;justify-content:center">
        <span style="padding:6px 14px;background:rgba(0,255,136,.05);border:1px solid rgba(0,255,136,.15);border-radius:6px;color:#00ff88;font-size:12px;font-weight:600;letter-spacing:1px">\u2B05 LEFT</span>
        <span style="padding:6px 14px;background:rgba(0,255,136,.05);border:1px solid rgba(0,255,136,.15);border-radius:6px;color:#00ff88;font-size:12px;font-weight:600;letter-spacing:1px">\u2B06 CENTER</span>
        <span style="padding:6px 14px;background:rgba(0,255,136,.05);border:1px solid rgba(0,255,136,.15);border-radius:6px;color:#00ff88;font-size:12px;font-weight:600;letter-spacing:1px">\u27A1 RIGHT</span>
      </div>
    </div>
    <div style="padding:8px 14px;border-top:1px solid #1c2333;text-align:center">
      <span style="font-size:10px;color:#4b5563">${game.saves} saved \u2022 ${game.score} scored</span>
    </div>
  </div>
</div>`;
}

function resultHtml(game) {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const win = game.score >= 3;
    const color = win ? '#00ff88' : '#ff6b6b';
    const label = win ? 'GOAL! LEGEND!' : 'SAVED! TRY AGAIN';
    const icon = win ? '\u{1F3C6}' : '\u{1F61E}';
    const shots = game.history.map((h, i) => {
        const c = h.goal ? 'rgba(0,255,136,.15)' : 'rgba(255,107,107,.15)';
        const b = h.goal ? 'rgba(0,255,136,.3)' : 'rgba(255,107,107,.3)';
        return `<span style="display:inline-block;width:26px;height:26px;line-height:26px;text-align:center;background:${c};border:1px solid ${b};border-radius:5px;font-size:12px;margin:2px;font-weight:700;color:${h.goal?'#00ff88':'#ff6b6b'};animation:pnCardIn .3s ease-out ${i*.08}s both">${h.goal?'\u26BD':'\u2716'}</span>`;
    }).join('');
    return `<style>
@keyframes pnScan{0%{background-position:0 0}100%{background-position:0 40px}}
@keyframes pnPulse{0%,100%{box-shadow:0 0 6px ${win?'rgba(0,255,136,.2)':'rgba(255,107,107,.2)'} }50%{box-shadow:0 0 20px ${win?'rgba(0,255,136,.4)':'rgba(255,107,107,.4)'} } }
@keyframes pnCardIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
</style>
<div style="font-family:'Courier New',Consolas,monospace;padding:0;background:#0a0e17;color:#c9d1d9;border-radius:10px;overflow:hidden;max-width:360px;border:1px solid #1c2333;animation:pnPulse 3s ease-in-out infinite">
  <div style="background:linear-gradient(90deg,#111827,#0d1321);padding:10px 14px;border-bottom:1px solid #1c2333;display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:11px;color:#6b7280;letter-spacing:2px">\u26BD MATCH RESULT</span>
    <span style="font-size:10px;color:#4b5563">${ts}</span>
  </div>
  <div style="padding:16px;text-align:center">
    <div style="font-size:40px;margin-bottom:8px;animation:pnCardIn .5s">${icon}</div>
    <div style="font-size:20px;font-weight:800;color:${color};letter-spacing:3px;margin-bottom:10px;animation:pnCardIn .4s">${label}</div>
    <div style="font-size:32px;font-weight:800;color:#00ff88;animation:pnCardIn .3s">${game.score} / 5</div>
    <div style="font-size:10px;color:#4b5563;letter-spacing:2px;margin-top:2px">GOALS SCORED</div>
    <div style="margin:14px 0">${shots}</div>
  </div>
  <div style="padding:8px 14px;border-top:1px solid #1c2333;text-align:center">
    <span style="font-size:10px;color:#4b5563">BARON0 \u2022 Penalty System</span>
  </div>
</div>`;
}

module.exports = {
    name: 'penalty', alias: ['football', 'soccer', 'ball'], desc: 'Animated HTML penalty shootout.', category: 'Games', usage: '.penalty',
    execute: async (sock, m, { args, reply }) => {
        const key = m.chat;
        const send = async (html) => {
            if (typeof sock.sendHtmlMessage === 'function') return sock.sendHtmlMessage(m.chat, { html }, { quoted: m });
            return reply(html.replace(/<[^>]+>/g, ''));
        };
        if (args[0] === 'stop') { games.delete(key); return reply('Penalty shootout cancelled.'); }
        let game = games.get(key);
        if (!game) {
            game = { shot: 0, score: 0, saves: 0, history: [] };
            games.set(key, game);
            return send(buildHtml(game));
        }
        const choice = args[0]?.toLowerCase();
        if (!ZONES.includes(choice)) return reply('Pick a target: *left*, *center*, or *right*.');
        const keeper = ZONES[Math.floor(Math.random() * ZONES.length)];
        game.shot++;
        const goal = choice !== keeper;
        if (goal) game.score++; else game.saves++;
        game.history.push({ choice, keeper, goal });
        if (game.shot >= 5) { games.delete(key); return send(resultHtml(game)); }
        return send(buildHtml(game));
    }
};
