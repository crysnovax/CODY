'use strict';
const { sendFontList, resolveFont, styles } = require('./fontCatalog');
module.exports = {
  name: 'font', alias: ['fonts', 'xfont'], category: 'Tools',
  desc: 'List and apply text fonts',
  execute: async (sock, m, { args, reply }) => {
    if (!args[0] || args[0].toLowerCase() === 'list') return sendFontList(sock, m.chat, m, 'Fonts');
    const font = resolveFont(args);
    if (!font) return reply('Use .font list or .font <number>.');
    const text = args.slice(1).join(' ').trim();
    if (!text) return reply(`_${font}:_ ${styles[font]('CRYSNOVA')}`);
    return reply(styles[font](text));
  },
};
