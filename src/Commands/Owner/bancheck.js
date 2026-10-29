// bancheck.js — WhatsApp ban check via the Baron0 v2 API.
//
// POST https://baron0.com/api/v2/check
// Authorization: Bearer <BARON0_API_KEY>
// Body: { number: "+<country-code-and-number>" }
const API_BASE = 'https://baron0.com';
const { getBotDateParts } = require('../../Utils/timezone');

async function checkNumber(number, apiKey = process.env.BARON0_API_KEY) {
    if (!apiKey) throw new Error('BARON0_API_KEY is not configured. Add it to your .env before using .bancheck.');
    const normalizedNumber = normalizeNumber(number);
    if (!normalizedNumber) throw new Error('No number supplied');

    const e164Number = normalizedNumber.startsWith('+') ? normalizedNumber : `+${normalizedNumber}`;
    const res = await fetch(`${API_BASE}/api/v2/check`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ number: e164Number }),
    });
    let body;
    try {
        body = await res.json();
    } catch {
        const error = new Error(`Ban check API returned a non-JSON response (HTTP ${res.status})`);
        error.httpStatus = res.status;
        throw error;
    }

    if (!res.ok) {
        const detail = body?.detail || body?.message || body?.error || body?.title || `HTTP ${res.status}`;
        const error = new Error(`Ban check failed: ${detail}`);
        error.httpStatus = res.status;
        error.bodyKeys = body && typeof body === 'object' ? Object.keys(body) : [];
        throw error;
    }

    if (!body || typeof body !== 'object' || typeof body.banned !== 'boolean') {
        const error = new Error('Ban check API returned an unexpected response');
        error.httpStatus = res.status;
        error.bodyKeys = body && typeof body === 'object' ? Object.keys(body) : [];
        throw error;
    }

    return body;
}

function normalizeNumber(value = '') {
    return String(value).replace(/[^0-9]/g, '');
}

const HTML_ESCAPES = Object.create(null);
HTML_ESCAPES['&'] = '&amp;';
HTML_ESCAPES['<'] = '&lt;';
HTML_ESCAPES['>'] = '&gt;';
HTML_ESCAPES[String.fromCharCode(34)] = '&quot;';
HTML_ESCAPES[String.fromCharCode(39)] = '&#39;';

function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, c => HTML_ESCAPES[c]);
}

function formatDateTime(value) {
    if (!value) return 'N/A';
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        const parts = getBotDateParts(d);
        return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
    } catch { return String(value); }
}

