const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const games = new Map();

function drawCard() {
    const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
    const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
    const val = ['J', 'Q', 'K'].includes(rank) ? 10 : rank === 'A' ? 11 : parseInt(rank);
    return { suit, rank, val };
}

function handValue(hand) {
    let sum = hand.reduce((s, c) => s + c.val, 0);
    let aces = hand.filter(c => c.rank === 'A').length;
    while (sum > 21 && aces > 0) { sum -= 10; aces--; }
    return sum;
}

function renderCards(cards, hideSecond = false) {
    return cards.map((c, i) => {
        if (hideSecond && i === 1) return `<td style="background:#111827;color:#374151;font-size:20px;padding:10px;border-radius:8px;text-align:center;border:1px dashed #374151">?</td>`;
        const color = ['\u2665', '\u2666'].includes(c.suit) ? '#ff6b6b' : '#e2e8f0';
        return `<td style="background:linear-gradient(135deg,#1e293b,#0f172a);color:${color};font-size:16px;padding:10px 14px;border-radius:8px;text-align:center;border:1px solid ${['\u2665','\u2666'].includes(c.suit)?'#ff6b6b33':'#334155'};min-width:48px;animation:bjCardIn .3s ease-out">${c.rank}<br><span style="font-size:12px">${c.suit}</span></td>`;
    }).join('');
}

function buildHtml(game, hideDealer = true) {
    const playerVal = handValue(game.you);
    const dealerLabel = hideDealer ? `${game.dealer[0].val} + ?` : handValue(game.dealer);
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    return `<style>
@keyframes bjScan{0%{background-position:0 0}100%{background-position:0 40px}}
@keyframes bjCardIn{from{opacity:0;transform:scale(.8) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes bjPulse{0%,100%{box-shadow:0 0 6px rgba(251,191,36,.2)}50%{box-shadow:0 0 16px rgba(251,191,36,.4)}}
@keyframes bjGlow{0%,100%{opacity:.7}50%{opacity:1}}
@keyframes bjFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
</style>
<div style="font-family:'Courier New',Consolas,monospace;padding:0;background:#0a0e17;color:#c9d1d9;border-radius:10px;overflow:hidden;max-width:360px;border:1px solid #1c2333;animation:bjPulse 3s ease-in-out infinite">
  <div style="position:relative;overflow:hidden">
    <div style="position:absolute;top:0;left:0;right:0;height:100%;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(251,191,36,.01) 2px,rgba(251,191,36,.01) 4px);pointer-events:none;z-index:10;animation:bjScan 5s linear infinite"></div>
    <div style="background:linear-gradient(90deg,#111827,#0d1321);padding:10px 14px;border-bottom:1px solid #1c2333;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:#fbbf24;animation:bjGlow 2s ease-in-out infinite"></div>
        <span style="font-size:11px;color:#6b7280;letter-spacing:2px;text-transform:uppercase">\u2660 \u2665 BLACKJACK \u2666 \u2663</span>
      </div>
      <span style="font-size:10px;color:#4b5563">${ts}</span>
    </div>
    <div style="padding:14px 16px 10px;animation:bjFadeIn .4s ease-out">
      <div style="font-size:10px;color:#4b5563;letter-spacing:2px;margin-bottom:6px">DEALER \u2014 ${dealerLabel}</div>
      <table style="width:100%;margin-bottom:14px"><tr>${renderCards(game.dealer, hideDealer)}</tr></table>
      <div style="height:1px;background:linear-gradient(90deg,transparent,#334155,transparent);margin:8px 0"></div>
      <div style="font-size:10px;color:#4b5563;letter-spacing:2px;margin-bottom:6px">YOUR HAND \u2014 ${playerVal}</div>
      <table style="width:100%;margin-bottom:10px"><tr>${renderCards(game.you, false)}</tr></table>
    </div>
    <div style="padding:8px 14px;border-top:1px solid #1c2333;text-align:center">
      <span style="font-size:10px;color:#4b5563">${hideDealer ? 'Reply hit / stand \u2022 stop to leave' : 'Dealer stands on 17+'}</span>
    </div>
  </div>
</div>`;
}

module.exports = {
    name: 'blackjack', alias: ['21', 'bj'], desc: 'Play animated HTML blackjack.', category: 'Games', usage: '.blackjack',
    execute: async (sock, m, { args, reply }) => {
        const key = m.chat;
        const send = async (html) => {
            if (typeof sock.sendHtmlMessage === 'function') return sock.sendHtmlMessage(m.chat, { html }, { quoted: m });
            return reply(html.replace(/<[^>]+>/g, ''));
        };
        if (args[0] === 'stop') { games.delete(key); return reply('Blackjack table closed.'); }
        let game = games.get(key);
        if (!game) {
            game = { you: [drawCard(), drawCard()], dealer: [drawCard(), drawCard()] };
            const pv = handValue(game.you);
            if (pv === 21) { games.delete(key); return send(buildHtml(game, false) + '<div style="text-align:center;padding:10px;font-size:18px;font-weight:800;color:#fbbf24;animation:bjCardIn .3s">BLACKJACK!</div>'); }
            games.set(key, game);
            return send(buildHtml(game, true));
        }
        const action = args[0]?.toLowerCase();
        if (action === 'hit') {
            game.you.push(drawCard());
            const pv = handValue(game.you);
            if (pv >= 21) {
                const label = pv === 21 ? 'BLACKJACK!' : 'BUST!';
                const color = pv === 21 ? '#fbbf24' : '#ff6b6b';
                games.delete(key);
                return send(buildHtml(game, false) + `<div style="text-align:center;padding:10px;font-size:18px;font-weight:800;color:${color};animation:bjCardIn .3s">${label}</div>`);
            }
            return send(buildHtml(game, true));
        }
        if (action !== 'stand') return send(buildHtml(game, true));
        while (handValue(game.dealer) < 17) game.dealer.push(drawCard());
        const you = handValue(game.you), dealer = handValue(game.dealer);
        let msg, color;
        if (you > 21 || (dealer <= 21 && dealer > you)) { msg = 'DEALER WINS'; color = '#ff6b6b'; }
        else if (you === dealer) { msg = 'PUSH'; color = '#6b7280'; }
        else { msg = 'YOU WIN'; color = '#00ff88'; }
        games.delete(key);
        return send(buildHtml(game, false) + `<div style="text-align:center;padding:10px;font-size:18px;font-weight:800;color:${color};animation:bjCardIn .3s">${msg}</div>`);
    }
};
