const games = new Map();
const EVENTS = [
    { action: 'shoot', damage: 3, icon: '\u{1F52B}', text: 'Headshot landed!' },
    { action: 'barricade', damage: 0, icon: '\u{1FAB5}', text: 'Barricade reinforced.' },
    { action: 'run', damage: -1, icon: '\u{1F3C3}', text: 'Sprinted through.' },
];

function healthBar(hp, max = 10) {
    const filled = Math.max(0, Math.min(max, hp));
    const empty = max - filled;
    const color = hp > 6 ? '#00ff88' : hp > 3 ? '#fbbf24' : '#ff6b6b';
    return `<span style="color:${color}">${'\u2588'.repeat(filled)}</span><span style="color:#1c2333">${'\u2591'.repeat(empty)}</span>`;
}

function buildHtml(game) {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const hpColor = game.health > 6 ? '#00ff88' : game.health > 3 ? '#fbbf24' : '#ff6b6b';
    const pct = Math.round((game.health / 10) * 100);
    const dayPct = Math.round((game.day / 10) * 100);
    return `<style>
@keyframes zbScan{0%{background-position:0 0}100%{background-position:0 40px}}
@keyframes zbPulse{0%,100%{box-shadow:0 0 6px rgba(255,62,62,.2)}50%{box-shadow:0 0 16px rgba(255,62,62,.4)}}
@keyframes zbFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes zbCardIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
@keyframes zbGlitch{0%,90%,100%{transform:none;opacity:1}92%{transform:translateX(2px);opacity:.8}94%{transform:translateX(-2px);opacity:.9}96%{transform:none}}
@keyframes zbBar{from{width:0}to{width:${pct}%}}
@keyframes zbDot{0%,100%{opacity:1}50%{opacity:.3}}
</style>
<div style="font-family:'Courier New',Consolas,monospace;padding:0;background:#0a0e17;color:#c9d1d9;border-radius:10px;overflow:hidden;max-width:360px;border:1px solid #1c2333;animation:zbPulse 3s ease-in-out infinite">
  <div style="position:relative;overflow:hidden">
    <div style="position:absolute;top:0;left:0;right:0;height:100%;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,62,62,.01) 2px,rgba(255,62,62,.01) 4px);pointer-events:none;z-index:10;animation:zbScan 5s linear infinite"></div>
    <div style="background:linear-gradient(90deg,#1a0505,#0d1321);padding:10px 14px;border-bottom:1px solid #2d0a0a;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:#ff3e3e;animation:zbDot 1.5s ease-in-out infinite"></div>
        <span style="font-size:11px;color:#6b7280;letter-spacing:2px;text-transform:uppercase">\u{1F9DF} ZOMBIE NIGHTFALL</span>
      </div>
      <span style="font-size:10px;color:#4b5563">${ts}</span>
    </div>
    <div style="padding:14px 16px 10px;animation:zbFadeIn .4s ease-out">
      <!-- Day -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:10px;color:#ff6b6b;letter-spacing:2px;font-weight:700;animation:zbGlitch 4s infinite">DAY ${game.day}</span>
        <span style="font-size:10px;color:#4b5563">${game.day}/10</span>
      </div>
      <!-- Health bar -->
      <div style="margin-bottom:10px">
        <div style="font-size:10px;color:#4b5563;letter-spacing:2px;margin-bottom:4px">HEALTH</div>
        <div style="height:8px;background:#1c2333;border-radius:4px;overflow:hidden">
          <div style="height:100%;background:linear-gradient(90deg,${hpColor},${hpColor}88);border-radius:4px;animation:zbBar 1s ease-out forwards;box-shadow:0 0 8px ${hpColor}44"></div>
        </div>
        <div style="font-size:11px;color:${hpColor};margin-top:3px;font-weight:700">${game.health}/10 HP</div>
      </div>
      <!-- Stats -->
      <div style="display:flex;gap:10px;margin-bottom:12px">
        <div style="flex:1;background:rgba(251,191,36,.05);border:1px solid rgba(251,191,36,.15);border-radius:6px;padding:8px;text-align:center;animation:zbCardIn .4s">
          <div style="font-size:9px;color:#4b5563;letter-spacing:1px">AMMO</div>
          <div style="font-size:18px;font-weight:800;color:#fbbf24">${game.ammo}</div>
        </div>
        <div style="flex:1;background:rgba(0,255,136,.05);border:1px solid rgba(0,255,136,.15);border-radius:6px;padding:8px;text-align:center;animation:zbCardIn .4s .1s both">
          <div style="font-size:9px;color:#4b5563;letter-spacing:1px">BARRICADE</div>
          <div style="font-size:18px;font-weight:800;color:#00ff88">${game.barricade}</div>
        </div>
      </div>
      <!-- Event log -->
      <div style="background:#111827;border:1px solid #1c2333;border-radius:6px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#e2e8f0;animation:zbCardIn .5s .2s both">
        <div style="font-size:9px;color:#4b5563;letter-spacing:1px;margin-bottom:4px">SYSTEM LOG</div>
        ${game.message}
      </div>
      <!-- Actions -->
      <div style="display:flex;gap:6px;justify-content:center">
        <span style="padding:6px 12px;background:rgba(255,62,62,.08);border:1px solid rgba(255,62,62,.2);border-radius:5px;color:#ff6b6b;font-size:11px;font-weight:600;letter-spacing:1px">\u{1F52B} SHOOT</span>
        <span style="padding:6px 12px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);border-radius:5px;color:#fbbf24;font-size:11px;font-weight:600;letter-spacing:1px">\u{1FAB5} BARRICADE</span>
        <span style="padding:6px 12px;background:rgba(0,255,136,.08);border:1px solid rgba(0,255,136,.2);border-radius:5px;color:#00ff88;font-size:11px;font-weight:600;letter-spacing:1px">\u{1F3C3} RUN</span>
      </div>
    </div>
    <div style="padding:8px 14px;border-top:1px solid #1c2333;text-align:center">
      <span style="font-size:10px;color:#4b5563">Day ${game.day}/10 \u2022 ${game.health} HP \u2022 stop to abandon</span>
    </div>
  </div>
</div>`;
}