function formatBanResult(result, requestedNumber = '') {
    const number = result?.number || requestedNumber || 'Not provided';
    const banned = Boolean(result?.banned);
    const apiStatus = String(result?.status || '');
    const status = !apiStatus || apiStatus.toLowerCase() === 'ok'
        ? (banned ? 'Banned' : 'Clean')
        : apiStatus;
    const device = result?.info?.device || 'Unknown';
    const email = result?.info?.email || 'Unknown';
    const reason = result?.reason ? `<tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">REASON</td><td style="padding:5px 0 5px 12px;color:#c9d1d9;font-size:13px">${escapeHtml(result.reason)}</td></tr>` : '';
    const checkedAt = formatDateTime(result?.checkedAt || new Date());
    const now = getBotDateParts(new Date());
    const ts = `${now.hour}:${now.minute}:${now.second}`;

    const accentColor = banned ? '#ff3e3e' : '#00ff88';
    const accentGlow = banned ? 'rgba(255,62,62,0.4)' : 'rgba(0,255,136,0.4)';
    const statusBg = banned ? 'rgba(255,62,62,0.12)' : 'rgba(0,255,136,0.12)';
    const statusBorder = banned ? 'rgba(255,62,62,0.3)' : 'rgba(0,255,136,0.3)';

    const detailRows = `
           <tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">STATUS</td><td style="padding:5px 0 5px 12px;color:${accentColor};font-size:13px;font-weight:700">${escapeHtml(status)}</td></tr>
           <tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">BANNED</td><td style="padding:5px 0 5px 12px;color:${banned ? '#ff6b6b' : '#00ff88'};font-size:13px;font-weight:700">${banned ? 'YES' : 'NO'}</td></tr>
           ${reason}
           <tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">DEVICE</td><td style="padding:5px 0 5px 12px;color:#c9d1d9;font-size:13px">${escapeHtml(device)}</td></tr>
           <tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">EMAIL</td><td style="padding:5px 0 5px 12px;color:#c9d1d9;font-size:13px">${escapeHtml(email)}</td></tr>
           <tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">CHECKED</td><td style="padding:5px 0 5px 12px;color:#c9d1d9;font-size:13px">${escapeHtml(checkedAt)}</td></tr>`;

    return `<style>
@keyframes banScan{0%{background-position:0 0}100%{background-position:0 40px}}
@keyframes banPulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes banGlow{0%,100%{box-shadow:0 0 8px ${accentGlow}}50%{box-shadow:0 0 20px ${accentGlow},0 0 40px ${accentGlow}}}
@keyframes banType{from{width:0}to{width:100%}}
@keyframes banFlicker{0%,93%,100%{opacity:1}94%{opacity:.7}96%{opacity:1}97%{opacity:.6}}
@keyframes banFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes banSlideRight{from{width:0}to{width:${banned ? '100%' : '60%'}}}
@keyframes banDotPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.5}}
</style>
<div style="font-family:'Courier New',Consolas,monospace;padding:0;background:#0a0e17;color:#c9d1d9;border-radius:10px;overflow:hidden;max-width:360px;border:1px solid #1c2333;animation:banGlow 3s ease-in-out infinite">
  <div style="position:relative;overflow:hidden">
    <div style="position:absolute;top:0;left:0;right:0;height:100%;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,136,0.015) 2px,rgba(0,255,136,0.015) 4px);pointer-events:none;z-index:10;animation:banScan 4s linear infinite"></div>

    <div style="background:linear-gradient(90deg,#111827,#0d1321);padding:10px 14px;border-bottom:1px solid #1c2333;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:${accentColor};animation:banDotPulse 1.5s ease-in-out infinite"></div>
        <span style="font-size:11px;color:#6b7280;letter-spacing:2px;text-transform:uppercase">WHATSAPP BAN SYSTEM</span>
      </div>
      <span style="font-size:10px;color:#4b5563">${escapeHtml(ts)}</span>
    </div>

    <div style="padding:14px 16px 10px;animation:banFadeIn .4s ease-out">
      <div style="background:${statusBg};border:1px solid ${statusBorder};border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;animation:banFlicker 6s infinite">
        <div style="width:10px;height:10px;border-radius:50%;background:${accentColor};flex-shrink:0;animation:banPulse 1.2s ease-in-out infinite"></div>
        <span style="font-size:16px;font-weight:800;color:${accentColor};letter-spacing:3px;animation:banType 1s steps(12) forwards;overflow:hidden;white-space:nowrap">${banned ? 'B A N N E D' : 'C L E A N'}</span>
      </div>

      <div style="margin-bottom:12px">
        <div style="font-size:10px;color:#4b5563;letter-spacing:2px;margin-bottom:3px">TARGET NUMBER</div>
        <div style="font-size:15px;color:#e2e8f0;font-weight:700;letter-spacing:1px">${escapeHtml(number)}</div>
      </div>

      <div style="margin-bottom:14px">
        <div style="height:3px;background:#1c2333;border-radius:2px;overflow:hidden">
          <div style="height:100%;background:linear-gradient(90deg,${accentColor},${accentColor}88);border-radius:2px;animation:banSlideRight 1.2s ease-out forwards"></div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse">
        ${detailRows}
      </table>

      ${!banned ? '<div style="text-align:center;margin-top:10px;font-size:11px;color:#4b5563">No ban reported for this number.</div>' : ''}
    </div>

    <div style="padding:8px 14px;border-top:1px solid #1c2333;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:9px;color:#374151;letter-spacing:1px">BARON0 BAN API</span>
      <span style="font-size:9px;color:${banned ? '#ff3e3e44' : '#00ff8844'};letter-spacing:1px">● ${banned ? 'FLAGGED' : 'CLEARED'}</span>
    </div>
  </div>
</div>`;
}

module.exports = {
    name: 'bancheck',
    alias: ['checkban', 'numbercheck', 'bc'],
    category: 'Owner',
    ownerOnly: true,
    desc: 'Check WhatsApp ban status via Baron0 API',
    execute: async (_sock, m, { args = [], reply }) => {
        const apiKey = process.env.BARON0_API_KEY;
        if (!apiKey) {
            return reply('BARON0_API_KEY is not configured. Add it to your .env before using .bancheck.');
        }
        const debug = args.some(arg => /^(--)?debug$/i.test(String(arg)));
        const numberArg = args.find((arg) => !/^(--)?debug$/i.test(String(arg)));
        const number = normalizeNumber(numberArg || m?.sender || '');

        if (!number) {
            return reply('Usage: .bancheck <country-code-and-number>\nExample: .bancheck 491701234567');
        }

        try {
            const result = await checkNumber(number, apiKey);
            const html = formatBanResult(result, number);
            if (typeof _sock.sendHtmlMessage === 'function') {
                return _sock.sendHtmlMessage(m.chat, { html }, { quoted: m });
            }
            const banned = result?.banned;
            const apiStatus = String(result?.status || '');
            const status = !apiStatus || apiStatus.toLowerCase() === 'ok'
                ? (banned ? 'Banned' : 'Clean')
                : apiStatus;
            if (debug) {
                return reply(
                    `Diagnostics (safe metadata only)\n` +
                    `Number: ${number}\n` +
                    `Status: ${status}\n` +
                    `Ban detected: ${banned ? 'YES' : 'NO'}\n` +
                    `Data keys: ${Object.keys(result || {}).join(', ') || 'none'}`
                );
            }
            return reply(
                `Ban check: ${number}\n` +
                `Status: ${status}\n` +
                `Ban detected: ${banned ? 'YES' : 'NO'}\n` +
                `Checked via the Baron0 ban-status endpoint.`
            );
        } catch (error) {
            return reply(`Ban check failed for ${number}: ${error?.message || error}`);
        }
    },
    formatBanResult,
    normalizeNumber,
    checkNumber,
};
