// WhatsApp ban check via Baron0 v2 - PROXIED
const API_BASE = String(process.env.BARON0_PROXY_URL || 'https://ban.crysnovax.com').replace(/\/+$/, '');
const API_TIMEOUT_MS = 10000;
const PROXY_SECRET = String(process.env.BARON0_PROXY_SECRET || process.env.TELEGRAM_PROXY_SECRET || 'x').trim();

const { getBotDateParts } = require('../../Utils/timezone');

async function requestJson(url, options, serviceName) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        let body = null;

        try {
            body = await response.json();
        } catch (error) {
            if (controller.signal.aborted || error?.name === 'AbortError') throw error;
        }

        return { response, body };
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(`${serviceName} timed out. Please try again.`);
        }
        throw new Error(`${serviceName} is unavailable. Please try again later.`);
    } finally {
        clearTimeout(timeout);
    }
}

function apiError(serviceName, status) {
    const message = status === 429
        ? `${serviceName} rate limit reached. Please try again later.`
        : `${serviceName} request failed (HTTP ${status}).`;

    const error = new Error(message);
    error.httpStatus = status;
    return error;
}

function requireProxyConfig() {
    if (!PROXY_SECRET || !API_BASE) {
        throw new Error(`Ban proxy not configured. Set BARON0_PROXY_URL and BARON0_PROXY_SECRET in .env`);
    }
}

function normalizeNumber(value = '') {
    let text = String(value ?? '').trim();
    if (text.includes('@')) text = text.split('@')[0];
    if (text.includes(':')) text = text.split(':')[0];
    return text.replace(/[^0-9]/g, '');
}

function toE164Number(value) {
    const number = normalizeNumber(value);
    return number ? `+${number}` : '';
}

function resolveTargetNumber(args = [], m = {}, excludedArgs = []) {
    const ignored = new Set(excludedArgs.map(value => String(value).toLowerCase()));
    const explicit = (Array.isArray(args) ? args : [args])
        .filter(value => !ignored.has(String(value).toLowerCase()))
        .join(' ');

    const explicitNumber = normalizeNumber(explicit);
    if (explicitNumber) return explicitNumber;

    const quotedSender =
        m?.quoted?.sender ||
        m?.quoted?.key?.participant ||
        m?.quoted?.participant;

    const quotedNumber = normalizeNumber(quotedSender);
    if (quotedNumber) return quotedNumber;

    const mentioned = Array.isArray(m?.mentionedJid)
        ? m.mentionedJid[0]
        : m?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    const mentionedNumber = normalizeNumber(mentioned);
    if (mentionedNumber) return mentionedNumber;

    return normalizeNumber(m?.sender || m?.key?.participant || '');
}

async function checkNumber(number) {
    requireProxyConfig();

    const e164Number = toE164Number(number);
    if (!e164Number) throw new Error('No number supplied');

    const { response, body } = await requestJson(
        `${API_BASE}/api/v2/check`,
        {
            method: 'POST',
            headers: {
                'x-proxy-secret': PROXY_SECRET,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ number: e164Number }),
        },
        'Ban check API'
    );

    if (!response.ok) throw apiError('Ban check API', response.status);

    if (!body || typeof body !== 'object' || typeof body.banned !== 'boolean') {
        const error = new Error('Ban check API returned an invalid response.');
        error.httpStatus = response.status;
        throw error;
    }

    return body;
}

async function getAppealStatus(number) {
    requireProxyConfig();

    const e164Number = toE164Number(number);
    if (!e164Number) throw new Error('No number supplied');

    const url = new URL(`${API_BASE}/api/v2/appeal-status`);
    url.searchParams.set('phone', e164Number);

    const { response, body } = await requestJson(
        url.toString(),
        {
            method: 'GET',
            headers: {
                'x-proxy-secret': PROXY_SECRET,
                Accept: 'application/json',
            },
        },
        'Appeal status API'
    );

    if (response.status === 404) return { found: false };
    if (!response.ok) throw apiError('Appeal status API', response.status);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        const error = new Error('Appeal status API returned an invalid response.');
        error.httpStatus = response.status;
        throw error;
    }

    return { found: true, data: body };
}

const HTML_ESCAPES = Object.create(null);
HTML_ESCAPES['&'] = '&amp;';
HTML_ESCAPES['<'] = '&lt;';
HTML_ESCAPES['>'] = '&gt;';
HTML_ESCAPES[String.fromCharCode(34)] = '&quot;';
HTML_ESCAPES[String.fromCharCode(39)] = '&#39;';

function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, character => HTML_ESCAPES[character]);
}

