const axios = require('axios');

const BASE = 'https://nekos.life/api/v2';

// SFW actions with 'a' prefix
const SFW_ACTIONS = [
    { name: 'ahug', alias: ['ahugme'], desc: 'Send a hug', emoji: '🤗', endpoint: 'hug' },
    { name: 'akiss', alias: ['akissme'], desc: 'Send a kiss', emoji: '😘', endpoint: 'kiss' },
    { name: 'apat', alias: ['apatme', 'aheadpat'], desc: 'Give a headpat', emoji: '👋', endpoint: 'pat' },
    { name: 'acuddle', alias: ['acuddleme'], desc: 'Cuddle someone', emoji: '🫂', endpoint: 'cuddle' },
    { name: 'aslap', alias: ['aslapme'], desc: 'Slap someone', emoji: '👋', endpoint: 'slap' },
    { name: 'atickle', alias: ['atickleme'], desc: 'Tickle someone', emoji: '😆', endpoint: 'tickle' },
    { name: 'afeed', alias: ['afeedme'], desc: 'Feed someone', emoji: '🍽️', endpoint: 'feed' },
    { name: 'ameow', alias: ['ameowme'], desc: 'Random meow gif', emoji: '🐱', endpoint: 'meow' },
    { name: 'awoof', alias: ['awoofme', 'adoggo'], desc: 'Random dog gif', emoji: '🐶', endpoint: 'woof' },
    { name: 'angif', alias: ['anekogif'], desc: 'Random neko gif', emoji: '🐱', endpoint: 'ngif' },
    { name: 'asmug', alias: ['asmugme'], desc: 'Smug face', emoji: '😏', endpoint: 'smug' },
    { name: 'agasm', alias: ['agasmme'], desc: 'Orgasm face', emoji: '😩', endpoint: 'gasm' },
    { name: 'agecg', alias: ['agecgme'], desc: 'Genetically engineered catgirl', emoji: '🧬', endpoint: 'gecg' },
    { name: 'agoose', alias: ['agooseme'], desc: 'Random goose', emoji: '🪿', endpoint: 'goose' },
    { name: 'afoxgirl', alias: ['afox', 'afox_girl'], desc: 'Fox girl', emoji: '🦊', endpoint: 'fox_girl' },
    { name: 'aneko', alias: ['anekogirl', 'acatgirl'], desc: 'Neko girl', emoji: '🐱', endpoint: 'neko' },
    { name: 'awaifu', alias: ['awaifupic'], desc: 'Random waifu', emoji: '🎌', endpoint: 'waifu' },
    { name: 'aavatar', alias: ['aanimeavatar', 'aav'], desc: 'Anime avatar', emoji: '🖼️', endpoint: 'avatar' },
    { name: 'awallpaper', alias: ['aanimewall', 'aanimewallpaper'], desc: 'Anime wallpaper', emoji: '🖼️', endpoint: 'wallpaper' },
];

// NSFW actions with 'a' prefix
const NSFW_ACTIONS = [
    { name: 'alewd', alias: ['alewdme', 'ansfwlewd'], desc: 'Lewd image', emoji: '🔞', endpoint: 'lewd' },
    { name: 'aspank', alias: ['aspankme'], desc: 'Spank someone', emoji: '👋', endpoint: 'spank' },
    { name: 'av3', alias: ['ansfwneko', 'ansfwnekogirl'], desc: 'NSFW Neko', emoji: '🔞', endpoint: 'v3' },
];

