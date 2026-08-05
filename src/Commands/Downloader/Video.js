const yts = require('yt-search');
const axios = require('axios');

module.exports = {
    name: 'video',
    alias: ['ytvideo', 'ytv'],
    desc: 'Download YouTube video',
    category: 'downloader',

    execute: async (sock, m, { text, reply , prefix}) => {
        try {

            if (!text) {
                return reply("✘ Provide a video name\nExample: `${prefix}video Alan Walker Lily`");
            }

            await sock.sendMessage(m.chat, {
                react: { text: "🔎", key: m.key }
            });

            const { videos } = await yts(text);
            if (!videos.length) {
                await sock.sendMessage(m.chat, {
                    react: { text: "🙈", key: m.key }
                });
                return reply("𓄄 _*No video found*_");
            }

            const vid = videos[0];

            await sock.sendMessage(m.chat, {
                react: { text: "⬇️", key: m.key }
            });

        //    await sock.sendMessage(m.chat, {
        //        image: { url: vid.thumbnail },
          //      caption:
//`亗 *${vid.title}*

//𓄄 Duration: ${vid.timestamp}
//⚉ Views: ${vid.views}
//✦ Channel: ${vid.author.name}

//✪ _*Downloading video...*_`
        //    }, { quoted: m });

            const apiUrl = `https://yt-dl.officialhectormanuel.workers.dev/?url=${encodeURIComponent(vid.url)}`;
            const res = await axios.get(apiUrl, { headers: { Accept: "application/json" } });

            const data = res.data;

            // DEBUG: log what quality keys the API actually returned
            console.log('[VIDEO QUALITIES AVAILABLE]', Object.keys(data?.videos || {}));

            // Cap at 854 (lower than 1080p) — the host was hitting ENOSPC
            // (disk full) on larger files, so trading resolution for a
            // smaller download/write footprint as a workaround.
            const videoDownloadUrl = pickBestQuality(data?.videos, 854);

            console.log('[VIDEO QUALITY SELECTED]', videoDownloadUrl);

            if (!data?.status || !videoDownloadUrl) {
                await sock.sendMessage(m.chat, {
                    react: { text: "🤧", key: m.key }
                });
                return reply("✘ Failed to download video");
            }

            await sock.sendMessage(m.chat, {
                react: { text: "📤", key: m.key }
            });

            // Download to buffer for reliable playback (URL streaming fails in WhatsApp)
            const videoBuffer = await axios.get(videoDownloadUrl, { responseType: 'arraybuffer' });

            const channelHandle = extractChannelHandle(vid.author);

            await sock.sendMessage(m.chat, {
                video: videoBuffer.data,
                mimetype: "video/mp4",
                caption: `☕︎ ${channelHandle} — ${vid.timestamp}`
            }, { quoted: m });

            await sock.sendMessage(m.chat, {
                react: { text: "🐾", key: m.key }
            });

        } catch (err) {
            console.log(err);

            await sock.sendMessage(m.chat, {
                react: { text: "😞", key: m.key }
            });

            reply("✘ Error downloading video");
        }
    }
};

// Picks the highest-quality video URL from a { "256": url, "1920": url, ... }
// map, where keys are pixel widths, not quality labels. Filters out any
// non-numeric keys defensively, sorts descending, and returns the first
// one at or below maxWidth. Falls back to the single highest available
// width if everything on offer exceeds the cap (better than returning
// nothing), and to any value at all if keys are somehow non-numeric.
function pickBestQuality(videos, maxWidth) {
    if (!videos || typeof videos !== 'object') return null;

    const widthEntries = Object.entries(videos)
        .map(([key, url]) => ({ width: parseInt(key, 10), url }))
        .filter(entry => !isNaN(entry.width))
        .sort((a, b) => b.width - a.width); // descending, highest first

    if (!widthEntries.length) {
        // Keys weren't numeric widths at all — just grab something
        return Object.values(videos)[0] || null;
    }

    const withinCap = widthEntries.find(entry => entry.width <= maxWidth);
    if (withinCap) return withinCap.url;

    // Every available width exceeds the cap — take the lowest of the
    // over-cap options rather than the largest, to stay closer to target
    return widthEntries[widthEntries.length - 1].url;
}

// Pulls the @handle out of the channel URL when one exists (author.url like
// https://youtube.com/@crysnovax), falling back to the display name if the
// channel only has a /channel/UC... URL with no vanity handle set.
function extractChannelHandle(author) {
    if (!author) return 'Unknown';

    const url = author.url || '';
    const handleMatch = url.match(/\/@([^/?#]+)/);

    if (handleMatch) {
        return `@${handleMatch[1]}`;
    }

    // No @handle in the URL (plain /channel/UC... link) — fall back to
    // the display name rather than showing a broken/empty handle
    return author.name || 'Unknown';
}
