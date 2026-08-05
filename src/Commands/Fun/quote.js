const quotes = [
    '"The only way to do great work is to love what you do." - Steve Jobs',
    '"In the middle of difficulty lies opportunity." - Albert Einstein',
    '"It does not matter how slowly you go as long as you do not stop." - Confucius',
    '"Success is not final, failure is not fatal." - Winston Churchill',
    '"Believe you can and you\'re halfway there." - Theodore Roosevelt'
];
module.exports = {
    name: 'quote',
    alias: ['quotes', 'motivation'],
    desc: 'Get a motivational quote',
    category: 'Fun',
    execute: async (sock, m, { reply , prefix}) => {
        await reply(`${prefix}💬 ${quotes[Mathfloor(Math.random() * quotes.length)]}`);
    }
};