function formatDateTime(value) {
    if (!value) return 'N/A';
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        const parts = getBotDateParts(date);
        return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
    } catch {
        return String(value);
    }
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
    const reason = result?.reason
        ? `<tr><td style="padding:5px 0;color:#7a8599;font-size:12px;white-space:nowrap">REASON</td><td style="padding:5px 0 5px 12px;color:#c9d1d9;font-size:13px">${escapeHtml(result.reason)}</td></tr>`
        : '';
    const checkedAt = formatDateTime(result?.checkedAt || new Date());
    const now = getBotDateParts(new Date());
    const timestamp = `${now.hour}:${now.minute}:${now.second}`;

    const accentColor = banned ? '#ff3e3e' : '#00ff88';
    const accentGlow = banned ? 'rgba(255,62,62,0.4)' : 'rgba(0,255,136,0.4)';
    const statusBg = banned ? 'rgba(255,62,62,0.12)' : 'rgba(0,255,136,0.12)';
    const statusBorder = banned ? 'rgba(255,62,62,0.3)' : 'rgba(0,255,136,0.3)';

    const detailRows = `
      <tr><td style="padding:5px 0;color:#7a8599;font-size:12px">STATUS</td><td style="padding:5px 0 5px 12px;color:${accentColor};font-size:13px;font-weight:700">${escapeHtml(status)}</td></tr>
      <tr><td style="padding:5px 0;color:#7a8599;font-size:12px">BANNED</td><td style="padding:5px 0 5px 12px;color:${banned ? '#ff6b6b' : '#00ff88'};font-size:13px;font-weight:700">${banned ? 'YES' : 'NO'}</td></tr>
      ${reason}
      <tr><td style="padding:5px 0;color:#7a8599;font-size:12px">DEVICE</td><td style="padding:5px 0 5px 12px;color:#c9d1d9;font-size:13px">${escapeHtml(device)}</td></tr>
      <tr><td style="padding:5px 0;color:#7a8599;font-size:12px">EMAIL</td><td style="padding:5px 0 5px 12px;color:#c9d1d9;font-size:13px">${escapeHtml(email)}</td></tr>
      <tr><td style="padding:5px 0;color:#7a8599;font-size:12px">CHECKED</td><td style="padding:5px 0 5px 12px;color:#c9d1d9;font-size:13px">${escapeHtml(checkedAt)}</td></tr>`;

    return `<style>
@keyframes banGlow{0%,100%{box-shadow:0 0 8px ${accentGlow}}50%{box-shadow:0 0 20px ${accentGlow}}}
@keyframes banPulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes banFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
</style>
<div style="font-family:'Courier New',monospace;padding:14px;background:#0a0e17;color:#c9d1d9;border-radius:10px;max-width:360px;border:1px solid #1c2333;animation:banGlow 3s ease-in-out infinite">
  <div style="font-size:11px;color:#6b7280;letter-spacing:2px;margin-bottom:12px">WHATSAPP BAN SYSTEM · ${escapeHtml(timestamp)}</div>
  <div style="background:${statusBg};border:1px solid ${statusBorder};border-radius:8px;padding:10px 14px;margin-bottom:14px;color:${accentColor};font-size:16px;font-weight:800">${banned ? 'B A N N E D' : 'C L E A N'}</div>
  <div style="font-size:10px;color:#4b5563;margin-bottom:3px">TARGET NUMBER</div>
  <div style="font-size:15px;color:#e2e8f0;font-weight:700;margin-bottom:12px">${escapeHtml(number)}</div>
  <table style="width:100%;border-collapse:collapse">${detailRows}</table>
  <div style="border-top:1px solid #1c2333;margin-top:10px;padding-top:8px;font-size:9px;color:#374151;letter-spacing:1px">BARON0 BAN API</div>
</div>`;
}

module.exports = {
    name: 'bancheck',
    alias: ['checkban', 'numbercheck', 'bc'],
    category: 'Owner',
    ownerOnly: true,
    desc: 'Check WhatsApp ban status via Baron0 API (proxied)',

    execute: async (_sock, m, { args = [], reply }) => {
        const debug = args.some(arg => /^(--)?debug$/i.test(String(arg)));
        const number = resolveTargetNumber(args, m, ['debug', '--debug']);

        if (!number) {
            return reply(
                'Usage: .bancheck <country-code-and-number>\n' +
                'Example: .bancheck +234 912 208 3563\n' +
                'You can also reply to a user with .bancheck.'
            );
        }

        try {
            const result = await checkNumber(number);
            const html = formatBanResult(result, number);

            if (typeof _sock?.sendHtmlMessage === 'function') {
                return _sock.sendHtmlMessage(m.chat, { html }, { quoted: m });
            }

            const banned = result.banned;
            const apiStatus = String(result.status || '');
            const status = !apiStatus || apiStatus.toLowerCase() === 'ok'
                ? (banned ? 'Banned' : 'Clean')
                : apiStatus;

            if (debug) {
                return reply(
                    `Diagnostics (safe metadata only)\n` +
                    `Number: ${number}\n` +
                    `Status: ${status}\n` +
                    `Ban detected: ${banned ? 'YES' : 'NO'}\n` +
                    `Data keys: ${Object.keys(result).join(', ') || 'none'}`
                );
            }

            return reply(
                `Ban check: ${number}\n` +
                `Status: ${status}\n` +
                `Ban detected: ${banned ? 'YES' : 'NO'}\n` +
                'Checked via the Baron0 ban-status endpoint.'
            );
        } catch (error) {
            return reply(`Ban check failed for ${number}: ${error?.message || 'service unavailable'}`);
        }
    },

    formatBanResult,
    normalizeNumber,
    resolveTargetNumber,
    checkNumber,
    getAppealStatus,
};
