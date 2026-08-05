const WORDS = [
    'listen', 'triangle', 'funeral', 'dormitory', 'the eyes',
    'debit card', 'astronomer', 'the classroom', 'election results',
    'silent', 'integral', 'real fun', 'dirty room', 'they see',
    'bad credit', 'moon starer', 'schoolmaster', 'lies let\'s recount'
];

function shuffleWord(word) {
    const letters = word.replace(/[^a-zA-Z]/g, '').split('');
    for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    return letters.join('');
}

module.exports = {
    name: 'anagram',
    alias: ['scramble', 'unscramble', 'wordmix'],
    desc: 'Guess the original word from scrambled letters',
    category: 'Games',
    usage: `.anagram`,
    reactions: { start: '🔤', success: '🎭', error: '🏗️' },

    execute: async (sock, m, { reply }) => {
        await sock.sendMessage(m.chat, { react: { text: '🔤', key: m.key } });

        const index = Math.floor(Math.random() * (WORDS.length / 2)) * 2;
        const answer = WORDS[index];
        const scrambled = shuffleWord(answer);

        await sock.sendMessage(m.chat, {
            headerText: `## 🔤 Anagram Challenge`,
            contentText: '---',
            title: '🧠 Unscramble This!',
            table: [
                ['🔤 Scrambled', scrambled.toUpperCase()],
                ['📝 Letters', scrambled.length + ' letters'],
                ['💡 Hint', '_Reply .hint to see answer_']
            ],
            footerText: '💡 Use .anagram for another!'
        }, { quoted: m });

        if (!global.anagramAnswers) global.anagramAnswers = {};
        global.anagramAnswers[m.chat] = answer;

        await sock.sendMessage(m.chat, { react: { text: '🔖', key: m.key } });
    }
};
