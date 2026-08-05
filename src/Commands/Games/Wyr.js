// File: src/Commands/Games/wyr.js

const QUESTIONS = [
    { a: 'Know when you will die', b: 'Know how you will die', c: 'Know who will be with you' },
    { a: 'Read minds', b: 'See the future', c: 'See 10 seconds into the past' },
    { a: 'Be famous but hated', b: 'Be unknown but loved', c: 'Be forgotten completely' },
    { a: 'Lose all your memories', b: 'Lose the ability to make new ones', c: 'Lose the ability to dream' },
    { a: 'Live 500 years alone', b: 'Live 50 years with loved ones', c: 'Live forever watching everyone leave' },
    { a: 'Be the smartest person alive', b: 'Be the happiest person alive', c: 'Be the richest person alive' },
    { a: 'Erase one regret', b: 'Relive one memory', c: 'Preview one future moment' },
    { a: 'Never feel physical pain', b: 'Never feel emotional pain', c: 'Never feel fear' },
    { a: 'Be 20% luckier', b: 'Be 20% smarter', c: 'Be 20% stronger' },
    { a: 'Know every language', b: 'Know every skill', c: 'Know every secret' },
    { a: 'Time travel to past', b: 'Time travel to future', c: 'Stop time for 1 hour daily' },
    { a: 'Be a famous singer', b: 'Be a famous actor', c: 'Be a famous athlete' },
    { a: 'Live in perfect health to 70', b: 'Live with illness to 100', c: 'Live randomly 50-150' },
    { a: 'Never be lied to', b: 'Never be betrayed', c: 'Never be forgotten' },
    { a: 'Be 7 feet tall', b: 'Be 4 feet tall', c: 'Stay your height but perfect' },
    { a: 'Control fire', b: 'Control water', c: 'Control air' },
    { a: 'Talk to animals', b: 'Talk to plants', c: 'Talk to machines' },
    { a: 'Be a genius but lonely', b: 'Be average with friends', c: 'Be simple but happy' },
    { a: 'Change one world problem', b: 'Change one personal flaw', c: 'Change one past mistake' },
    { a: 'Win $1M tomorrow', b: 'Win $10M in 10 years', c: 'Win $100M when you die' },
    { a: 'Be naturally talented', b: 'Be extremely hardworking', c: 'Be incredibly lucky' },
    { a: 'Live without phone', b: 'Live without internet', c: 'Live without electricity' },
    { a: 'Read deleted messages', b: 'See who views your profile', c: 'Know when someone lies' },
    { a: 'Be able to fly', b: 'Be able to teleport', c: 'Be able to breathe underwater' },
    { a: 'Fix your biggest regret', b: 'Achieve your biggest dream', c: 'Meet your biggest inspiration' },
    { a: 'Always be right', b: 'Always be liked', c: 'Always be lucky' },
    { a: 'Know when someone loves you', b: 'Know when someone lies', c: 'Know when someone needs you' },
    { a: 'Live in a castle', b: 'Live on a private island', c: 'Live in a spaceship' },
    { a: 'Be a superhero', b: 'Be a wizard', c: 'Be a genius inventor' },
    { a: 'Never need sleep', b: 'Never need food', c: 'Never need water' },
    { a: 'Be invisible at will', b: 'Be able to clone yourself', c: 'Be able to phase through walls' },
    { a: 'Change your appearance', b: 'Change your voice', c: 'Change your past' },
    { a: 'Know the truth about aliens', b: 'Know the truth about afterlife', c: 'Know the truth about Atlantis' },
    { a: 'Be respected but feared', b: 'Be loved but underestimated', c: 'Be unknown but powerful' },
    { a: 'Have a photographic memory', b: 'Have unlimited creativity', c: 'Have perfect logic' },
    { a: 'Fast forward boring moments', b: 'Rewind happy moments', c: 'Pause perfect moments' },
    { a: 'Never get sick', b: 'Never get tired', c: 'Never get stressed' },
    { a: 'Be a master of one thing', b: 'Be good at everything', c: 'Be naturally gifted at learning' },
    { a: 'Live in the city', b: 'Live in the countryside', c: 'Live in the mountains' },
    { a: 'Have a personal AI', b: 'Have a personal robot', c: 'Have a personal genie with limits' },
    { a: 'Relive your childhood', b: 'Skip to retirement', c: 'Stay your age forever' },
    { a: 'Be 10 years younger', b: 'Be 10 years older with wisdom', c: 'Be reborn with memories' },
    { a: 'Never feel embarrassment', b: 'Never feel jealousy', c: 'Never feel regret' },
    { a: 'Be the hero', b: 'Be the villain', c: 'Be the mysterious stranger' },
    { a: 'Control dreams', b: 'Control emotions', c: 'Control luck' },
    { a: 'Understand women', b: 'Understand men', c: 'Understand yourself' },
    { a: 'Be a legend after death', b: 'Be rich while alive', c: 'Be happy your whole life' },
    { a: 'Delete social media', b: 'Delete your phone', c: 'Delete all screens' },
    { a: 'Live in a simulation', b: 'Live in a parallel universe', c: 'Live in a fantasy world' },
    { a: 'Know your death date', b: 'Know your soulmate', c: 'Know your purpose' }
];

module.exports = {
    name: 'wouldyourather',
    alias: ['wyr', 'rather'],
    desc: 'Would You Rather questions (3 options - A, B, or C)',
    category: 'Games',
    usage: `.wyr`,

    execute: async (sock, m) => {
        await sock.sendMessage(m.chat, { react: { text: '🤔', key: m.key } });

        const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];

        await sock.sendMessage(m.chat, {
            poll: {
                name: '🎯 Would You Rather',
                values: [`🅰️ ${q.a}`, `🅱️ ${q.b}`, `🅲️ ${q.c}`],
                selectableCount: 1
            }
        });

        await sock.sendMessage(m.chat, { react: { text: '🎭', key: m.key } });
    }
};
