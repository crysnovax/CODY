const axios = require('axios');

// Book mappings remain the same
const BOOK_MAP = {
    'gen': 'Genesis', 'exo': 'Exodus', 'lev': 'Leviticus', 'num': 'Numbers',
    'deut': 'Deuteronomy', 'josh': 'Joshua', 'judg': 'Judges', 'ruth': 'Ruth',
    '1sam': '1 Samuel', '2sam': '2 Samuel', '1kgs': '1 Kings', '2kgs': '2 Kings',
    '1chr': '1 Chronicles', '2chr': '2 Chronicles', 'ezra': 'Ezra', 'neh': 'Nehemiah',
    'esth': 'Esther', 'job': 'Job', 'ps': 'Psalms', 'psalm': 'Psalms', 'prov': 'Proverbs',
    'eccl': 'Ecclesiastes', 'song': 'Song of Solomon', 'isa': 'Isaiah', 'jer': 'Jeremiah',
    'lam': 'Lamentations', 'ezek': 'Ezekiel', 'dan': 'Daniel', 'hos': 'Hosea',
    'joel': 'Joel', 'amos': 'Amos', 'obad': 'Obadiah', 'jonah': 'Jonah',
    'mic': 'Micah', 'nah': 'Nahum', 'hab': 'Habakkuk', 'zeph': 'Zephaniah',
    'hag': 'Haggai', 'zech': 'Zechariah', 'mal': 'Malachi',
    'matt': 'Matthew', 'mark': 'Mark', 'luke': 'Luke', 'john': 'John',
    'acts': 'Acts', 'rom': 'Romans', '1cor': '1 Corinthians', '2cor': '2 Corinthians',
    'gal': 'Galatians', 'eph': 'Ephesians', 'phil': 'Philippians', 'col': 'Colossians',
    '1thess': '1 Thessalonians', '2thess': '2 Thessalonians', '1tim': '1 Timothy',
    '2tim': '2 Timothy', 'titus': 'Titus', 'philem': 'Philemon', 'heb': 'Hebrews',
    'jas': 'James', '1pet': '1 Peter', '2pet': '2 Peter', '1john': '1 John',
    '2john': '2 John', '3john': '3 John', 'jude': 'Jude', 'rev': 'Revelation'
};

const API_BOOK_MAP = {
    'genesis': 'Genesis', 'exodus': 'Exodus', 'leviticus': 'Leviticus', 'numbers': 'Numbers',
    'deuteronomy': 'Deuteronomy', 'joshua': 'Joshua', 'judges': 'Judges', 'ruth': 'Ruth',
    '1 samuel': '1 Samuel', '2 samuel': '2 Samuel', '1 kings': '1 Kings', '2 kings': '2 Kings',
    '1 chronicles': '1 Chronicles', '2 chronicles': '2 Chronicles', 'ezra': 'Ezra', 'nehemiah': 'Nehemiah',
    'esther': 'Esther', 'job': 'Job', 'psalms': 'Psalms', 'psalm': 'Psalms', 'proverbs': 'Proverbs',
    'ecclesiastes': 'Ecclesiastes', 'song of solomon': 'Song of Solomon', 'isaiah': 'Isaiah', 'jeremiah': 'Jeremiah',
    'lamentations': 'Lamentations', 'ezekiel': 'Ezekiel', 'daniel': 'Daniel', 'hosea': 'Hosea',
    'joel': 'Joel', 'amos': 'Amos', 'obadiah': 'Obadiah', 'jonah': 'Jonah',
    'micah': 'Micah', 'nahum': 'Nahum', 'habakkuk': 'Habakkuk', 'zephaniah': 'Zephaniah',
    'haggai': 'Haggai', 'zechariah': 'Zechariah', 'malachi': 'Malachi',
    'matthew': 'Matthew', 'mark': 'Mark', 'luke': 'Luke', 'john': 'John',
    'acts': 'Acts', 'romans': 'Romans', '1 corinthians': '1 Corinthians', '2 corinthians': '2 Corinthians',
    'galatians': 'Galatians', 'ephesians': 'Ephesians', 'philippians': 'Philippians', 'colossians': 'Colossians',
    '1 thessalonians': '1 Thessalonians', '2 thessalonians': '2 Thessalonians', '1 timothy': '1 Timothy',
    '2 timothy': '2 Timothy', 'titus': 'Titus', 'philemon': 'Philemon', 'hebrews': 'Hebrews',
    'james': 'James', '1 peter': '1 Peter', '2 peter': '2 Peter', '1 john': '1 John',
    '2 john': '2 John', '3 john': '3 John', 'jude': 'Jude', 'revelation': 'Revelation'
};

