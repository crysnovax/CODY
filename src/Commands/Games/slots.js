module.exports = {
    name: 'slots',
    alias: ['slot', 'jackpot'],
    desc: 'Spin the native Baileys slot machine.',
    category: 'Games',
    usage: '.slots [title] [starting credits]',
    execute: async (sock, m, { args, reply }) => {
        if (typeof sock.sendSlotMachine !== 'function') {
            return reply('Slot machine is unavailable in this Baileys build. Update @crysnovax/baileys and restart the bot.');
        }

        const creditsArg = args.find(arg => /^\d+$/.test(arg));
        const title = args.filter(arg => arg !== creditsArg).join(' ').trim();
        const options = {};
        if (title) options.title = title.slice(0, 40);
        if (creditsArg) options.startingCredits = Math.min(1000000, Math.max(1, Number(creditsArg)));

        try {
            await sock.sendSlotMachine(m.chat, Object.keys(options).length ? options : undefined);
        } catch (error) {
            console.error('[SLOTS ERROR]', error.message);
            return reply('The slot machine could not be started. Please try again.');
        }
    }
};
