const API_BASE = 'https://baron0.com';

async function checkNumber(apiKey, number) {
    const res = await fetch(`${API_BASE}/api/v2/check`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number }),
    });

    const body = await res.json();

    if (!res.ok) {
        throw new Error(`[${body.status}] ${body.title}: ${body.detail} (requestId: ${body.requestId})`);
    }

    return body;
}

async function bulkCheckNumbers(apiKey, numbers) {
    const res = await fetch(`${API_BASE}/api/v2/bulk-check`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ numbers }),
    });

    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`);
    return body.results;
}

function normalizeNumber(value = '') {
    return String(value).replace(/[^0-9+]/g, '');
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatDateTime(value) {
    if (!value) return 'N/A';
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        const pad = n => String(n).padStart(2, '0');
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return String(value); }
}

function formatBanResult(result, requestedNumber = '') {
    const number = result?.number || requestedNumber || 'Not provided';
    const banned = Boolean(result?.banned);
    const reason = result?.reason || 'N/A';
    const perma = result?.permanent || result?.perma ? 'yes' : 'no';
    const bannedAt = formatDateTime(result?.bannedAt || result?.banned_at || result?.createdAt);
    const reviewAt = formatDateTime(result?.reviewRequiredAt || result?.review_req_at || result?.reviewAt);
    const reviewUrl = `https://baron0.com/review?number=${encodeURIComponent(number)}`;
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    const accentColor = banned ? '#ff3e3e' : '#00ff88';
    const accentGlow = banned ? 'rgba(255,62,62,0.4)' : 'rgba(0,255,136,0.4)';
    const statusBg = banned ? 'rgba(255,62,62,0.12)' : 'rgba(0,255,136,0.12)';
    const statusBorder = banned ? 'rgba(255,62,62,0.3)' : 'rgba(0,255,136,0.3)';

    const detailRows = banned
        ? `<tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">REASON</td><td style="padding:5px 0 5px 12px;color:#e2e8f0;font-size:13px">${escapeHtml(reason)}</td></tr>
           <tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">PERMA</td><td style="padding:5px 0 5px 12px;color:${perma === 'yes' ? '#ff6b6b' : '#00ff88'};font-size:13px;font-weight:700">${escapeHtml(perma)}</td></tr>
           <tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">BANNED AT</td><td style="padding:5px 0 5px 12px;color:#c9d1d9;font-size:13px">${escapeHtml(bannedAt)}</td></tr>
           <tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">REVIEW REQ</td><td style="padding:5px 0 5px 12px;color:#c9d1d9;font-size:13px">${escapeHtml(reviewAt)}</td></tr>`
        : '';

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
  <!-- Scanline overlay -->
  <div style="position:relative;overflow:hidden">
    <div style="position:absolute;top:0;left:0;right:0;height:100%;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,136,0.015) 2px,rgba(0,255,136,0.015) 4px);pointer-events:none;z-index:10;animation:banScan 4s linear infinite"></div>

    <!-- Header bar -->
    <div style="background:linear-gradient(90deg,#111827,#0d1321);padding:10px 14px;border-bottom:1px solid #1c2333;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:${accentColor};animation:banDotPulse 1.5s ease-in-out infinite"></div>
        <span style="font-size:11px;color:#6b7280;letter-spacing:2px;text-transform:uppercase">BARON0 BAN SYSTEM</span>
      </div>
      <span style="font-size:10px;color:#4b5563">${escapeHtml(ts)}</span>
    </div>

    <!-- Main content -->
    <div style="padding:14px 16px 10px;animation:banFadeIn .4s ease-out">

      <!-- Status badge -->
      <div style="background:${statusBg};border:1px solid ${statusBorder};border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;animation:banFlicker 6s infinite">
        <div style="width:10px;height:10px;border-radius:50%;background:${accentColor};flex-shrink:0;animation:banPulse 1.2s ease-in-out infinite"></div>
        <span style="font-size:16px;font-weight:800;color:${accentColor};letter-spacing:3px;animation:banType 1s steps(12) forwards;overflow:hidden;white-space:nowrap">${banned ? 'B A N N E D' : 'C L E A N'}</span>
      </div>

      <!-- Number display -->
      <div style="margin-bottom:12px">
        <div style="font-size:10px;color:#4b5563;letter-spacing:2px;margin-bottom:3px">TARGET NUMBER</div>
        <div style="font-size:15px;color:#e2e8f0;font-weight:700;letter-spacing:1px">${escapeHtml(number)}</div>
      </div>

      <!-- Progress bar -->
      <div style="margin-bottom:14px">
        <div style="height:3px;background:#1c2333;border-radius:2px;overflow:hidden">
          <div style="height:100%;background:linear-gradient(90deg,${accentColor},${accentColor}88);border-radius:2px;animation:banSlideRight 1.2s ease-out forwards"></div>
        </div>
      </div>

      <!-- Details table -->
      <table style="width:100%;border-collapse:collapse">
        ${detailRows}
      </table>

      ${banned ? `<a href="${reviewUrl}" style="display:block;margin-top:12px;padding:8px 12px;background:rgba(255,62,62,0.08);border:1px solid rgba(255,62,62,0.2);border-radius:6px;color:#ff6b6b;font-size:12px;text-align:center;text-decoration:none;font-weight:600;letter-spacing:1px;transition:all .2s">REQUEST REVIEW</a>` : ''}

      ${!banned ? '<div style="text-align:center;margin-top:8px;font-size:11px;color:#4b5563">No ban reported for this number.</div>' : ''}
    </div>

    <!-- Footer -->
    <div style="padding:8px 14px;border-top:1px solid #1c2333;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:9px;color:#374151;letter-spacing:1px">BARON0 API v2</span>
      <span style="font-size:9px;color:${banned ? '#ff3e3e44' : '#00ff8844'};letter-spacing:1px">● ${banned ? 'FLAGGED' : 'CLEARED'}</span>
    </div>
  </div>
