// File: src/Commands/Interactive/quiz.js

module.exports = {
    name: 'quiz',
    alias: [],
    desc: 'Create a quiz in a newsletter',
    category: 'Interactive',
    groupOnly: false,
    adminOnly: false,

    execute: async (sock, m, { text, reply , prefix}) => {
        try {
            const chat = m.chat;
            
            // Quiz only works in newsletters
            if (!chat.endsWith('@newsletter')) {
                return reply('_⊘ Quiz only works in newsletters/channels._');
            }

            // Parse: question | answer | option1 | option2
            const parts = text.split('|').map(p => p.trim());
            
            if (parts.length < 3) {
                return reply(
                    `Usage: .quiz Question | Correct Answer | Option1 | Option2\n\n` +
                    `Example: .quiz Is the sky blue? | Yes | Yes | No`
                );
            }

            const question = parts[0];
            const correctAnswer = parts[1];
            const options = parts.slice(2, 4);

            await sock.sendMessage(chat, {
                poll: {
                    name: question,
                    values: options,
                    correctAnswer: correctAnswer,
                    pollType: 1
                }
            });

        } catch (err) {
            console.error('[QUIZ ERROR]', err);
            reply(`${prefix}Error: ${errmessage}`);
        }
    }
};
