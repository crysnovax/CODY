const fs = require('fs');
const path = require('path');

const DIARY_PATH = path.join(process.cwd(), 'database', 'diary.json');

function loadDiary() {
    try { if (fs.existsSync(DIARY_PATH)) return JSON.parse(fs.readFileSync(DIARY_PATH, 'utf8')); } catch {}
    return {};
}

function saveDiary(data) {
    fs.mkdirSync(path.dirname(DIARY_PATH), { recursive: true });
    fs.writeFileSync(DIARY_PATH, JSON.stringify(data, null, 2));
}

// Simple XOR encryption
function encrypt(text, key) {
    return text.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
}

const decrypt = encrypt;

module.exports = {
    name: 'diary',
    alias: ['journal', 'mydiary', 'dnote'],
    category: 'Documents',
    desc: 'Write and read encrypted diary entries',
    usage: '.diary write <password> | <entry>\n.diary read <password> | <date>\n.diary list <password>',

    execute: async (sock, m, { args, reply , prefix}) => {
        const sub = args[0]?.toLowerCase();
        const rest = args.slice(1).join(' ');

        if (sub === 'write') {
            const parts = rest.split('|').map(p => p.trim());
            const password = parts[0];
            const entry = parts.slice(1).join('|').trim();

            if (!password || !entry) return reply('⚉ Usage: .diary write <password> | <entry>');

            const diary = loadDiary();
            const phone = (m.sender || '').split('@')[0];
            if (!diary[phone]) diary[phone] = [];

            const encrypted = Buffer.from(encrypt(entry, password)).toString('base64');
            const date = new Date().toISOString().split('T')[0];
            
            diary[phone].push({ date, entry: encrypted });
            saveDiary(diary);

            return reply(`📔 *Entry saved!*\n📅 Date: ${date}\n🔒 Encrypted with your password`);
        }

        if (sub === 'read') {
            const parts = rest.split('|').map(p => p.trim());
            const password = parts[0];
            const date = parts[1];

            if (!password) return reply('⚉ Usage: .diary read <password> | <date>');

            const diary = loadDiary();
            const phone = (m.sender || '').split('@')[0];
            const entries = diary[phone] || [];

            let filtered = entries;
            if (date) filtered = entries.filter(e => e.date === date);
            if (!filtered.length) return reply('`📔 No entries found`');

            const latest = filtered[filtered.length - 1];
            try {
                const decoded = Buffer.from(latest.entry, 'base64').toString();
                const decrypted = decrypt(decoded, password);
                return reply(`${prefix}📔 *Diary Entry*\n📅 ${latestdate}\n\n${decrypted}`);
            } catch (e) {
                return reply('`🔒 Wrong password or corrupted entry`');
            }
        }

        if (sub === 'list') {
            const password = rest.trim();
            if (!password) return reply('⚉ Usage: .diary list <password>');

            const diary = loadDiary();
            const phone = (m.sender || '').split('@')[0];
            const entries = diary[phone] || [];

            if (!entries.length) return reply('`📔 No diary entries`');

            let list = '📔 *Diary Entries*\n\n';
            entries.forEach((e, i) => {
                try {
                    const decoded = Buffer.from(e.entry, 'base64').toString();
                    const preview = decrypt(decoded, password).substring(0, 30);
                    list += `📅 ${e.date}: ${preview}...\n`;
                } catch {}
            });

            return reply(list);
        }

        return reply('📔 *Diary Commands*\n\n.diary write <pw> | <text>\n.diary read <pw> | <date>\n.diary list <pw>');
    }
};