module.exports = {
    name: 'zombie', alias: ['zombies', 'survival'], desc: 'Survive the zombie nightfall with animated HTML.', category: 'Games', usage: '.zombie',
    execute: async (sock, m, { args, reply }) => {
        const key = m.chat;
        const send = async (html) => {
            if (typeof sock.sendHtmlMessage === 'function') return sock.sendHtmlMessage(m.chat, { html }, { quoted: m });
            return reply(html.replace(/<[^>]+>/g, ''));
        };
        if (args[0] === 'stop') { games.delete(key); return reply('Zombie run ended.'); }
        let game = games.get(key);
        if (!game) {
            game = { day: 1, health: 10, ammo: 6, barricade: 2, message: '<span style="color:#ff6b6b">\u{1F9DF} The dead are moving...</span>' };
            games.set(key, game);
            return send(buildHtml(game));
        }
        const actionName = args[0]?.toLowerCase();
        const action = EVENTS.find(e => e.action === actionName);
        if (!action) return send(buildHtml(game));
        if (actionName === 'shoot' && game.ammo < 1) return reply('Out of ammo. Try *run* or *barricade*.');
        if (actionName === 'shoot') game.ammo--;
        if (actionName === 'barricade') game.barricade = Math.min(5, game.barricade + 2);
        const threat = Math.max(0, 3 - Math.floor(game.barricade / 2) - action.damage);
        game.health -= threat;
        game.day++;
        game.message = `<span style="color:#00ff88">${action.icon} ${action.text}</span><br><span style="color:#ff6b6b">\u{1F9DF} Horde hits for <b>${threat}</b> damage</span>`;
        if (game.health <= 0) {
            game.health = 0;
            games.delete(key);
            return send(buildHtml(game) + `<div style="text-align:center;padding:10px;font-size:18px;font-weight:800;color:#ff6b6b;animation:zbCardIn .3s">\u{1F480} GAME OVER \u2014 ${game.day - 1} days survived</div>`);
        }
        if (game.day > 10) {
            games.delete(key);
            return send(buildHtml(game) + `<div style="text-align:center;padding:10px;font-size:18px;font-weight:800;color:#00ff88;animation:zbCardIn .3s">\u{1F3C6} NIGHTFALL SURVIVED!</div>`);
        }
        return send(buildHtml(game));
    }
};
