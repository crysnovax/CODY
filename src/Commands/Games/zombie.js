const games = new Map();

const EVENTS = {
    shoot: { damage: 3, icon: '\u{1F52B}', text: 'Headshot landed!', threatMod: -2 },
    barricade: { damage: 0, icon: '\u{1FAB5}', text: 'Barricade reinforced.', threatMod: 0 },
    run: { damage: -1, icon: '\u{1F3C3}', text: 'Sprinted through.', threatMod: 1 },
};

function healthBar(hp, max = 10) {
    const filled = Math.max(0, Math.min(max, hp));
    const empty = max - filled;
    const color = hp > 6 ? '#00ff88' : hp > 3 ? '#fbbf24' : '#ff6b6b';
    return `\u2588`.repeat(filled) + `\u2591`.repeat(empty) + ` (${hp}/${max} HP)`;
}

function buildText(game) {
    const hpColor = game.health > 6 ? '🟢' : game.health > 3 ? '🟡' : '🔴';
    const hpBar = healthBar(game.health);
    return `*ZOMBIE NIGHTFALL*\n` +
        `\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\n` +
        `*DAY ${game.day} / 10*\n\n` +
        `${hpColor} Health: ${hpBar}\n` +
        `\u{1F4A3} Ammo: *${game.ammo}*\n` +
        `\u{1F6E1}\uFE0F Barricade: *${game.barricade}*\n\n` +
        `*SYSTEM LOG*\n${game.message}\n\n` +
        `_Day ${game.day}/10 \u2022 Type actions below or tap a button_`;
}

function buildListMessage(game, chatId) {
    return {
        text: buildText(game),
        footer: '\u{1F9DF} Zombie Nightfall \u2022 Tap an action below',
        title: `DAY ${game.day}/10 \u2022 ${game.health} HP`,
        buttonText: '\u{1F3AF} Choose Action',
        sections: [{
            title: '\u{1F52B} Actions',
            rows: [
                {
                    header: '\u{1F52B}',
                    title: 'SHOOT',
                    description: game.ammo > 0 ? `Headshot! (Ammo: ${game.ammo})` : 'No ammo left!',
                    id: `#zb_shoot`
                },
                {
                    header: '\u{1F6E1}\uFE0F',
                    title: 'BARRICADE',
                    description: `Reinforce defenses (+2 barricade)`,
                    id: `#zb_barricade`
                },
                {
                    header: '\u{1F3C3}',
                    title: 'RUN',
                    description: 'Sprint through (-1 hp, higher threat)',
                    id: `#zb_run`
                }
            ]
        }]
    };
}

function resolveAction(actionName, game) {
    const action = EVENTS[actionName];
    if (!action) return null;

    if (actionName === 'shoot' && game.ammo < 1) return 'no_ammo';

    if (actionName === 'shoot') game.ammo--;
    if (actionName === 'barricade') game.barricade = Math.min(5, game.barricade + 2);

    const threat = Math.max(0, 3 - Math.floor(game.barricade / 2) + action.threatMod);
    game.health -= threat;
    game.day++;

    game.message = `${action.icon} *${action.text}*\n\u{1F9DF} Horde hits for *${threat}* damage`;

    if (game.health <= 0) {
        game.health = 0;
        return 'dead';
    }
    if (game.day > 10) {
        return 'survived';
    }
    return 'alive';
}

function gameOverText(game, survived) {
    const title = survived ? '\u{1F3C6} NIGHTFALL SURVIVED!' : '\u{1F480} GAME OVER';
    return `*${title}*\n` +
        `\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\n` +
        `Days survived: *${survived ? 10 : game.day - 1}*\n` +
        `Final HP: *${game.health}*\n` +
        `Ammo remaining: *${game.ammo}*\n` +
        `\n_Start *${'.zombie'}* to play again!_`;
}

