const figlet = require('figlet');

module.exports = {
 name: 'ascii',
 alias: ['bigtext'],
 desc: 'Convert text into ASCII art',
 category: 'fun',
 usage: `.ascii <text>`,
 owner: false,

 execute: async (sock, m, { args, reply }) => {
 try {
 if (!args.length) return reply('⚉ Provide text');

 figlet(args.join(' '), function (err, data) {
 if (err) return reply('✘ ASCII generation failed.');
 reply(`⚉\n${data}`);
 });
 } catch (err) {
 console.error('✘ ASCII Error:', err.message);
 reply('✘ Error generating ASCII.');
 }
 }
};