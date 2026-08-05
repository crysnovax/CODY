module.exports = {
    name: 'hint',
    alias: ['answer', 'reveal'],
    desc: 'Reveal answer for games (trivia, riddle, anagram)',
    category: 'Games',
    usage: `.hint`,
    reactions: { start: '💡', success: '🎭', error: '😴' },

    execute: async (sock, m, { reply }) => {
        let answer = null;
        let game = '';

        if (global.triviaAnswers?.[m.chat]) {
            answer = global.triviaAnswers[m.chat];
            game = 'Trivia';
            delete global.triviaAnswers[m.chat];
        } else if (global.riddleAnswers?.[m.chat]) {
            answer = global.riddleAnswers[m.chat];
            game = 'Riddle';
            delete global.riddleAnswers[m.chat];
        } else if (global.anagramAnswers?.[m.chat]) {
            answer = global.anagramAnswers[m.chat];
            game = 'Anagram';
            delete global.anagramAnswers[m.chat];
        }

        if (!answer) {
            return reply('`✘ No active game. Play .trivia, .riddle, or .anagram first!`');
        }

        await sock.sendMessage(m.chat, { react: { text: '💡', key: m.key } });

        await sock.sendMessage(m.chat, {
            headerText: `## 💡 ${game} Answer`,
            contentText: '---',
            title: '🎭 The Answer Is:',
            table: [
                ['❓ Game', game],
                ['✅ Answer', answer]
            ],
            footerText: '💡 Play again! .trivia | .riddle | .anagram'
        }, { quoted: m });

        await sock.sendMessage(m.chat, { react: { text: '🎭', key: m.key } });
    }
};
