const axios = require("axios");

// Apex Gateway
const AI_GATEWAY = 'https://appex.crysnovax.link';
const AI_TOKEN = 'x';

module.exports = {
    name: 'story',
    alias: [],
    category: 'AI',
    desc: 'Advanced storytelling AI powered by CRYSNOVA',

    execute: async (sock, m, { args, reply , prefix}) => {
        try {
            if (!args.length) {
                return reply(`${prefix}ಠ_ಠ *STORYTELLING AI*\n\nUsage:\nstory <prompt>\n.story creative <prompt>\n.story short <prompt>\n.story long <prompt>`);
            }

            let length = 'medium';
            let isCreative = false;

            const flags = ['creative', 'short', 'medium', 'long'];
            let textArgs = [...args];

            while (textArgs.length > 0 && flags.includes(textArgs[0].toLowerCase())) {
                const flag = textArgs.shift().toLowerCase();
                if (['short', 'medium', 'long'].includes(flag)) length = flag;
                if (flag === 'creative') isCreative = true;
            }

            const userQuery = textArgs.join(' ').trim();
            if (!userQuery) return reply('✘ Give a valid story prompt');

            await sock.sendPresenceUpdate('composing', m.chat);
            await sock.sendMessage(m.chat, { react: { text: '📖', key: m.key } });

            // Build prompt based on options
            let lengthInstruction;
            if (length === 'short') lengthInstruction = 'Keep the story short, around 3-4 paragraphs.';
            else if (length === 'long') lengthInstruction = 'Write a long, detailed story with rich descriptions.';
            else lengthInstruction = 'Write a story of medium length, around 5-7 paragraphs.';
            
            const creativityInstruction = isCreative ? 'Be highly creative, use vivid imagery, metaphors, and unexpected twists.' : 'Write an engaging and well-structured story.';

            const prompt = `You are a master storyteller. ${creativityInstruction} ${lengthInstruction} Do not roleplay or break character. Just tell the story.\n\nStory prompt: ${userQuery}\n\nStory:`;

            // Use Gemini for storytelling (best creative AI)
            const url = `${AI_GATEWAY}/ai/gemini?text=${encodeURIComponent(prompt)}&token=${AI_TOKEN}`;
            
            const response = await axios.get(url, { timeout: 60000 });
            let result = response.data?.result || '';

            // Fallback to Claude if Gemini fails
            if (!result || result.length < 10) {
                const fallbackUrl = `${AI_GATEWAY}/ai/claude?text=${encodeURIComponent(prompt)}&token=${AI_TOKEN}`;
                const fallbackRes = await axios.get(fallbackUrl, { timeout: 60000 });
                result = fallbackRes.data?.result || '';
            }

            if (!result || result.length < 10) {
                return reply('✘ Could not generate story');
            }

            await sock.sendMessage(m.chat, {
                text: `𖣘 *STORYTELLING AI*\n\n⎙ Length: ${length.toUpperCase()}${isCreative ? ' • Creative' : ''}\n\n${result}\n\n_⚉ CRYSNOVA Gateway_`
            }, { quoted: m });

            await sock.sendMessage(m.chat, { react: { text: '✓', key: m.key } });

        } catch (err) {
            console.error('[STORY ERROR]', err.message);
            reply('✘ Failed to generate story');
        }
    }
};
