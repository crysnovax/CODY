'use strict';

const { request } = require('../../Plugin/prexzy');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, character => ESCAPES[character]);
}

function normalizeDomain(value = '') {
    return String(value)
        .trim()
        .replace(/^https?:\/\//i, '')
        .split('/')[0]
        .split('?')[0]
        .toLowerCase();
}

function first(values, fallback = 'Unknown') {
    return values.find(value => value !== undefined && value !== null && String(value).trim()) ?? fallback;
}

function collectAddresses(data) {
    const servers = data?.web_servers?.ips || [];
    return servers.map(item => item?.address).filter(Boolean);
}

function collectNameservers(data) {
    const servers = data?.nameservers?.servers || [];
    return servers.map(item => item?.domain).filter(Boolean);
}

function formatPlain(result, domain) {
    const addresses = collectAddresses(result);
    const providers = result?.web_servers?.providers || [];
    const nameservers = collectNameservers(result);
    return [
        `HOST CHECK: ${domain}`,
        `Status: ${result?.status ? 'Online / resolved' : 'Failed'}`,
        `IPv4/IPv6 addresses: ${addresses.join(', ') || 'none'}`,
        `IPv6 web: ${result?.ipv6_support?.web ? 'yes' : 'no'}`,
        `Providers: ${providers.map(item => item?.organization || item?.domain).filter(Boolean).join(', ') || 'unknown'}`,
        `Nameservers: ${nameservers.join(', ') || 'unknown'}`
    ].join('\n');
}

function formatHtml(result, domain) {
    const addresses = collectAddresses(result);
    const nameservers = collectNameservers(result);
    const providers = result?.web_servers?.providers || [];
    const online = Boolean(result?.status);
    const accent = online ? '#00e5a0' : '#ff6678';
    const addressRows = addresses.slice(0, 8).map(address => `<div style="padding:5px 8px;border-bottom:1px solid #1d2635;color:#dbe7f5;font:12px monospace">${escapeHtml(address)}</div>`).join('') || '<div style="padding:8px;color:#718096">No web addresses returned</div>';
    const providerRows = providers.slice(0, 5).map(provider => `<div style="display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #1d2635"><span style="color:#dbe7f5">${escapeHtml(provider?.organization || provider?.domain || 'Unknown')}</span><span style="color:#718096">AS${escapeHtml(provider?.asNumber || '—')}</span></div>`).join('') || '<div style="color:#718096">No provider data</div>';
    const ns = nameservers.slice(0, 6).map(item => escapeHtml(item)).join(' · ') || 'No nameservers returned';
    return `<div style="font-family:Inter,Arial,sans-serif;background:#0b1220;color:#dbe7f5;border:1px solid #25334a;border-radius:14px;overflow:hidden;max-width:390px">
<div style="padding:14px 16px;background:linear-gradient(135deg,#111d31,#0b1220);border-bottom:1px solid #25334a;display:flex;align-items:center;justify-content:space-between">
  <div><div style="font-size:10px;letter-spacing:2px;color:#72819a">CRYSNOVA NETWORK TOOLS</div><div style="font-size:19px;font-weight:800;margin-top:4px">HOST CHECK</div></div>
  <div style="padding:6px 10px;border:1px solid ${accent}66;border-radius:999px;color:${accent};font-size:11px;font-weight:700">${online ? '● RESOLVED' : '● FAILED'}</div>
</div>
<div style="padding:14px 16px"><div style="font-size:13px;color:#9db0c8;margin-bottom:10px">Target</div><div style="font:700 17px monospace;color:#fff;word-break:break-all">${escapeHtml(domain)}</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0"><div style="padding:10px;background:#111b2c;border:1px solid #1d2a40;border-radius:9px"><div style="font-size:10px;color:#72819a">WEB IPS</div><b style="font-size:18px;color:${accent}">${addresses.length}</b></div><div style="padding:10px;background:#111b2c;border:1px solid #1d2a40;border-radius:9px"><div style="font-size:10px;color:#72819a">IPV6 WEB</div><b style="font-size:18px;color:${accent}">${result?.ipv6_support?.web ? 'YES' : 'NO'}</b></div></div>
<div style="font-size:10px;letter-spacing:1px;color:#72819a;margin:12px 0 6px">WEB ADDRESSES</div><div style="background:#0f1929;border:1px solid #1d2a40;border-radius:8px;overflow:hidden">${addressRows}</div>
<div style="font-size:10px;letter-spacing:1px;color:#72819a;margin:14px 0 6px">NETWORK PROVIDERS</div><div style="background:#0f1929;border:1px solid #1d2a40;border-radius:8px;padding:4px 8px">${providerRows}</div>
<div style="font-size:10px;letter-spacing:1px;color:#72819a;margin:14px 0 6px">NAMESERVERS</div><div style="color:#dbe7f5;font:12px monospace;word-break:break-word">${ns}</div></div>
<div style="padding:9px 16px;border-top:1px solid #25334a;color:#52647d;font-size:10px">Source: prexzy hostcheck · DNS and hosting metadata</div></div>`;
}

module.exports = {
    name: 'hostcheck',
    alias: ['host', 'domaincheck', 'dnscheck'],
    category: 'Tools',
    desc: 'Inspect DNS, IP, IPv6, hosting provider, and nameserver data for a domain',
    usage: '.hostcheck <domain>',
    async execute(sock, m, { args = [], reply }) {
        const domain = normalizeDomain(args.join(' '));
        if (!domain || !domain.includes('.')) return reply('Usage: .hostcheck <domain>\nExample: .hostcheck example.com');
        try {
            const response = await request('/tools/hostcheck', { domain }, {
                timeout: 45000,
                headers: { 'User-Agent': 'CODY/2.0', Accept: 'application/json' }
            });
            const result = response?.data;
            if (response?.status < 200 || response?.status >= 300 || result?.status === false) {
                throw new Error(result?.message || result?.error || `HTTP ${response?.status || 'unknown'}`);
            }
            if (typeof sock?.sendHtmlMessage === 'function') return sock.sendHtmlMessage(m.chat, { html: formatHtml(result, domain) }, { quoted: m });
            return reply(formatPlain(result, domain));
        } catch (error) {
            console.error('[HOSTCHECK]', error.message);
            return reply(`✘ Host check failed for ${domain}: ${error.message}`);
        }
    },
    _internals: { normalizeDomain, formatPlain, formatHtml, collectAddresses, collectNameservers }
};
