'use strict';
const { request } = require('../../Plugin/prexzy');
module.exports = {
    name: 'applemusicsearch',
    alias: ['amsearch', 'ams'],
    category: 'search',
    desc: 'Search Apple Music',
    usage: `${process.env.PREFIX || '.'}amsearch <song or artist>`,
    execute: async (sock, m, { args, reply }) => {
        const q = args.join(' ').trim();
        if (!q) return reply(`Usage: ${process.env.PREFIX || '.'}amsearch <song or artist>`);
        try {
            const r = await request('/search/applemusic', { q, region: 'us' });
            const d = r.data;
            if (!d?.status) throw Error(d?.error || `HTTP ${r.status}`);
            const rows = d.data || [];
            if (!rows.length) return reply(`⌕ No Apple Music results for: ${q}`);
            return reply(`♫ *APPLE MUSIC: ${q}*\n\n${rows.slice(0, 8).map((x, i) => `${i + 1}. *${x.title || 'Untitled'}*\n${x.artist || ''}\n${x.link || ''}`).join('\n\n')}`);
        } catch (e) {
            console.error('[APPLE MUSIC SEARCH]', e.message);
            return reply('✘ Apple Music search failed.');
        }
    }
};