// Generate SFW commands
const sfwCommands = SFW_ACTIONS.map(action => ({
    name: action.name,
    alias: action.alias,
    category: 'Anime',
    desc: action.desc,
    usage: `.${action.name} [@mention]`,
    reactions: { start: action.emoji, success: '✨' },
    
    execute: async (sock, m, { reply, mentioned , prefix}) => {
        try {
            await sock.sendMessage(m.chat, { react: { text: action.emoji, key: m.key } });
            
            const res = await axios.get(`${BASE}/img/${action.endpoint}`);
            const imageUrl = res.data?.url;
            
            if (!imageUrl) return reply(`\`×͜× ${action.name} failed ×͜×\``);
            
            let caption = `${action.emoji} *${action.desc.toUpperCase()}!*`;
            
            if (mentioned && mentioned.length > 0) {
                const target = mentioned[0];
                const senderName = m.pushName || 'Someone';
                const targetName = target.split('@')[0];
                caption = `${action.emoji} *${senderName} ${action.endpoint}s ${targetName}!*`;
            }
            
            // GIFs send as video, images as image
            const isGif = ['ngif', 'meow', 'woof'].includes(action.endpoint);
            
            await sock.sendMessage(m.chat, {
                [isGif ? 'video' : 'image']: { url: imageUrl },
                caption: caption,
                gifPlayback: isGif,
                mentions: mentioned || []
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { react: { text: '✨', key: m.key } });
            
        } catch (err) {
            console.error(`[${action.name.toUpperCase()}]`, err.message);
            reply(`\`×͜× ${action.name} failed ×͜×\``);
        }
    }
}));

// Generate NSFW commands
const nsfwCommands = NSFW_ACTIONS.map(action => ({
    name: action.name,
    alias: action.alias,
    category: 'NSFW',
    desc: action.desc,
    usage: `.${action.name}`,
    reactions: { start: action.emoji, success: '🔞' },
    
    execute: async (sock, m, { reply , prefix}) => {
        try {
            await sock.sendMessage(m.chat, { react: { text: action.emoji, key: m.key } });
            
            const res = await axios.get(`${BASE}/img/${action.endpoint}`);
            const imageUrl = res.data?.url;
            
            if (!imageUrl) return reply(`\`×͜× ${action.name} failed ×͜×\``);
            
            await sock.sendMessage(m.chat, {
                image: { url: imageUrl },
                caption: `${action.emoji} *${action.desc.toUpperCase()}!*`
            }, { quoted: m });
            
            await sock.sendMessage(m.chat, { react: { text: '🔞', key: m.key } });
            
        } catch (err) {
            console.error(`[${action.name.toUpperCase()}]`, err.message);
            reply(`\`×͜× ${action.name} failed ×͜×\``);
        }
    }
}));

// Additional utility commands with 'a' prefix
const utilityCommands = [
    {
        name: 'anekofact',
        alias: ['aanimefact', 'afact'],
        category: 'Fun',
        desc: 'Get a random fact',
        usage: `${prefix}anekofact`,
        reactions: { start: '📚', success: '💡' },
        
        execute: async (sock, m, { reply , prefix}) => {
            try {
                const res = await axios.get(`${BASE}/fact`);
                const fact = res.data?.fact;
                if (!fact) return reply('`×͜× No fact found ×͜×`');
                await sock.sendMessage(m.chat, { text: `💡 *FACT:*\n\n${fact}` }, { quoted: m });
            } catch {
                reply('`×͜× Fact fetch failed ×͜×`');
            }
        }
    },
    {
        name: 'anekoname',
        alias: ['aanimename', 'arandomname'],
        category: 'Fun',
        desc: 'Generate a random anime name',
        usage: `${prefix}anekoname`,
        reactions: { start: '📛', success: '✨' },
        
        execute: async (sock, m, { reply , prefix}) => {
            try {
                const res = await axios.get(`${BASE}/name`);
                const name = res.data?.name;
                if (!name) return reply('`×͜× No name generated ×͜×`');
                await sock.sendMessage(m.chat, { text: `📛 *ANIME NAME:*\n\n✨ ${name}` }, { quoted: m });
            } catch {
                reply('`×͜× Name generation failed ×͜×`');
            }
        }
    },
    {
        name: 'aowoify',
        alias: ['aowo', 'aowotext'],
        category: 'Fun',
        desc: 'OwOify your text',
        usage: `${prefix}aowoify <text>`,
        reactions: { start: '😸', success: '✨' },
        
        execute: async (sock, m, { args, reply , prefix}) => {
            const text = args.join(' ').trim();
            if (!text) return reply('`×͜× Provide text to owoify ×͜×`');
            try {
                const res = await axios.get(`${BASE}/owoify?text=${encodeURIComponent(text)}`);
                const owo = res.data?.owo;
                if (!owo) return reply('`×͜× OwOify failed ×͜×`');
                await sock.sendMessage(m.chat, { text: `😸 *OwO:*\n\n${owo}` }, { quoted: m });
            } catch {
                reply('`×͜× OwOify failed ×͜×`');
            }
        }
    },
    {
        name: 'awhy',
        alias: ['anekoswhy', 'arandomwhy'],
        category: 'Fun',
        desc: 'Get a random "why" question',
        usage: `${prefix}awhy`,
        reactions: { start: '🤔', success: '❓' },
        
        execute: async (sock, m, { reply , prefix}) => {
            try {
                const res = await axios.get(`${BASE}/why`);
                const why = res.data?.why;
                if (!why) return reply('`×͜× No why found ×͜×`');
                await sock.sendMessage(m.chat, { text: `🤔 *WHY:*\n\n${why}` }, { quoted: m });
            } catch {
                reply('`×͜× Why fetch failed ×͜×`');
            }
        }
    },
    {
        name: 'acat',
        alias: ['anekocat', 'arandomcat'],
        category: 'Fun',
        desc: 'Get a random cat image',
        usage: `${prefix}acat`,
        reactions: { start: '🐱', success: '😻' },
        
        execute: async (sock, m, { reply , prefix}) => {
            try {
                const res = await axios.get(`${BASE}/cat`);
                const imageUrl = res.data?.cat;
                if (!imageUrl) return reply('`×͜× Cat fetch failed ×͜×`');
                await sock.sendMessage(m.chat, {
                    image: { url: imageUrl },
                    caption: '🐱 *Meow!*'
                }, { quoted: m });
            } catch {
                reply('`×͜× Cat fetch failed ×͜×`');
            }
        }
    },
    {
        name: 'a8ball',
        alias: ['anekos8ball', 'aask'],
        category: 'Fun',
        desc: 'Ask the magic 8ball',
        usage: `${prefix}a8ball <question>`,
        reactions: { start: '🎱', success: '🔮' },
        
        execute: async (sock, m, { args, reply , prefix}) => {
            const question = args.join(' ').trim();
            if (!question) return reply('`×͜× Ask a question ×͜×`');
            try {
                const res = await axios.get(`${BASE}/8ball`);
                const answer = res.data?.response;
                const imageUrl = res.data?.url;
                
                let text = `🎱 *8BALL*\n\n❔ *Q:* ${question}\n🔮 *A:* ${answer}`;
                
                if (imageUrl) {
                    await sock.sendMessage(m.chat, {
                        image: { url: imageUrl },
                        caption: text
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(m.chat, { text }, { quoted: m });
                }
            } catch {
                reply('`×͜× 8ball failed ×͜×`');
            }
        }
    },
    {
        name: 'aspoiler',
        alias: ['anekospoiler', 'ahidetext'],
        category: 'Fun',
        desc: 'Hide text as spoiler',
        usage: `${prefix}aspoiler <text>`,
        reactions: { start: '🫣', success: '🙈' },
        
        execute: async (sock, m, { args, reply , prefix}) => {
            const text = args.join(' ').trim();
            if (!text) return reply('`×͜× Provide text to spoiler ×͜×`');
            try {
                const res = await axios.get(`${BASE}/spoiler?text=${encodeURIComponent(text)}`);
                const spoiler = res.data?.owo;
                if (!spoiler) return reply('`×͜× Spoiler failed ×͜×`');
                await sock.sendMessage(m.chat, { text: `🙈 *SPOILER:*\n\n${spoiler}` }, { quoted: m });
            } catch {
                reply('`×͜× Spoiler failed ×͜×`');
            }
        }
    },
    {
        name: 'achat',
        alias: ['anekoschat', 'aaichat'],
        category: 'Fun',
        desc: 'Chat with Nekos AI',
        usage: `${prefix}achat <message>`,
        reactions: { start: '💬', success: '🤖' },
        
        execute: async (sock, m, { args, reply , prefix}) => {
            const text = args.join(' ').trim();
            if (!text) return reply('`×͜× Say something ×͜×`');
            try {
                const res = await axios.get(`${BASE}/chat?text=${encodeURIComponent(text)}`);
                const response = res.data?.response;
                if (!response) return reply('`×͜× Chat failed ×͜×`');
                await sock.sendMessage(m.chat, { text: `💬 *YOU:* ${text}\n\n🤖 *NEKOS:* ${response}` }, { quoted: m });
            } catch {
                reply('`×͜× Chat failed ×͜×`');
            }
        }
    }
];

// Combine all commands
module.exports = [...sfwCommands, ...nsfwCommands, ...utilityCommands];
