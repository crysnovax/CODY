const { getVar, setVar } = require('../../Plugin/configManager');

module.exports = {
    name: 'autorecording',
    alias: ['autorec', 'recording'],
    desc: 'Toggle auto recording status (shows "recording..." while bot processes)',
    category: 'Owner',
    usage: '.autorecording on/off',

    execute: async (sock, m, { args, reply , prefix}) => {
        const action = args[0]?.toLowerCase();

        if (action === 'on') {
            setVar('AUTO_RECORDING', true);
            return reply('`✓ Recording ENABLED`');
        } else if (action === 'off') {
            setVar('AUTO_RECORDING', false);
            return reply('`✘ Recording DISABLED`');
        } else {
            const current = getVar('AUTO_RECORDING', true);
            return reply(`${prefix}Auto Recording is currently: *${current ? 'ON' : 'OFF'}*\n\nUsage: autorecording on/off`);
        }
    }
};
