'use strict';
const bancheck = require('./bancheck');

function safeValue(value) {
    if (value == null) return '';
    return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}
function getAppealFields(data = {}) {
    const records = [data.appeal, data.data?.appeal, data.data, data.result?.appeal, data.result, data].filter(v => v && typeof v === 'object' && !Array.isArray(v));
    const first = names => {
        for (const r of records) for (const n of names) { const v = safeValue(r[n]); if (v) return v; }
        return '';
    };
    return {
        status: first(['appealStatus', 'appeal_status', 'status', 'state']),
        submittedAt: first(['submittedAt', 'submitted_at', 'createdAt', 'created_at']),
        updatedAt: first(['updatedAt', 'updated_at', 'reviewedAt', 'reviewed_at']),
    };
}

module.exports = {
    name: 'banreview',
    alias: ['appealstatus', 'appeal-status'],
    category: 'Owner',
    ownerOnly: true,
    desc: 'Read Baron0 appeal status (proxied)',
    execute: async (_sock, m, { args = [], reply }) => {
        const number = bancheck.resolveTargetNumber(args, m);
        if (!number) return reply('Usage: .banreview <number>');
        try {
            const result = await bancheck.getAppealStatus(number);
            if (!result.found) return reply(`No appeal record for +${number}`);
            const fields = getAppealFields(result.data);
            if (!fields.status) return reply(`Lookup done but no status field for +${number}`);
            return reply(`Appeal status for +${number}: ${fields.status}\n${fields.submittedAt ? `Submitted: ${fields.submittedAt}` : ''}\n${fields.updatedAt ? `Updated: ${fields.updatedAt}` : ''}`.trim());
        } catch (e) {
            return reply(`Appeal lookup failed: ${e.message}`);
        }
    },
    getAppealFields,
};