function parseReference(text) {
    const input = text.trim();
    const normalized = input.toLowerCase().replace(/\s+/g, ' ').trim();
    
    const match = normalized.match(/^(\d?\s*[a-z]+)\s+(\d+)[\s:](\d+)(?:\s*-\s*(\d+))?$/);
    
    if (!match) {
        const altMatch = normalized.match(/^(\d?[a-z]+)\s+(\d+)[\s:](\d+)(?:\s*-\s*(\d+))?$/);
        if (!altMatch) return null;
        
        const bookPart = altMatch[1];
        const chapter = parseInt(altMatch[2]);
        const verse = parseInt(altMatch[3]);
        const endVerse = altMatch[4] ? parseInt(altMatch[4]) : null;
        
        let fullBook = BOOK_MAP[bookPart] || API_BOOK_MAP[bookPart];
        let apiBook = bookPart;
        
        if (!fullBook) {
            const numPrefix = bookPart.match(/^(\d)([a-z]+)$/);
            if (numPrefix) {
                const spaced = `${numPrefix[1]} ${numPrefix[2]}`;
                fullBook = API_BOOK_MAP[spaced];
                if (fullBook) apiBook = spaced;
            }
        }
        
        if (!fullBook) {
            fullBook = bookPart.charAt(0).toUpperCase() + bookPart.slice(1);
        }
        
        return { book: apiBook, fullBook, chapter, verse, endVerse, isRange: !!endVerse };
    }
    
    const bookPart = match[1].trim();
    const chapter = parseInt(match[2]);
    const verse = parseInt(match[3]);
    const endVerse = match[4] ? parseInt(match[4]) : null;
    
    const bookNoSpace = bookPart.replace(/\s/g, '');
    let fullBook = BOOK_MAP[bookNoSpace] || API_BOOK_MAP[bookPart];
    let apiBook = bookPart;
    
    if (!fullBook) {
        fullBook = bookPart.charAt(0).toUpperCase() + bookPart.slice(1);
    }
    
    return { book: apiBook, fullBook, chapter, verse, endVerse, isRange: !!endVerse };
}

// Split long text into chunks
function splitVerses(verses, maxLen = 300) {
    const chunks = [];
    let currentChunk = '';
    
    for (const v of verses) {
        const line = `[${v.verse}] ${v.text.replace(/\n/g, ' ').trim()}\n\n`;
        if ((currentChunk + line).length > maxLen && currentChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = line;
        } else {
            currentChunk += line;
        }
    }
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

module.exports = {
    name: 'bible',
    alias: ['verse', 'scripture', 'bibleverse'],
    desc: 'Get Bible verses in premium format (auto-splits long text)',
    category: 'Search',
    usage: '.bible John 3:16 | .bible 2 Timothy 3:15-21 | .bible ps 23 1',
    reactions: { start: '📖', success: '✨', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const text = args.join(' ').trim();
        
        if (!text) {
            return reply(
                `╭─❍ *BIBLE VERSE*\n│\n` +
                `│ ⚉ ${prefix}bible <reference>\n│\n` +
                `│ ✪ John 3:16 | 2 Timothy 3:15-21\n│\n` +
                `│ 📖 *Holy Bible (KJV)*\n` +
                `╰──────────────────`
            );
        }

        const ref = parseReference(text);
        if (!ref) return reply('`✘ Invalid format. Use: John 3:16 or 2 Timothy 3:15-21`');

        await sock.sendMessage(m.chat, { react: { text: '📖', key: m.key } });

        try {
            // Fetch verses - for ranges, get individual verses
            let verses = [];
            
            if (ref.isRange) {
                for (let v = ref.verse; v <= ref.endVerse; v++) {
                    try {
                        const res = await axios.get(
                            `https://bible-api.com/${encodeURIComponent(ref.fullBook)}+${ref.chapter}:${v}`,
                            { params: { translation: 'kjv' }, timeout: 8000, headers: { 'Accept': 'application/json' } }
                        );
                        if (res.data?.verses?.length) {
                            verses.push(res.data.verses[0]);
                        }
                    } catch {}
                }
            } else {
                const res = await axios.get(
                    `https://bible-api.com/${encodeURIComponent(ref.fullBook)}+${ref.chapter}:${ref.verse}`,
                    { params: { translation: 'kjv' }, timeout: 8000, headers: { 'Accept': 'application/json' } }
                );
                if (res.data?.verses?.length) {
                    verses = res.data.verses;
                }
            }

            if (!verses.length) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`\`✘ Verse not found: ${ref.fullBook} ${ref.chapter}:${ref.verse}\``);
            }

            const verseChunks = splitVerses(verses);
            const totalParts = verseChunks.length;
            const refDisplay = ref.isRange 
                ? `${ref.fullBook} ${ref.chapter}:${ref.verse}-${ref.endVerse}`
                : `${ref.fullBook} ${ref.chapter}:${ref.verse}`;

            // Send first part with full info
            await sock.sendRichAIResponse(m.chat, {
                list: {
                    title: `📖 ${refDisplay}${totalParts > 1 ? ` (1/${totalParts})` : ''} | 🙏 Holy Bible (KJV)`,
                    items: [
                        `📖 Book: ${ref.fullBook}`,
                        `📜 Chapter: ${ref.chapter}`,
                        `📍 Verse(s): ${ref.isRange ? `${ref.verse}-${ref.endVerse}` : String(ref.verse)}`,
                        `📝 ${verseChunks[0]}`
                    ]
                }
            });

            // Send remaining parts if any
            for (let i = 1; i < verseChunks.length; i++) {
                await sock.sendRichAIResponse(m.chat, {
                    list: {
                        title: `📖 ${refDisplay} (${i + 1}/${totalParts}) | 🙏 Holy Bible (KJV)`,
                        items: [
                            `📝 ${verseChunks[i]}`
                        ]
                    }
                });
            }

            await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } });

        } catch (error) {
            console.error('[BIBLE ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply('`✘ Failed to fetch verse. Try again.`');
        }
    }
};
