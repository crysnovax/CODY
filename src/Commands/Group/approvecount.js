'use strict';

const MAX_APPROVALS_PER_COMMAND = 1000;

function parseCountryCode(value) {
    if (value == null || value === '') return null;
    const raw = String(value).trim();
    const digits = raw.startsWith('+') ? raw.slice(1) : raw;
    return /^\d{1,3}$/.test(digits) ? digits : false;
}

function requestPhoneDigits(request) {
    for (const candidate of [request?.phoneNumber, request?.jid, request?.id]) {
        if (candidate == null) continue;
        let value = String(candidate).trim();
        if (value.endsWith('@lid')) continue;
        if (value.includes('@') && !value.endsWith('@s.whatsapp.net') && !value.endsWith('@c.us')) continue;
        value = value.replace(/:\d+(?=@)/, '').replace(/@(?:s\.whatsapp\.net|c\.us)$/i, '');
        if (!/^\+?[0-9\s().-]+$/.test(value)) continue;
        const digits = value.replace(/\D/g, '');
        if (digits.length >= 7 && digits.length <= 15) return digits;
    }
    return null;
}

module.exports = {
    name: 'approvecount',
    alias: ['approvebatch', 'approvecc'],
    desc: 'Approve a limited number of pending group requests, optionally by country calling code',
    category: 'Group',
    groupOnly: true,
    adminOnly: true,
    usage: '.approvecount <amount 1-1000> [country-code, e.g. +234]',
    execute: async (sock, m, { args = [], reply, prefix = '.' }) => {
        const amount = Number(args[0]);
        const countryCode = parseCountryCode(args[1]);
        if (!Number.isInteger(amount) || amount < 1 || amount > MAX_APPROVALS_PER_COMMAND || countryCode === false || args.length > 2) {
            return reply(`Usage: ${prefix}approvecount <amount 1-${MAX_APPROVALS_PER_COMMAND}> [country-code]\nExample: ${prefix}approvecount 10 +234`);
        }

        try {
            if (typeof sock.groupRequestParticipantsList !== 'function') {
                return reply('This WhatsApp connection cannot list pending join requests.');
            }
            const requests = await sock.groupRequestParticipantsList(m.chat);
            if (!Array.isArray(requests) || !requests.length) return reply('There are no pending join requests.');

            const eligible = requests.filter(request => {
                if (!request?.jid && !request?.id) return false;
                if (!countryCode) return true;
                return requestPhoneDigits(request)?.startsWith(countryCode) || false;
            });
            const selected = eligible.slice(0, amount);
            if (!selected.length) {
                return reply(countryCode
                    ? `No pending requests matched country code +${countryCode}.`
                    : 'No valid pending requests were found.');
            }
            if (typeof sock.groupRequestParticipantsUpdate !== 'function') {
                return reply('This WhatsApp connection cannot approve join requests.');
            }

            const jids = [...new Set(selected.map(request => request.jid || request.id).filter(Boolean))];
            await sock.groupRequestParticipantsUpdate(m.chat, jids, 'approve');
            return reply(`Approved ${jids.length} of up to ${amount} pending request(s)${countryCode ? ` matching +${countryCode}` : ''}.`);
        } catch (error) {
            console.error('[APPROVECOUNT ERROR]', error?.message || error);
            if (/not-authorized|not-authorized/i.test(error?.message || '')) {
                return reply('I need to be an admin to approve join requests.');
            }
            return reply(`Could not approve the selected requests: ${error?.message || 'unknown WhatsApp error'}`);
        }
    },
    parseCountryCode,
    requestPhoneDigits,
};
