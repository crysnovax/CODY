const games = new Map();
const actions = { shoot: { damage: 3, text: 'You land a clean headshot.' }, barricade: { damage: 0, text: 'You reinforce the barricade.' }, run: { damage: -1, text: 'You sprint through the alley.' } };

function scene(game) {
    return `*ZOMBIE NIGHTFALL*\n\nDay ${game.day} · ${game.health}/10 health · ${game.ammo} ammo · ${game.barricade}/5 barricade\n\n${game.message}\n\nReply with *shoot*, *barricade*, or *run*. Reply *stop* to abandon.`;
}

module.exports = {
    name: 'zombie', alias: ['zombies', 'survival'], desc: 'Survive the zombie nightfall.', category: 'Games', usage: '.zombie',
    execute: async (sock, m, { args, reply }) => {
        const key = m.chat;
        if (args[0] === 'stop') { games.delete(key); return reply('Zombie run ended.'); }
        let game = games.get(key);
        if (!game) { game = { day: 1, health: 10, ammo: 6, barricade: 2, message: 'The dead are moving. Make your choice.' }; games.set(key, game); return reply(scene(game)); }
        const action = actions[args[0]?.toLowerCase()];
        if (!action) return reply(scene(game));
        if (args[0].toLowerCase() === 'shoot' && game.ammo < 1) return reply('You are out of ammo. Try *run* or *barricade*.');
        if (args[0].toLowerCase() === 'shoot') game.ammo--;
        game.barricade = Math.min(5, game.barricade + (args[0].toLowerCase() === 'barricade' ? 2 : 0));
        const threat = Math.max(0, 3 - Math.floor(game.barricade / 2) - action.damage);
        game.health -= threat;
        game.day++;
        game.message = `${action.text} The horde hits for ${threat}.`;
        if (game.health <= 0) { games.delete(key); return reply(`${scene(game)}\n\n*GAME OVER.* You survived ${game.day - 1} days.`); }
        if (game.day > 10) { games.delete(key); return reply(`${scene(game)}\n\n*YOU SURVIVED THE NIGHTFALL.*`); }
        return reply(scene(game));
    }
};
