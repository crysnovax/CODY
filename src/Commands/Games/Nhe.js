const STATEMENTS = [
    'Skipped school or work', 'Eaten an entire pizza alone', 'Slept through an alarm',
    'Sung karaoke in public', 'Fallen asleep in a movie theater', 'Dyed my hair a crazy color',
    'Stayed up all night gaming', 'Forgot someone\'s birthday', 'Laughed until I cried',
    'Traveled to another country', 'Tried to cook and failed badly', 'Said "I love you" first',
    'Won a contest or competition', 'Lost my phone and found it', 'Ate something expired',
    'Cried watching a movie', 'Danced in the rain', 'Made a viral video'
];

module.exports = {
    name: 'neverhaveiever',
    alias: ['nhie', 'never'],
    desc: 'Never Have I Ever game',
    category: 'Games',
    usage: `.nhie`,
    reactions: { start: '🙈', success: '🎭', error: '🏗️' },

    execute: async (sock, m, { reply }) => {
        await sock.sendMessage(m.chat, { react: { text: '🙈', key: m.key } });

        const statement = STATEMENTS[Math.floor(Math.random() * STATEMENTS.length)];

        await sock.sendMessage(m.chat, {
            headerText: `## 🙈 Never Have I Ever`,
            contentText: '---',
            title: '🤫 Be Honest!',
            table: [
                ['🙈 Statement', `Never have I ever... ${statement}!`],
                ['✅ If you have', 'React 👍'],
                ['❌ If you haven\'t', 'React 👎']
            ],
            footerText: '💡 .nhie for another!'
        }, { quoted: m });

        // Auto-react for engagement
        await sock.sendMessage(m.chat, { react: { text: '👍', key: m.key } });
    }
};
