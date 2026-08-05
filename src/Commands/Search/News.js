/**
 * .news — AI-generated news from CRYSNOVA Luna
 */

const { getLunaResponse } = require('../Core/!!!.js');
const { getUserTimezone, getTimeData } = require('../Core/®-utils');
const { getTimezone } = require('../Core/®.js');

// Cache for 15 minutes
let newsCache = {
    data: null,
    timestamp: 0,
    category: null
};

const CACHE_DURATION = 15 * 60 * 1000;

// Escape special regex characters
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const generateNewsWithAI = async (category) => {
    try {
        const prompts = {
            'world': 'Generate 5 realistic breaking world news stories from today. Include international events, diplomacy, conflicts, and global developments.',
            'business': 'Generate 5 realistic business news stories from today. Include stock market, earnings, mergers, and economic developments.',
            'tech': 'Generate 5 realistic technology news stories from today. Include AI, startups, gadgets, and tech industry developments.',
            'sports': 'Generate 5 realistic sports news stories from today. Include football, basketball, cricket, and major sporting events.',
            'politics': 'Generate 5 realistic political news stories from today. Include elections, legislation, government, and policy developments.',
            'health': 'Generate 5 realistic health news stories from today. Include medical research, health policy, and wellness developments.',
            'entertainment': 'Generate 5 realistic entertainment news stories from today. Include movies, music, celebrities, and pop culture.',
            'science': 'Generate 5 realistic science news stories from today. Include space, discoveries, research, and technology breakthroughs.',
            'general': 'Generate 5 realistic top news stories from today. Mix of world, business, tech, and current events.'
        };

        const prompt = prompts[category] || prompts['general'];

        const aiPrompt = `${prompt}

Create exactly 5 news articles in this format:

ARTICLE 1:
HEADLINE: [Compelling headline - max 10 words, no markdown]
SOURCE: [Realistic source like BBC, Reuters, CNN, ESPN, TechCrunch, Al Jazeera]
FULL STORY: [3-4 detailed paragraphs, 150-200 words total. Write like a professional journalist with quotes, facts, specific details, names, and context. Use present tense. Make it feel real and current.]

ARTICLE 2:
[continue same format for all 5]

Make them feel like real breaking news from today. NO markdown in headlines.`;

        console.log('[NEWS] Calling getLunaResponse...');
        
        const aiResponse = await getLunaResponse(aiPrompt);
        
        console.log('[NEWS] AI Response received:', aiResponse ? 'Yes' : 'No', 'Length:', aiResponse?.length);

        if (!aiResponse || aiResponse.length < 100) {
            throw new Error('AI returned empty or too short response');
        }
        
        // Parse the response
        const articles = [];
        const blocks = aiResponse.split(/ARTICLE \d+:/).filter(b => b.trim());
        
        console.log('[NEWS] Parsed blocks:', blocks.length);
        
        blocks.forEach((block, idx) => {
            const headlineMatch = block.match(/HEADLINE:\s*(.+)/i);
            const sourceMatch = block.match(/SOURCE:\s*(.+)/i);
            const storyMatch = block.match(/FULL STORY:\s*([\s\S]+?)(?=ARTICLE \d+:|$)/i);
            
            if (headlineMatch && storyMatch) {
                // Clean headline - remove markdown and trim
                const headline = headlineMatch[1].trim().replace(/\*\*/g, '').replace(/\*/g, '');
                const source = sourceMatch ? sourceMatch[1].trim().replace(/\*\*/g, '').replace(/\*/g, '') : 'News Source';
                let story = storyMatch[1].trim();
                
                // Clean up any trailing artifacts
                story = story.replace(/ARTICLE \d+:/gi, '').trim();
                
                articles.push({
                    id: idx + 1,
                    headline: headline,
                    source: source,
                    category: category,
                    time: new Date().toISOString(),
                    fullDetails: formatArticle(headline, source, story, category)
                });
            }
        });

        console.log('[NEWS] Articles parsed:', articles.length);

        if (articles.length === 0) {
            throw new Error('Failed to parse AI response');
        }

        return articles;
        
    } catch (err) {
        console.error('[NEWS AI ERROR]', err);
        throw err;
    }
};

