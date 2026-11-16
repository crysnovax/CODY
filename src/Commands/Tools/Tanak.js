const axios = require('axios');

// Torah + Nevi'im + Ketuvim book mappings
const BOOK_MAP = {
    'gen': 'Genesis', 'exo': 'Exodus', 'lev': 'Leviticus', 'num': 'Numbers', 'deut': 'Deuteronomy',
    'josh': 'Joshua', 'judg': 'Judges', '1sam': '1 Samuel', '2sam': '2 Samuel',
    '1kgs': '1 Kings', '2kgs': '2 Kings', 'isa': 'Isaiah', 'jer': 'Jeremiah',
    'ezek': 'Ezekiel', 'hos': 'Hosea', 'joel': 'Joel', 'amos': 'Amos',
    'obad': 'Obadiah', 'jonah': 'Jonah', 'mic': 'Micah', 'nah': 'Nahum',
    'hab': 'Habakkuk', 'zeph': 'Zephaniah', 'hag': 'Haggai', 'zech': 'Zechariah', 'mal': 'Malachi',
    'ps': 'Psalms', 'prov': 'Proverbs', 'job': 'Job', 'song': 'Song of Songs',
    'ruth': 'Ruth', 'lam': 'Lamentations', 'eccl': 'Ecclesiastes', 'esth': 'Esther',
    'dan': 'Daniel', 'ezra': 'Ezra', 'neh': 'Nehemiah', '1chr': '1 Chronicles', '2chr': '2 Chronicles'
};

function parseReference(text) {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 2) return null;
    
    let bookEnd = 0;
    for (let i = 0; i < parts.length; i++) {
        if (/^\d/.test(parts[i]) || parts[i].includes(':')) { bookEnd = i; break; }
        bookEnd = i + 1;
    }
    
    let book = parts.slice(0, bookEnd).join('').toLowerCase();
    const reference = parts.slice(bookEnd).join('');
    
    const match = reference.match(/(\d+)[:\s](\d+)/);
    if (!match) return null;
    
    const chapter = parseInt(match[1]);
    const verse = parseInt(match[2]);
    const fullBook = BOOK_MAP[book] || book.charAt(0).toUpperCase() + book.slice(1);
    
    return { book, fullBook, chapter, verse };
}

module.exports = {
    name: 'tanak',
    alias: ['tanakh', 'torah', 'hebrew', 'jewish'],
    desc: 'Get Tanakh (Hebrew Bible) verses',
    category: 'Search',
    usage: '.tanak <book chapter:verse> | .tanak list',
    reactions: { start: '✡️', success: '✨', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const text = args.join(' ').trim();
        
        if (!text) {
            return reply(
                `╭─❍ *TANAKH ✡️*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}tanak <book ch:vs>\n│\n` +
                `│ ✪ *Examples:*\n` +
                `│ ${prefix}tanak gen 1:1\n` +
                `│ ${prefix}tanak ps 23 1\n` +
                `│ ${prefix}tanak isa 40 31\n│\n` +
                `│ 📜 *Torah • Nevi'im • Ketuvim*\n` +
                `╰──────────────────`
            );
        }

        // ── LIST BOOKS ────────────────────────────────────────────
        if (text === 'list') {
            const sections = {
                '📜 Torah': ['gen', 'exo', 'lev', 'num', 'deut'],
                '📜 Nevi\'im': ['josh', 'judg', '1sam', '2sam', '1kgs', '2kgs', 'isa', 'jer', 'ezek'],
                '📜 Ketuvim': ['ps', 'prov', 'job', 'song', 'ruth', 'lam', 'eccl', 'esth', 'dan', 'ezra', 'neh', '1chr', '2chr']
            };

            const items = [];
            for (const [section, books] of Object.entries(sections)) {
                for (const b of books) {
                    items.push(`${BOOK_MAP[b]} — ${section}`);
                }
            }

            await sock.sendList(m.chat, '✡️ Books of the Tanakh', items, m);

            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
            return;
        }

        // ── GET VERSE ─────────────────────────────────────────────
        const ref = parseReference(text);
        if (!ref) return reply('`✘ Format: book ch:vs (e.g., gen 1:1, ps 23 1)`');

        await sock.sendMessage(m.chat, { react: { text: '✡️', key: m.key } });

        try {
            // Use Sefaria API for Tanakh
            const res = await axios.get(`https://www.sefaria.org/api/texts/${encodeURIComponent(`${ref.fullBook}.${ref.chapter}.${ref.verse}`)}`, {
                params: { context: 0 },
                timeout: 10000,
                headers: { 'Accept': 'application/json' }
            });

            const data = res.data;
            const hebrew = data.he || data.text || '';
            const english = data.text || '';

            await sock.sendMessage(m.chat, {
                headerText: `## ✡️ ${ref.fullBook} ${ref.chapter}:${ref.verse}`,
                contentText: '---',
                title: '📜 Tanakh (Hebrew Bible)',
                table: [
                    ['📖 Book', ref.fullBook],
                    ['📜 Chapter', ref.chapter],
                    ['📍 Verse', ref.verse],
                    ['🕍 Hebrew', Array.isArray(hebrew) ? hebrew[0] : hebrew],
                    ['📝 English', Array.isArray(english) ? english[0] : english]
                ],
                footerText: '💡 SWIPE ⇆ • Torah • Nevi\'im • Ketuvim'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } });

        } catch (error) {
            console.error('[TANAK ERROR]', error.message);
            
            // Fallback to Bible API
            try {
                const fallback = await axios.get(`https://bible-api.com/${encodeURIComponent(ref.book + '+' + ref.chapter + ':' + ref.verse)}`, {
                    timeout: 10000
                });
                const fbData = fallback.data;
                
                if (fbData?.verses?.length) {
                    await sock.sendMessage(m.chat, {
                        headerText: `## ✡️ ${fbData.reference}`,
                        contentText: '---',
                        title: '📜 Tanakh (via Bible API)',
                        table: [
                            ['📖 Book', ref.fullBook],
                            ['📜 Chapter', ref.chapter],
                            ['📍 Verse', ref.verse],
                            ['📝 Text', fbData.verses[0].text]
                        ],
                        footerText: '💡 Torah • Nevi\'im • Ketuvim'
                    }, { quoted: m });

                    await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
                    return;
                }
            } catch {}

            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply('`✘ Failed to fetch verse`');
        }
    }
};
