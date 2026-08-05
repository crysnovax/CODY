const axios = require('axios');

const FALLBACK_FACTS = [
    'A day on Venus is longer than a year on Venus.',
    'Octopuses have three hearts and blue blood.',
    'Bananas are berries, but strawberries aren\'t.',
    'The Eiffel Tower grows 15 cm in summer due to heat expansion.',
    'Water can boil and freeze at the same time (triple point).',
    'Wombat poop is cube-shaped to prevent it from rolling away.',
    'The human nose can detect over 1 trillion different scents.',
    'Lightning strikes the Earth about 100 times every second.',
    'Honey never spoils — archaeologists found 3000-year-old honey still edible.',
    'The inventor of the frisbee was turned into a frisbee after he died.'
];

module.exports = {
    name: 'fact',
    alias: ['facts', 'randomfact', 'didyouknow'],
    desc: 'Get random interesting facts',
    category: 'Fun',
    usage: `.fact`,
    reactions: { start: '🧠', success: '🎭', error: '💤' },

    execute: async (sock, m, { reply }) => {
        await sock.sendMessage(m.chat, { react: { text: '🧠', key: m.key } });

        try {
            // Try API first
            let fact = null;
            let source = '';
            
            try {
                const res = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', {
                    timeout: 8000,
                    headers: { 'Accept': 'application/json' }
                });
                fact = res.data?.text;
                source = 'uselessfacts';
            } catch {
                // Fallback to local facts
                fact = FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
                source = 'local';
            }

            if (!fact) throw new Error('No fact available');

            await sock.sendMessage(m.chat, {
                headerText: `## 🧠 Random Fact`,
                contentText: '---',
                title: '💡 Did You Know?',
                table: [
                    ['📝 Fact', fact],
                    ['📡 Source', source === 'uselessfacts' ? 'UselessFacts API' : 'CRYSNOVA Knowledge Base']
                ],
                footerText: '💡 SWIPE ⇆ • Use .fact for another!'
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });

        } catch (error) {
            console.error('[FACT ERROR]', error.message);
            await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            
            // Show a fallback fact anyway
            const fallback = FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
            reply(
                `╭─❍ *RANDOM FACT*\n│\n` +
                `│ 💡 ${fallback}\n│\n` +
                `│ 📡 CRYSNOVA Knowledge Base\n` +
                `╰──────────────────`
            );
        }
    }
};
