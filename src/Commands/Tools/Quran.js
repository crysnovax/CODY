const axios = require('axios');

module.exports = {
    name: 'quran',
    alias: ['koran', 'surah', 'ayah', 'ayat', 'alkareem'],
    desc: 'Get Quran verses in premium format',
    category: 'Search',
    usage: '.quran <surah:verse> | .quran list',
    reactions: { start: '☪️', success: '✨', error: '🏗️' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const text = args.join(' ').trim().toLowerCase();
        
        if (!text) {
            return reply(
                `╭─❍ *AL-QURAN ☪️*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}quran <surah:verse>\n│\n` +
                `│ ✪ *Examples:*\n` +
                `│ ${prefix}quran 1:1\n` +
                `│ ${prefix}quran 36:1\n` +
                `│ ${prefix}quran 112:1\n` +
                `│ ${prefix}quran 2:255\n` +
                `│ ${prefix}quran list\n│\n` +
                `│ ☪️ *Al-Quran Al-Kareem*\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '☪️', key: m.key } });

        try {
            // ── LIST ALL SURAHS ─────────────────────────────────────
            if (text === 'list') {
                const res = await axios.get('https://api.alquran.cloud/v1/surah', {
                    timeout: 10000,
                    headers: { 'Accept': 'application/json' }
                });

                const surahs = res.data?.data;
                if (!surahs) throw new Error('No data');

                const items = surahs.map(s =>
                    `${s.number}. ${s.englishName} — ${s.englishNameTranslation} — ${s.name} (${s.numberOfAyahs} ayahs)`
                );
                await sock.sendList(m.chat, '☪️ Al-Quran • 114 Surahs', items, m);

                await sock.sendMessage(m.chat, { react: { text: '🥏', key: m.key } });
                return;
            }

            // ── PARSE SURAH:VERSE ────────────────────────────────────
            const parts = text.split(':');
            if (parts.length < 2) return reply('`✘ Format: surah:verse (e.g., 1:1, 36:1, 112:1)`');

            const surah = parseInt(parts[0]);
            const verse = parseInt(parts[1]);

            if (!surah || !verse || surah < 1 || surah > 114) {
                return reply('`✘ Invalid surah (1-114)`');
            }

            // Get Arabic + English + surah info
            const [arabicRes, englishRes, surahRes] = await Promise.all([
                axios.get(`https://api.alquran.cloud/v1/ayah/${surah}:${verse}/ar.asad`, { timeout: 10000 }),
                axios.get(`https://api.alquran.cloud/v1/ayah/${surah}:${verse}/en.sahih`, { timeout: 10000 }),
                axios.get(`https://api.alquran.cloud/v1/surah/${surah}`, { timeout: 10000 })
            ]);

            const arabic = arabicRes.data?.data?.text || '';
            const english = englishRes.data?.data?.text || '';
            const surahInfo = surahRes.data?.data;

            const tableData = [
                ['📖 Surah', surahInfo?.englishName || `Surah ${surah}`],
                ['🕋 Arabic Name', surahInfo?.name || ''],
                ['🌍 Meaning', surahInfo?.englishNameTranslation || ''],
                ['🏠 Revelation', surahInfo?.revelationType === 'Meccan' ? '🕋 Meccan' : '🕌 Medinan'],
                ['📜 Total Ayahs', String(surahInfo?.numberOfAyahs || '')],
                ['🕋 Arabic', arabic],
                ['📝 English', english]
            ];

            await sock.sendMessage(m.chat, {
                headerText: `## ☪️ ${surahInfo?.englishName || 'Surah'} (${surah}:${verse})`,
                contentText: '---',
                title: '📖 Al-Quran Al-Kareem',
                table: tableData,
                footerText: `💡 SWIPE ⇆ • ${prefix}quran list for all surahs`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } });

        } catch (error) {
            console.error('[QURAN ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply('`✘ Failed to fetch verse. Try again.`');
        }
    }
};
