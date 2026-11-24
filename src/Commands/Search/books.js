/**
 * book.js — CODY AI Book / Novel Downloader
 * Full code - Default 1-100, --500 for more, no unrelated, no hardcoded query
 */

const buildRichBookContent = ({ query, total, showing, docs, start = 0 }) => {
    return {
        title: `📚 Book Search - ${query} (${start + 1}-${start + docs.length} of ${showing})`,
        body: `Found ${total} total for "${query}" — showing ${start + 1} to ${start + docs.length}. Use --500 for more.`,
        sections: [{
            type: 'list',
            title: 'Books',
            items: docs.map((d, i) => `${start + i + 1}. ${d.title || d.identifier}\nID: ${d.identifier}`)
        }],
        footer: 'Reply .book <number> to download'
    };
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = {
    name: 'book',
    alias: ['novel', 'getbook', 'dlbook', 'ebook'],
    category: 'Downloader',
    desc: 'Search and download any book / novel PDF',
    usage: '.book <book name> | .book <book name> --500 | .book <number> | .book <identifier>',
    reactions: { start: '📚', success: '📄', error: '🙊' },

    execute: async (sock, m, { reply, args }) => {
        let limit = 100;
        const cleanArgs = [];
        for (const a of args) {
            const mm = a.match(/^--(\d+)$/);
            if (mm) limit = Math.max(1, Math.min(5000, parseInt(mm[1], 10)));
            else cleanArgs.push(a);
        }
        const query = cleanArgs.join(' ').trim();

        if (!query) return reply(
            `╭─❍ *BOOK SEARCH*\n│\n` +
            `│ ⚉ *Usage:* .book <book name>\n│\n` +
            `│ ✪ *Example:*\n` +
            `│ • .book 【entity-wimpy kid¦canonical_name=Diary of a Wimpy Kid】\n` +
            `│ • .book pride and prejudice\n` +
            `│ • .book pride and prejudice --500\n` +
            `│ • .book 1\n` +
            `│ • .book wimpykid\n│\n` +
            `│ 📚 *Default 1-100, add --500 for more!*\n` +
            `╰──────────────────`
        );

        await sock.sendMessage(m.chat, { react: { text: '📚', key: m.key } });

        try {
            const chat = m.chat;
            globalThis.__bookSearch = globalThis.__bookSearch || {};
            globalThis.__bookLimit = globalThis.__bookLimit || {};

            const downloadById = async (identifier) => {
                await reply('Downloading PDF for `' + identifier + '`...');
                const metaRes = await fetch(`https://archive.org/metadata/${identifier}`);
                if (!metaRes.ok) throw new Error('Failed to get file list: ' + metaRes.status);
                const meta = await metaRes.json();
                const files = meta.files || [];
                const getPriority = (name) => {
                    const n = name.toLowerCase();
                    if (n.endsWith('_text.pdf')) return 0;
                    if (n.endsWith('.pdf')) return 1;
                    if (n.endsWith('.epub')) return 2;
                    if (n.endsWith('.txt') && !n.includes('_djvu')) return 3;
                    if (n.endsWith('.mobi') || n.endsWith('.azw3')) return 4;
                    if (n.endsWith('_djvu.txt')) return 5;
                    return 99;
                };
                const candidates = files
                    .filter(f => getPriority(f.name) !== 99)
                    .sort((a, b) => getPriority(a.name) - getPriority(b.name) || (b.size || 0) - (a.size || 0))
                    .map(f => ({ name: f.name, url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`, size: f.size || 0 }));
                candidates.push(
                    { name: `${identifier}_text.pdf`, url: `https://archive.org/download/${identifier}/${encodeURIComponent(identifier + '_text.pdf')}`, size: 0 },
                    { name: `${identifier}.pdf`, url: `https://archive.org/download/${identifier}/${encodeURIComponent(identifier + '.pdf')}`, size: 0 },
                    { name: `${identifier}_djvu.txt`, url: `https://archive.org/download/${identifier}/${encodeURIComponent(identifier + '_djvu.txt')}`, size: 0 }
                );
                let lastErr = '';
                for (const cand of candidates) {
                    try {
                        const res = await fetch(cand.url, { redirect: 'follow' });
                        if (!res.ok) { lastErr = 'HTTP ' + res.status; continue; }
                        const ctype = (res.headers.get('content-type') || '').toLowerCase();
                        if (ctype.includes('text/html')) { lastErr = 'HTML error page'; continue; }
                        const buf = Buffer.from(await res.arrayBuffer());
                        if (buf.length < 1000) { lastErr = 'File too small / empty'; continue; }
                        const ext = cand.name.toLowerCase().split('.').pop();
                        const mime = ext === 'pdf' ? 'application/pdf' : ext === 'epub' ? 'application/epub+zip' : 'text/plain';
                        await sock.sendMessage(chat, { document: buf, fileName: cand.name, mimetype: mime, caption: (meta.metadata?.title || cand.name) + ' - ' + Math.round(buf.length / 1024 / 1024) + 'MB' });
                        await sock.sendMessage(m.chat, { react: { text: '📄', key: m.key } });
                        return;
                    } catch (e) { lastErr = e.message; continue; }
                }
                return reply('`✘ This edition na lending-only / no public PDF (' + lastErr + '). Try another number.`');
            };

            if (query.startsWith('http') && query.toLowerCase().includes('.pdf')) {
                const res = await fetch(encodeURI(query));
                if (!res.ok) throw new Error('Failed to download: ' + res.status);
                const buf = Buffer.from(await res.arrayBuffer());
                const fileName = decodeURIComponent(query.split('/').pop().split('?')[0]) || 'book.pdf';
                await sock.sendMessage(chat, { document: buf, fileName, mimetype: 'application/pdf', caption: fileName });
                await sock.sendMessage(m.chat, { react: { text: '📄', key: m.key } });
                return;
            }

            if (/^\d+$/.test(query) && globalThis.__bookSearch[chat]?.length) {
                const idx = Number(query) - 1;
                const picked = globalThis.__bookSearch[chat][idx];
                if (!picked) {
                    const have = globalThis.__bookSearch[chat].length;
                    return reply(`\`✘ No be valid number. You only get 1-${have} for last search. Run .book <name> --500 to get more.\``);
                }
                return downloadById(picked.identifier);
            }

            if (query && !query.includes(' ') && (query.includes('-') || query.includes('archive.org'))) {
                let id = query;
                const match = query.match(/archive\.org\/(?:details|download)\/([^\/\?]+)/);
                if (match) id = match[1];
                return downloadById(id);
            }

            await reply(`Searching for "${query}"... fetching 1-${limit}...`);
            const coreWords = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => !['a','an','the','of','for','to'].includes(w) && w.length > 1);
            const core = coreWords.join(' ');
            const firstWord = coreWords[0] || query;
            const notLending = 'AND NOT collection:inlibrary AND NOT collection:printdisabled';

            // NO hardcoded wimpy - all queries built from YOUR query
            const searchQueries = [
                `${core} AND mediatype:texts ${notLending}`,
                `title:("${query}") AND mediatype:texts ${notLending}`,
                `title:(${core}) AND mediatype:texts ${notLending}`,
                `identifier:(*${firstWord}*) AND mediatype:texts ${notLending}`,
                `(title:(${query}) OR identifier:(${query}) OR description:(${query})) AND mediatype:texts ${notLending}`
            ];

            const fetchOneQuery = async (rawQ) => {
                const out = [];
                let page = 1;
                let totalForQ = Infinity;
                while (out.length < totalForQ && out.length < limit) {
                    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(rawQ)}&fl[]=identifier&fl[]=title&rows=1000&page=${page}&output=json`;
                    const r = await fetch(url);
                    if (!r.ok) break;
                    const data = await r.json();
                    totalForQ = data?.response?.numFound || 0;
                    const docs = data?.response?.docs || [];
                    if (!docs.length) break;
                    out.push(...docs);
                    page++;
                    if (page > 20) break;
                }
                return { docs: out, totalForQ };
            };

            const merged = new Map();
            let archiveTotal = 0;
            for (const sq of searchQueries) {
                if (merged.size >= limit) break;
                const { docs, totalForQ } = await fetchOneQuery(sq);
                archiveTotal = Math.max(archiveTotal, totalForQ);
                for (const d of docs) {
                    if (d.identifier && !merged.has(d.identifier)) merged.set(d.identifier, d);
                    if (merged.size >= limit) break;
                }
            }

            // RELEVANCE FILTER - remove unrelated: title+ID must contain at least one word from query
            let allDocs = [...merged.values()].filter(d => {
                const hay = ((d.title || '') + ' ' + (d.identifier || '')).toLowerCase();
                return coreWords.some(w => hay.includes(w));
            });

            // Sort: titles wey contain ALL words first, then rest
            allDocs.sort((a, b) => {
                const ha = ((a.title || '') + ' ' + (a.identifier || '')).toLowerCase();
                const hb = ((b.title || '') + ' ' + (b.identifier || '')).toLowerCase();
                const sa = coreWords.filter(w => ha.includes(w)).length;
                const sb = coreWords.filter(w => hb.includes(w)).length;
                if (sb !== sa) return sb - sa;
                return (a.title || '').localeCompare(b.title || '');
            });

            allDocs = allDocs.slice(0, limit);
            let showing = allDocs.length;

            if (!allDocs.length) return reply('`✘ No book found for "' + query + '". Try another title.`');

            globalThis.__bookSearch[chat] = allDocs;
            globalThis.__bookLimit[chat] = limit;

            const LIST_CHUNK = 100;
            for (let start = 0; start < allDocs.length; start += LIST_CHUNK) {
                const slice = allDocs.slice(start, start + LIST_CHUNK);
                const listItems = slice.map((d, i) => `${start + i + 1}. ${d.title || d.identifier}\nID: ${d.identifier}`);
                const content = buildRichBookContent({ query, total: archiveTotal, showing, docs: slice, start });
                try {
                    if (typeof sock.sendRichAIResponse === 'function') {
                        await sock.sendRichAIResponse(m.chat, content, m);
                    } else {
                        await sock.sendList(m.chat, `📚 Book Search (${start + 1}-${start + slice.length} of ${showing})`, listItems, m);
                    }
                } catch (richErr) {
                    await sock.sendList(m.chat, `📚 Book Search (${start + 1}-${start + slice.length} of ${showing})`, listItems, m);
                }
                await sleep(600);
            }

            await sock.sendMessage(m.chat, { react: { text: '📄', key: m.key } });

        } catch (err) {
            await sock.sendMessage(m.chat, { react: { text: '🙊', key: m.key } });
            reply(`\`✘ Book search failed — ${err.message}\``);
        }
    }
};
