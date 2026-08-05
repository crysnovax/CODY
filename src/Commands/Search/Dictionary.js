const axios = require('axios');

module.exports = {
    name: 'dictionary',
    alias: ['dict', 'define', 'meaning'],
    desc: 'Get word definitions and phonetics',
    category: 'Search',
    usage: `.dictionary <word>`,
    reactions: { start: '📖', success: '✨', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        const word = args[0]?.trim().toLowerCase();
        
        if (!word) {
            return reply(
                `╭─❍ *DICTIONARY*\n│\n` +
                `│ ⚉ *Usage:* ${prefix}dictionary <word>\n│\n` +
                `│ ✪ *Examples:*\n` +
                `│ ${prefix}dictionary hello\n` +
                `│ ${prefix}dictionary love\n` +
                `│ ${prefix}dictionary serendipity\n│\n` +
                `│ 📖 *Free Dictionary API*\n` +
                `╰──────────────────`
            );
        }

        await sock.sendMessage(m.chat, { react: { text: '📖', key: m.key } });

        try {
            const res = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
                timeout: 10000,
                headers: { 'Accept': 'application/json' }
            });

            const data = res.data?.[0];
            if (!data) {
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
                return reply(`\`✘ No definition found for "${word}"\``);
            }

            const phonetics = data.phonetics?.map(p => p.text).filter(Boolean).join(', ') || 'N/A';
            const audioUrl = data.phonetics?.find(p => p.audio)?.audio || '';
            
            // Get first meaning
            const meaning = data.meanings?.[0];
            const partOfSpeech = meaning?.partOfSpeech || 'N/A';
            const definition = meaning?.definitions?.[0]?.definition || 'No definition';
            const example = meaning?.definitions?.[0]?.example || 'No example';
            const synonyms = meaning?.synonyms?.slice(0, 5).join(', ') || 'None';
            const antonyms = meaning?.antonyms?.slice(0, 5).join(', ') || 'None';

            const tableData = [
                ['📖 Word', data.word],
                ['🔊 Phonetic', phonetics],
                ['📝 Type', partOfSpeech],
                ['📚 Definition', definition],
                ['💬 Example', example],
                ['🟢 Synonyms', synonyms],
                ['🔴 Antonyms', antonyms]
            ];

            if (audioUrl) {
                tableData.push(['🔊 Audio', audioUrl]);
            }

            await sock.sendMessage(m.chat, {
                headerText: `## 📖 ${data.word}`,
                contentText: '---',
                title: '📚 Dictionary',
                table: tableData,
                footerText: '💡 Powered by Free Dictionary API'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } });

        } catch (error) {
            console.error('[DICT ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            reply('`✘ Failed to fetch definition`');
        }
    }
};
