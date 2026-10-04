'use strict';

const escapeHtml = value => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const shell = (title, accent, body, script) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><meta name="color-scheme" content="dark"><style>
:root{--bg:#080b16;--panel:#121a2b;--line:#2a3858;--text:#f5f7ff;--muted:#9ba8c7;--accent:${accent}}*{box-sizing:border-box}body{margin:0;padding:14px;background:radial-gradient(circle at 20% 0,#182747 0,#080b16 55%);font-family:Inter,system-ui,Arial;color:var(--text);touch-action:manipulation}.game{width:min(100%,430px);margin:auto;background:#0e1526eF;border:1px solid var(--line);border-radius:24px;padding:16px;box-shadow:0 18px 50px #0008}h1{margin:0;color:var(--accent);font-size:25px;letter-spacing:.08em}.sub{color:var(--muted);font-size:13px;margin:5px 0 12px}.stats{display:flex;gap:8px;margin:10px 0}.stat{flex:1;background:#ffffff0b;border:1px solid var(--line);border-radius:12px;padding:9px;text-align:center;font-size:12px;color:var(--muted)}.stat b{display:block;color:var(--text);font-size:19px}.btn{border:1px solid var(--line);background:#ffffff12;color:var(--text);border-radius:11px;padding:10px 13px;font-weight:700}.primary{background:var(--accent);color:#07101d;border:0}.row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}.board{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:16px;background:#060a13}.notice{min-height:22px;text-align:center;color:var(--muted);font-size:13px;margin:9px}.over{position:absolute;inset:0;display:none;place-items:center;background:#050814cc;text-align:center;padding:25px}.over.show{display:grid}.over h2{margin:0 0 8px;color:var(--accent)}canvas{display:block;width:100%;height:auto}button{font:inherit}@media(max-width:360px){.game{padding:12px}}
</style></head><body><main class="game"><h1>${escapeHtml(title)}</h1>${body}</main><script>${script}</script></body></html>`;

async function sendHtmlGame(sock, message, title, accent, body, script) {
  const html = shell(title, accent, body, script);
  if (typeof sock.sendHtmlMessage !== 'function') throw new Error('sendHtmlMessage is unavailable in this plogme version');
  return sock.sendHtmlMessage(message.chat, { html }, { quoted: message });
}

module.exports = { shell, sendHtmlGame, escapeHtml };
