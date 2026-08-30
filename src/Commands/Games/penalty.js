const games = new Map();
const zones = ['left', 'center', 'right'];

module.exports = {
    name: 'penalty', alias: ['football', 'soccer', 'ball'], desc: 'Take a realistic five-shot penalty shootout.', category: 'Games', usage: '.penalty',
    execute: async (sock, m, { args, reply }) => {
        const key = m.chat;
        if (args[0] === 'stop') { games.delete(key); return reply('Penalty shootout cancelled.'); }
        let game = games.get(key);
        if (!game) { game = { shot: 0, score: 0, saves: 0 }; games.set(key, game); return reply('*PENALTY SHOOTOUT*\n\nThe keeper is studying your stance. Choose *left*, *center*, or *right*.'); }
        const choice = args[0]?.toLowerCase();
        if (!zones.includes(choice)) return reply('Pick a target: *left*, *center*, or *right*.');
        const keeper = zones[Math.floor(Math.random() * zones.length)];
        game.shot++;
        if (choice === keeper) { game.saves++; } else { game.score++; }
        const result = choice === keeper ? `Saved! The keeper guessed ${keeper}.` : `GOAL! You placed it ${choice}; the keeper went ${keeper}.`;
        if (game.shot === 5) { const final = `\n\nFinal score: ${game.score}/5 (${game.saves} saves). ${game.score >= 3 ? 'Clinical finishing.' : 'The keeper wins the duel.'}`; games.delete(key); return reply(`${result}${final}`); }
        return reply(`${result}\n\nShot ${game.shot}/5 · Score ${game.score}\nChoose your next target: *left*, *center*, or *right*.`);
    }
};
