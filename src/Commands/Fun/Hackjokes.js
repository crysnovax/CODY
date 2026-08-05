// ── plugins/test-fetch.js ──
const fetch = require('node-fetch');

module.exports = {
 name: 'jok',
 alias: ['funjoke', 'randomjoke'],
 desc: 'Fetch a random programming joke',
 category: 'fun',
 usage: `.joke`,
 owner: false,

 execute: async (sock, m, { reply , prefix}) => {
 try {
 const res = await fetch('https://v2.jokeapi.dev/joke/Programming?type=single');
 const data = await res.json();
 if (!data || !data.joke) return reply('❔ Could not fetch joke!');
 await reply(`${prefix}⚉ Here's a random programming joke:\n\n${datajoke}`);
 } catch (err) {
 console.error('✘ Joke Plugin Error:', err.message);
 await reply('✘ Failed to fetch joke. Check your internet connection.');
 }
 }
};
