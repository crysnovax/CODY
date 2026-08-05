const axios = require('axios');

const FALLBACK_TRIVIA = [
    { question: 'What is the capital of Australia?', answer: 'Canberra' },
    { question: 'How many continents are there?', answer: '7' },
    { question: 'What year did World War II end?', answer: '1945' },
    { question: 'What is the largest planet in our solar system?', answer: 'Jupiter' },
    { question: 'Who painted the Mona Lisa?', answer: 'Leonardo da Vinci' },
    { question: 'What is the speed of light in km/s?', answer: '299,792' },
    { question: 'What element does "O" represent on the periodic table?', answer: 'Oxygen' },
    { question: 'What is the longest river in the world?', answer: 'Nile' }
];

module.exports = {
    name: 'trivia',
    alias: ['quiz', 'question', 'triviaquestion'],
    desc: 'Get random trivia questions',
    category: 'Quiz',
    usage: `.trivia`,
    reactions: { start: '❓', success: '🔖', error: '💤' },

    execute: async (sock, m, { reply }) => {
        await sock.sendMessage(m.chat, { react: { text: '❓', key: m.key } });

        try {
            let question, answer;
            
            try {
                const res = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple', { timeout: 8000 });
                const data = res.data?.results?.[0];
                if (data) {
                    question = data.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
                    answer = data.correct_answer;
                }
            } catch {}

            if (!question) {
                const random = FALLBACK_TRIVIA[Math.floor(Math.random() * FALLBACK_TRIVIA.length)];
                question = random.question;
                answer = random.answer;
            }

            // Send question
            await sock.sendMessage(m.chat, {
                headerText: `## ❓ Trivia Question`,
                contentText: '---',
                title: '🧠 Can You Answer?',
                table: [
                    ['❓ Question', question],
                    ['💡 Hint', '_Reply .hint to see the answer_']
                ],
                footerText: '💡 Use .trivia for another question!'
            }, { quoted: m });

            // Store answer temporarily
            if (!global.triviaAnswers) global.triviaAnswers = {};
            global.triviaAnswers[m.chat] = answer;

            await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } });

        } catch (error) {
            await sock.sendMessage(m.chat, { react: { text: '💤', key: m.key } });
            reply('`✘ Failed to get trivia`');
        }
    }
};
