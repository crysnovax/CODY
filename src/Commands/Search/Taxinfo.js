const axios = require('axios');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(process.cwd(), 'database', 'timezones.json');

// Tax deadlines by country
const TAX_DEADLINES = {
    'Nigeria': { country: 'Nigeria', deadline: '2026-03-31', timezone: 'Africa/Lagos', currency: '₦', note: 'Companies Income Tax' },
    'USA': { country: 'United States', deadline: '2026-04-15', timezone: 'America/New_York', currency: '$', note: 'Federal Tax Day' },
    'UK': { country: 'United Kingdom', deadline: '2026-01-31', timezone: 'Europe/London', currency: '£', note: 'Self Assessment' },
    'Canada': { country: 'Canada', deadline: '2026-04-30', timezone: 'America/Toronto', currency: 'C$', note: 'Personal Tax' },
    'Australia': { country: 'Australia', deadline: '2025-10-31', timezone: 'Australia/Sydney', currency: 'A$', note: 'Tax Return Due' },
    'India': { country: 'India', deadline: '2025-07-31', timezone: 'Asia/Kolkata', currency: '₹', note: 'ITR Filing' },
    'Germany': { country: 'Germany', deadline: '2026-05-31', timezone: 'Europe/Berlin', currency: '€', note: 'Steuererklärung' },
    'France': { country: 'France', deadline: '2026-05-22', timezone: 'Europe/Paris', currency: '€', note: 'Déclaration' },
    'Japan': { country: 'Japan', deadline: '2026-03-15', timezone: 'Asia/Tokyo', currency: '¥', note: 'Kakutei Shinkoku' },
    'Brazil': { country: 'Brazil', deadline: '2026-04-30', timezone: 'America/Sao_Paulo', currency: 'R$', note: 'Imposto de Renda' },
    'South Africa': { country: 'South Africa', deadline: '2025-11-29', timezone: 'Africa/Johannesburg', currency: 'R', note: 'Provisional Tax' },
    'UAE': { country: 'UAE', deadline: '2025-12-31', timezone: 'Asia/Dubai', currency: 'AED', note: 'Corporate Tax' },
    'Ghana': { country: 'Ghana', deadline: '2026-04-30', timezone: 'Africa/Accra', currency: 'GH₵', note: 'Income Tax Return' },
    'Kenya': { country: 'Kenya', deadline: '2026-06-30', timezone: 'Africa/Nairobi', currency: 'KSh', note: 'Annual ITR' }
};

const REGION_TO_COUNTRY = {
    'lagos': 'Nigeria', 'abuja': 'Nigeria', 'new york': 'USA', 'los angeles': 'USA',
    'london': 'UK', 'toronto': 'Canada', 'sydney': 'Australia', 'mumbai': 'India',
    'berlin': 'Germany', 'paris': 'France', 'tokyo': 'Japan', 'dubai': 'UAE',
    'accra': 'Ghana', 'nairobi': 'Kenya', 'johannesburg': 'South Africa'
};

function getDB() {
    try { if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch {}
    return {};
}

function getDaysUntil(deadline, timezone) {
    const deadlineDate = new Date(deadline + 'T23:59:59');
    const now = new Date();
    const deadlineLocal = new Date(deadlineDate.toLocaleString('en-US', { timeZone: timezone }));
    const nowLocal = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    return Math.ceil((deadlineLocal - nowLocal) / (1000 * 60 * 60 * 24));
}

function formatStatus(days) {
    if (days < 0) return { text: '⚠️ OVERDUE', emoji: '🔴' };
    if (days === 0) return { text: '🚨 DUE TODAY', emoji: '🔴' };
    if (days <= 7) return { text: `⏰ ${days} days left`, emoji: '🟠' };
    if (days <= 30) return { text: `📅 ${days} days left`, emoji: '🟡' };
    return { text: `✅ ${days} days left`, emoji: '🟢' };
}

module.exports = {
    name: 'taxinfo',
    alias: ['tax', 'deadline', 'irs'],
    desc: 'Tax deadlines in your timezone',
    category: 'Info',
    usage: '.taxinfo [country]',
    reactions: { start: '📊', success: '💰', error: '❌' },

    execute: async (sock, m, { args, reply, prefix }) => {
        try {
            const userId = m.sender;
            const db = getDB();
            const userRegion = db[userId] || 'Lagos';
            
            // Determine country
            let country = args.join(' ');
            if (!country) {
                const regionKey = userRegion.toLowerCase().trim();
                country = REGION_TO_COUNTRY[regionKey];
            }

            if (!country || !TAX_DEADLINES[country]) {
                const tableData = [['🌍 Country', '📅 Deadline', '📝 Note']];
                for (const [name, info] of Object.entries(TAX_DEADLINES)) {
                    tableData.push([name, info.deadline, info.note]);
                }

                await sock.sendMessage(m.chat, {
                    headerText: `## 📊 Tax Deadlines`,
                    contentText: '---',
                    title: '🌍 Available Countries',
                    table: tableData,
                    footerText: `💡 Use ${prefix}taxinfo <country> for details`
                }, { quoted: m });

                return;
            }

            const tax = TAX_DEADLINES[country];
            const daysLeft = getDaysUntil(tax.deadline, tax.timezone);
            const status = formatStatus(daysLeft);

            // Get current time in that timezone
            let currentTime = '';
            try {
                const res = await axios.get(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(tax.timezone)}`, { timeout: 8000 });
                const dt = new Date(res.data.datetime);
                currentTime = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tax.timezone });
            } catch {}

            await sock.sendMessage(m.chat, {
                headerText: `## ${status.emoji} ${tax.country}`,
                contentText: '---',
                title: '📊 Tax Information',
                table: [
                    ['🏛️ Country', tax.country],
                    ['📝 Type', tax.note],
                    ['📅 Deadline', tax.deadline],
                    ['⏰ Local Time', currentTime || 'N/A'],
                    ['💰 Currency', tax.currency],
                    ['📊 Status', status.text],
                    ['💡 Tip', 'File early to avoid penalties!']
                ],
                footerText: '💡 Tax deadlines • Plan ahead!'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '💰', key: m.key } });

        } catch (err) {
            console.error('[TAXINFO ERROR]', err);
            await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            reply('`✘ Failed to fetch tax info`');
        }
    }
};
