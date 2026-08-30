const games = new Map();
const ZONES = ['left', 'center', 'right'];

function buildText(game) {
    const shots = game.history.map((h, i) => `${h.goal ? '\u26BD' : '\u2716'}`).join(' ');
    const shotTracker = shots || 'No shots yet';

    return `*PENALTY SHOOTOUT*\n` +
        `\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\n` +
        `\u{1F945} *Goal*\n\n` +
        `Shot ${game.shot + 1} / 5\n` +
        `*${game.score}* Goals  \u2022  *${game.saves}* Saved\n\n` +
        `${shotTracker}\n\n` +
        `_Pick a target: LEFT, CENTER, or RIGHT_`;
}

function buildListMessage(game) {
    return {
        text: buildText(game),
        footer: '\u26BD Penalty Shootout \u2012 Tap where to shoot!',
        title: `Shot ${game.shot + 1}/5 \u2022 ${game.score} Goals`,
        buttonText: '\u26BD Pick Target',
        sections: [{
            title: '\u{1F945} Pick Your Target',
            rows: [
                {
                    header: '\u2B05',
                    title: 'LEFT',
                    description: 'Shoot to the bottom left corner',
                    id: '#pn_left'
                },
                {
                    header: '\u2B06',
                    title: 'CENTER',
                    description: 'Shoot down the middle',
                    id: '#pn_center'
                },
                {
                    header: '\u27A1',
                    title: 'RIGHT',
                    description: 'Shoot to the bottom right corner',
                    id: '#pn_right'
                }
            ]
        }]
    };
}

function resultText(game) {
    const win = game.score >= 3;
    const icon = win ? '\u{1F3C6}' : '\u{1F61E}';
    const label = win ? 'GOAL! LEGEND!' : 'SAVED! TRY AGAIN';
    const shots = game.history.map(h => h.goal ? '\u26BD' : '\u2716').join(' ');

    return `${icon} *${label}*\n` +
        `\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\n` +
        `*${game.score} / 5* Goals Scored\n\n` +
        `${shots}\n\n` +
        `_Type *${'.penalty'}* to play again!_`;
}

module.exports = {
    name: 'penalty',
    alias: ['football', 'soccer', 'ball'],
    desc: 'Animated penalty shootout with interactive buttons!',
    category: 'Games',
    usage: '.penalty',

    execute: async (sock, m, { args, reply }) => {
        const key = m.chat;

        if (args[0] === 'stop') {
            games.delete(key);
            return reply('Penalty shootout cancelled. \u26BD');
        }

        let game = games.get(key);

        if (!game && !args[0]) {
            // Start new game
            game = { shot: 0, score: 0, saves: 0, history: [] };
            games.set(key, game);

            const listMsg = buildListMessage(game);
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

        if (args[0]) {
            const choice = args[0].toLowerCase();
            if (!ZONES.includes(choice)) {
                return reply('Pick a target: *left*, *center*, or *right*.\nType `.penalty stop` to quit.');
            }

            if (!game) {
                game = { shot: 0, score: 0, saves: 0, history: [] };
                games.set(key, game);
            }

            const keeper = ZONES[Math.floor(Math.random() * ZONES.length)];
            game.shot++;
            const goal = choice !== keeper;
            if (goal) game.score++; else game.saves++;
            game.history.push({ choice, keeper, goal });

            if (game.shot >= 5) {
                games.delete(key);
                return reply(resultText(game));
            }

            const resultMsg = goal
                ? `\u26BD *GOOAAAL!* The keeper went ${keeper}, you shot ${choice}!`
                : `\u2716 *SAVED!* The keeper read it and dived ${keeper}!`;

            const listMsg = buildListMessage(game);
            if (typeof sock.sendMessage === 'function') {
                await sock.sendMessage(key, { text: resultMsg });
                await sock.sendMessage(key, {
                    text: listMsg.text,
                    footer: listMsg.footer,
                    title: listMsg.title,
                    buttonText: listMsg.buttonText,
                    sections: listMsg.sections
                });
                return;
            }
            return reply(resultMsg + '\n\n' + buildText(game));
        }

        if (game) {
            const listMsg = buildListMessage(game);
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

        return reply('Type *.penalty* to start a new shootout!');
    },

    // Handle button/list clicks from native WhatsApp interactive messages
    handleGameReply: async (sock, m) => {
        const buttonId =
            m.msg?.buttonsResponseMessage?.selectedButtonId ||
            m.msg?.templateButtonReplyMessage?.selectedId ||
            m.msg?.listResponseMessage?.singleSelectReply?.selectedRowId;

        if (!buttonId || !buttonId.startsWith('#pn_')) return false;

        const chatKey = m.chat;
        let game = games.get(chatKey);

        if (!game) {
            await sock.sendMessage(chatKey, { text: 'Match expired. Type *.penalty* to start a new one!' });
            return true;
        }

        const choice = buttonId.replace('#pn_', '');
        if (!ZONES.includes(choice)) return false;

        const keeper = ZONES[Math.floor(Math.random() * ZONES.length)];
        game.shot++;
        const goal = choice !== keeper;
        if (goal) game.score++; else game.saves++;
        game.history.push({ choice, keeper, goal });

        const resultMsg = goal
            ? `\u26BD *GOOAAAL!* The keeper went ${keeper}, you shot ${choice}!`
            : `\u2716 *SAVED!* The keeper read it and dived ${keeper}!`;

        if (game.shot >= 5) {
            games.delete(chatKey);
            await sock.sendMessage(chatKey, { text: resultMsg });
            await sock.sendMessage(chatKey, { text: resultText(game) });
            return true;
        }

        await sock.sendMessage(chatKey, { text: resultMsg });

        const listMsg = buildListMessage(game);
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