const formatArticle = (headline, source, story, category) => {
    const emojis = {
        'world': '🌍', 'business': '💼', 'tech': '💻', 
        'sports': '⚽', 'politics': '🏛️', 'health': '🏥',
        'science': '🔬', 'entertainment': '🎬', 'general': '📰'
    };
    
    const emoji = emojis[category] || '📰';
    
    let text = `${emoji} *${headline}*\n\n`;
    text += `📡 ${source} | ${new Date().toLocaleDateString()} | ${category.toUpperCase()}\n\n`;
    
    // Clean story - remove markdown headers and format markers
    let cleanStory = story
        .replace(/\*\*/g, '')  // Remove all markdown bold
        .replace(/HEADLINE:|SOURCE:|FULL STORY:/gi, '')
        .trim();
    
    // Remove headline from story if it appears there (using escaped regex)
    const escapedHeadline = escapeRegex(headline);
    cleanStory = cleanStory.replace(new RegExp(escapedHeadline, 'gi'), '').trim();
    
    // Split into paragraphs
    const paragraphs = cleanStory.split(/\n\n+/).filter(p => p.trim().length > 10);
    
    if (paragraphs.length <= 1) {
        // Split by sentences for readability
        const sentences = cleanStory.match(/[^.!?]+[.!?]+/g) || [cleanStory];
        let currentPara = '';
        
        sentences.forEach((sentence, i) => {
            currentPara += sentence.trim() + ' ';
            if (currentPara.length > 150 || i === sentences.length - 1) {
                text += currentPara.trim() + '\n\n';
                currentPara = '';
            }
        });
    } else {
        paragraphs.forEach(para => {
            text += para.trim() + '\n\n';
        });
    }
    
    text += `💡 Stay updated with .news`;
    
    return text;
};

const NUMBER_EMOJIS = ['❏⋆1', '❏⋆⁩⁩2', '❏⋆⁩⁩3', '❏⋆⁩⁩4', '❏⋆⁩⁩5'];

module.exports = {
    name: 'news',
    alias: ['headlines', 'latest', 'n'],
    desc: 'AI-generated news from CRYSNOVA Luna',
    category: 'News',
    usage: '.news | .news 1-5 | .news tech',
    
    reactions: { start: '🗞️', success: '❔', read: '📰' },

    execute: async (sock, m, { args, reply , prefix}) => {
        try {
            const userId = m.sender || m.key?.participant || m.key?.remoteJid;
            const userRegion = getUserTimezone(userId);
            const userTimezone = getTimezone(userRegion) || 'Africa/Lagos';
            
            const { data } = await getTimeData(userTimezone);
            const now = new Date(data?.datetime || Date.now());
            
            const firstArg = args?.[0];
            const articleNum = parseInt(firstArg);
            
            let category = 'general';
            const validCategories = ['world', 'business', 'tech', 'sports', 'politics', 'health', 'entertainment', 'science'];
            
            if (firstArg && isNaN(parseInt(firstArg))) {
                const cat = firstArg.toLowerCase();
                if (validCategories.includes(cat)) {
                    category = cat;
                }
            }

            const cacheKey = category;
            const isCached = newsCache.data && 
                           newsCache.category === cacheKey && 
                           (Date.now() - newsCache.timestamp) < CACHE_DURATION;
            
            let news;
            
            if (isCached) {
                news = newsCache.data;
            } else {
                news = await generateNewsWithAI(category);
                
                newsCache = {
                    data: news,
                    timestamp: Date.now(),
                    category: cacheKey
                };
            }
            
            if (!isNaN(articleNum) && articleNum >= 1 && articleNum <= news.length) {
                const article = news[articleNum - 1];
                
                await reply(article.fullDetails);
                
                await sock.sendMessage(m.chat, { 
                    react: { text: '📖', key: m.key } 
                }).catch(() => {});
                
                return;
            }
            
            let response = `*📰 LATEST ${category.toUpperCase()} NEWS*\n`;
            response += `◈ ${userRegion} • ${now.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:true})}\n`;
            response += `✨ AI-Generated • CRYSNOVA Luna\n\n`;
            response += `*Type .news 1-5 for full article*\n\n`;
            
            news.forEach((item, index) => {
                const num = NUMBER_EMOJIS[index] || `${index + 1}️⃣`;
                let headline = item.headline;
                if (headline.length > 50) headline = headline.substring(0, 47) + '...';
                
                response += `${num} *${headline}*\n`;
                response += `   📡 ${item.source}\n\n`;
            });
            
            response += `💡 *.news 1* | *.news 3* | *.news tech*`;
            
            await reply(response);
            
        } catch (err) {
            console.error('[NEWS ERROR]', err.message);
            reply(`${prefix}⚉ Failed to generate news: ${errmessage}`);
        }
    }
};
            
