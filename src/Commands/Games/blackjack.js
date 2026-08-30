const games = new Map();
const card = () => Math.floor(Math.random() * 10) + 1;
const total = hand => hand.reduce((sum, value) => sum + value, 0);
const view = game => `*BLACKJACK TABLE*\n\nYour hand: ${game.you.join(' + ')} = ${total(game.you)}\nDealer shows: ${game.dealer[0]} + ?\n\nReply *hit* for another card or *stand* to hold. Reply *stop* to leave.`;

module.exports = {
    name: 'blackjack', alias: ['21', 'bj'], desc: 'Play a quick blackjack hand.', category: 'Games', usage: '.blackjack',
    execute: async (sock, m, { args, reply }) => {
        const key = m.chat;
        if (args[0] === 'stop') { games.delete(key); return reply('Blackjack table closed.'); }
        let game = games.get(key);
        if (!game) { game = { you: [card(), card()], dealer: [card(), card()] }; games.set(key, game); return reply(view(game)); }
        const action = args[0]?.toLowerCase();
        if (action === 'hit') {
            game.you.push(card());
            if (total(game.you) >= 21) { const result = total(game.you) === 21 ? 'BLACKJACK.' : 'BUST.'; games.delete(key); return reply(`${view(game)}\n\n*${result}*`); }
            return reply(view(game));
        }
        if (action !== 'stand') return reply(view(game));
        while (total(game.dealer) < 17) game.dealer.push(card());
        const you = total(game.you), dealer = total(game.dealer);
        const result = you > 21 || (dealer <= 21 && dealer > you) ? 'Dealer wins.' : you === dealer ? 'Push — nobody wins.' : 'You win.';
        games.delete(key);
        return reply(`*BLACKJACK RESULT*\n\nYour hand: ${game.you.join(' + ')} = ${you}\nDealer hand: ${game.dealer.join(' + ')} = ${dealer}\n\n*${result}*`);
    }
};
