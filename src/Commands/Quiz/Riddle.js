const axios = require('axios');

const FALLBACK_RIDDLES = [
    { riddle: 'I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?', answer: 'Echo' },
    { riddle: 'I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?', answer: 'Map' },
    { riddle: 'The more you take, the more you leave behind. What am I?', answer: 'Footsteps' },
    { riddle: 'I have keys but no locks. I have space but no room. You can enter, but you can\'t go outside. What am I?', answer: 'Keyboard' },
    { riddle: 'What has a head and a tail but no body?', answer: 'Coin' },
    { riddle: 'What gets wetter the more it dries?', answer: 'Towel' },
    { riddle: 'What can travel around the world while staying in a corner?', answer: 'Stamp' },
    { riddle: 'What has many teeth but cannot bite?', answer: 'Comb' }
];

module.exports = {
    name: 'riddle',
    alias: ['riddles', 'puzzle', 'brainteaser'],
    desc: 'Get random riddles with answers',
    category: 'Quiz',
    usage: `.riddle`,
    reactions: { start: '🤔', success: '🔖', error: '🏗️' },

    execute: async (sock, m, { reply }) => {
        await sock.sendMessage(m.chat, { react: { text: '🤔', key: m.key } });

        try {
            let riddle, answer;
            
            try {
                const res = await axios.get('https://riddles-api.vercel.app/random', { timeout: 8000 });
                riddle = res.data?.riddle;
                answer = res.data?.answer;
            } catch {}

            if (!riddle) {
                const random = FALLBACK_RIDDLES[Math.floor(Math.random() * FALLBACK_RIDDLES.length)];
                riddle = random.riddle;
                answer = random.answer;
            }

            await sock.sendMessage(m.chat, {
                headerText: `## 🤔 Riddle Me This`,
                contentText: '---',
                title: '🧠 Can You Solve It?',
                table: [
                    ['🤔 Riddle', riddle],
                    ['💡 Hint', '_Reply .hint to reveal answer_']
                ],
                footerText: '💡 Use .riddle for another!'
            }, { quoted: m });

            if (!global.riddleAnswers) global.riddleAnswers = {};
            global.riddleAnswers[m.chat] = answer;

            await sock.sendMessage(m.chat, { react: { text: '🎭', key: m.key } });

        } catch (error) {
            await sock.sendMessage(m.chat, { react: { text: '😴', key: m.key } });
            reply('`✘ Failed to get riddle`');
        }
    }
};