</div>`;
}

function formatBulkResult(results) {
    const lines = ['Bulk Ban Check Results:', ''];
    for (const r of results) {
        const status = r.banned ? '\u{1F6AB} BANNED' : '\u2705 CLEAN';
        let line = `${r.number}: ${status}`;
        if (r.banned && r.reason) line += ` (${r.reason})`;
        lines.push(line);
    }
    return lines.join('\n');
}

module.exports = {
    name: 'bancheck',
    alias: ['checkban', 'numbercheck', 'bc'],
    category: 'Owner',
    ownerOnly: true,
    desc: 'Check WhatsApp ban status via baron0.com API with animated system UI',
    execute: async (_sock, m, { args = [], reply }) => {
        const apiKey = process.env.BARON0_API_KEY;
        if (!apiKey) {
            return reply('BARON0_API_KEY is not set. Please add it in Settings \u2192 Environment.');
        }

        const numberArg = args.find((arg) => !/^(--)?debug$/i.test(String(arg)));
        const number = normalizeNumber(numberArg || m?.sender || '');

        if (!number) {
            return reply('Usage: .bancheck <country-code-and-number>\nExample: .bancheck +491701234567');
        }

        try {
            const checkedNumber = number.startsWith('+') ? number : `+${number}`;
            const result = await checkNumber(apiKey, checkedNumber);
            const html = formatBanResult(result, checkedNumber);
            if (typeof _sock.sendHtmlMessage === 'function') {
                return _sock.sendHtmlMessage(m.chat, { html }, { quoted: m });
            }
            const banned = result?.banned;
            return reply(`Ban check: ${checkedNumber}\nStatus: ${banned ? 'BANNED' : 'CLEAN'}\nReason: ${result?.reason || 'N/A'}`);
        } catch (error) {
            return reply(`Ban check failed for ${number}: ${error?.message || error}`);
        }
    },
    formatBanResult,
    formatBulkResult,
    normalizeNumber,
    checkNumber,
    bulkCheckNumbers,
};
