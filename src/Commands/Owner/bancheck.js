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

    return body; // { status: 'ok', banned: boolean, reason?: string }
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
    return body.results; // [{ number, status, banned, reason? }, ...]
}

function normalizeNumber(value = '') {
    return String(value).replace(/[^0-9+]/g, '');
}

function escapeHtml(value = '') {
    return String(value).replace(/[&<>\"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[character]));
}

function formatBanResult(result, requestedNumber = '') {
    const number = result?.number || requestedNumber || 'Not provided';
    const status = result?.status || (result?.banned ? 'banned' : 'ok');
    const banned = Boolean(result?.banned);
    const reason = result?.reason || 'No ban reason was returned.';
    const reviewUrl = `https://baron0.com/review?number=${encodeURIComponent(number)}`;
    const state = banned ? 'BANNED' : 'NOT BANNED';
    return [
        `<div style="font-family:Arial,sans-serif;padding:16px;background:#10151c;color:#f3f4f6;border-radius:12px">`,
        '<h2 style="margin:0 0 12px;color:#8be28b">Ban status check</h2>',
        `<p><b>Number</b><br>${escapeHtml(number)}</p>`,
        `<p><b>API status</b><br>${escapeHtml(status)}</p>`,
        `<p><b>Ban status</b><br><span style="color:${banned ? '#ff8b8b' : '#8be28b'}"><b>${state}</b></span></p>`,
        banned ? `<p><b>Reason</b><br>${escapeHtml(reason)}</p>` : '<p>No ban was reported for this number.</p>',
        banned ? `<p><a href="${reviewUrl}" style="color:#8be28b"><b>Request a review</b></a></p>` : '',
        '<small>Source: baron0.com Ban Check API</small></div>',
    ].join('');
}

function formatBulkResult(results) {
    const lines = ['Bulk Ban Check Results:', ''];
    for (const r of results) {
        const status = r.banned ? '🚫 BANNED' : '✅ CLEAN';
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
    desc: 'Check WhatsApp ban status via baron0.com API',
    execute: async (_sock, m, { args = [], reply }) => {
        const apiKey = process.env.BARON0_API_KEY;
        if (!apiKey) {
            return reply('BARON0_API_KEY is not set. Please add it in Settings → Environment.');
        }

        const diagnostic = args.some((arg) => /^(--)?debug$/i.test(String(arg)));
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
            return reply(`Ban check is available, but this Baileys build does not support HTML messages.\n\nNumber: ${checkedNumber}\nStatus: ${result?.status || 'unknown'}\nBanned: ${result?.banned ? 'YES' : 'NO'}`);
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
