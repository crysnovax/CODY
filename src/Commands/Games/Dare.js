const DARES = [
    'Send a voice note singing your favorite song',
    'Text your crush "I had a dream about you"',
    'Post "I love CRYSNOVA AI" as your status',
    'Send a selfie making a funny face',
    'Call someone and say "I just called to say I love you"',
    'Do 10 push-ups right now',
    'Send a voice note imitating a celebrity',
    'Change your group name to "CRYSNOVA Fan Club" for 1 hour',
    'Send a message using only emojis for the next 5 minutes',
    'Take a photo of your shoe and post it as your profile picture',
    'Say "I am the greatest" out loud 3 times',
    'Send a voice note telling a joke',
    'Do your best robot dance and describe it in text',
    'Type the alphabet backwards in the chat',
    'Send a message to the last person you DM\'d saying "You\'re awesome!"'
];

module.exports = {
    name: 'dare',
    alias: ['dares', 'dodare'],
    desc: 'Random dare challenges',
    category: 'Games',
    usage: `.dare`,
    reactions: { start: '😈', success: '🎭', error: '🏗️' },

    execute: async (sock, m, { reply }) => {
        await sock.sendMessage(m.chat, { react: { text: '😈', key: m.key } });

        const dare = DARES[Math.floor(Math.random() * DARES.length)];

        await sock.sendMessage(m.chat, {
            headerText: `## 😈 Dare`,
            contentText: '---',
            title: '🔥 I Dare You!',
            table: [
                ['😈 Challenge', dare],
                ['✅ Done?', 'React 👍'],
                ['❌ Skipped?', 'React 👎']
            ],
            footerText: '💡 .dare for another | .truth for a question'
        }, { quoted: m });

        await sock.sendMessage(m.chat, { react: { text: '😈', key: m.key } });
    }
};