module.exports = {
    name: 'zombie',
    alias: ['zombies', 'survival'],
    desc: 'Survive 10 days of zombie nightfall with interactive buttons!',
    category: 'Games',
    usage: '.zombie',

    execute: async (sock, m, { args, reply }) => {
        const key = m.chat;

        if (args[0] === 'stop') {
            games.delete(key);
            return reply('Zombie run ended. \u{1F480}');
        }

        let game = games.get(key);

        if (!game && !args[0]) {
            // Start new game
            game = {
                day: 1,
                health: 10,
                ammo: 6,
                barricade: 2,
                message: '\u{1F9DF} *The dead are moving...*'
            };
            games.set(key, game);

            // Send with native interactive list buttons
            const listMsg = buildListMessage(game, key);
            if (typeof sock.sendMessage === 'function') {
                await sock.sendMessage(key, {
                    text: listMsg.text,
                    footer: listMsg.footer,
                    title: listMsg.title,
                    buttonText: listMsg.buttonText,
                    sections: listMsg.sections
                }, { quoted: m });
                return;
            }
            return reply(buildText(game));
        }

        // Handle command args (.zombie shoot, .zombie barricade, .zombie run)
        if (args[0]) {
            const actionName = args[0].toLowerCase();
            if (!EVENTS[actionName]) {
                return reply('Available actions: *shoot*, *barricade*, *run*\nType `.zombie stop` to quit.');
            }

            if (!game) {
                game = { day: 1, health: 10, ammo: 6, barricade: 2, message: '\u{1F9DF} *The dead are moving...*' };
                games.set(key, game);
            }

            const result = resolveAction(actionName, game);

            if (result === 'no_ammo') {
                return reply('Out of ammo! Try *barricade* or *run*.');
            }

            if (result === 'dead' || result === 'survived') {
                games.delete(key);
                return reply(gameOverText(game, result === 'survived'));
            }

            // Send updated game with interactive list
            const listMsg = buildListMessage(game, key);
            if (typeof sock.sendMessage === 'function') {
                await sock.sendMessage(key, {
                    text: listMsg.text,
                    footer: listMsg.footer,
                    title: listMsg.title,
                    buttonText: listMsg.buttonText,
                    sections: listMsg.sections
                }, { quoted: m });
                return;
            }
            return reply(buildText(game));
        }

        // No args, show current state
        if (game) {
            const listMsg = buildListMessage(game, key);
            if (typeof sock.sendMessage === 'function') {
                await sock.sendMessage(key, {
                    text: listMsg.text,
                    footer: listMsg.footer,
                    title: listMsg.title,
                    buttonText: listMsg.buttonText,
                    sections: listMsg.sections
                }, { quoted: m });
                return;
            }
            return reply(buildText(game));
        }

        return reply('Type *.zombie* to start a new game!');
    },

    // Handle button/list clicks from native WhatsApp interactive messages
    handleGameReply: async (sock, m) => {
        const buttonId =
            m.msg?.buttonsResponseMessage?.selectedButtonId ||
            m.msg?.templateButtonReplyMessage?.selectedId ||
            m.msg?.listResponseMessage?.singleSelectReply?.selectedRowId;

        if (!buttonId || !buttonId.startsWith('#zb_')) return false;

        const chatKey = m.chat;
        let game = games.get(chatKey);

        if (!game) {
            await sock.sendMessage(chatKey, { text: 'Game expired. Type *.zombie* to start a new one!' });
            return true;
        }

        const actionName = buttonId.replace('#zb_', '');
        if (!EVENTS[actionName]) return false;

        const result = resolveAction(actionName, game);

        if (result === 'no_ammo') {
            await sock.sendMessage(chatKey, { text: 'Out of ammo! Tap *BARRICADE* or *RUN*.' });
            return true;
        }

        if (result === 'dead' || result === 'survived') {
            games.delete(chatKey);
            await sock.sendMessage(chatKey, { text: gameOverText(game, result === 'survived') });
            return true;
        }

        // Send updated game state with new list buttons
        const listMsg = buildListMessage(game, chatKey);
        await sock.sendMessage(chatKey, {
            text: listMsg.text,
            footer: listMsg.footer,
            title: listMsg.title,
            buttonText: listMsg.buttonText,
            sections: listMsg.sections
        });

        return true;
    }
};
