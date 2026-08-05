const axios = require('axios');
const mime = require('mime-types');

module.exports = {
    name: 'd',
    alias: ['download', 'dl'],
    desc: 'Download & send media from direct URL',
    category: 'Downloader',
    usage: `.d <URL>`,
    reactions: { start: '📥', success: '🔖', error: '❔' },

    execute: async (sock, m, { args, reply, prefix }) => {
        let rawText = args.join(' ').trim();

        if (!rawText) {
            rawText = m.quoted?.body || m.quoted?.text || '';
        }

        const urlMatches = rawText.match(/(https?:\/\/[^\s]+)/g) || [];

        if (!urlMatches.length && args[0]) {
            urlMatches.push('https://' + args[0].trim());
        }

        if (!urlMatches.length) {
            return reply(`⊘ *Usage:* ${prefix}d <URL>`);
        }

        await sock.sendMessage(m.chat, { react: { text: '📥', key: m.key } });

        for (const rawUrl of urlMatches) {
            const url = rawUrl.replace(/[)>\].,;!?]+$/, '');

            try {
                await downloadAndSend(sock, m, url);
            } catch (err) {
                console.error('[D ERROR]', err.message || err);
                await sock.sendMessage(m.chat, { react: { text: '❔', key: m.key } });
            }
        }
    }
};

async function downloadAndSend(sock, m, url) {
    let response;
    let retries = 1;
    
    while (retries >= 0) {
        try {
            response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 120000,
                maxRedirects: 5,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            break;
        } catch (err) {
            if (retries === 0) throw err;
            retries--;
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    const buffer = Buffer.from(response.data);

    if (buffer.length < 100) {
        throw new Error('File too small or empty');
    }

    const detectedExt = detectByMagicBytes(buffer);
    const contentType = response.headers['content-type'] || '';
    let ext = detectedExt || mime.extension(contentType.split(';')[0].trim()) || url.split('?')[0].split('.').pop()?.toLowerCase() || 'bin';
    
    const cleanName = url.split('?')[0].split('/').pop() || `file_${Date.now()}.${ext}`;
    const fileName = cleanName.includes('.') ? cleanName : `${cleanName}.${ext}`;

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'];
    const audioExts = ['mp3', 'm4a', 'ogg', 'wav', 'flac', 'aac', 'opus'];

    let sendKey;
    if (imageExts.includes(ext)) {
        sendKey = (ext === 'webp' && isAnimatedWebp(buffer)) ? 'sticker' : 'image';
    } else if (videoExts.includes(ext)) sendKey = 'video';
    else if (audioExts.includes(ext)) sendKey = 'audio';
    else sendKey = 'document';

    await sock.sendMessage(m.chat, {
        [sendKey]: buffer,
        mimetype: contentType.split(';')[0].trim() || 'application/octet-stream',
        ...(sendKey === 'document' ? { fileName } : {}),
        ...(sendKey === 'audio' ? { ptt: false } : {})
    }, { quoted: m });
}

function detectByMagicBytes(buffer) {
    const hex = buffer.slice(0, 12).toString('hex');

    if (hex.startsWith('ffd8ff')) return 'jpg';
    if (hex.startsWith('89504e47')) return 'png';
    if (hex.startsWith('47494638')) return 'gif';
    if (hex.startsWith('52494646') && hex.slice(16, 24) === '57454250') return 'webp';
    if (hex.startsWith('00000018') || hex.startsWith('00000020') || hex.slice(8, 16) === '66747970') return 'mp4';
    if (hex.startsWith('1a45dfa3')) return 'mkv';
    if (hex.startsWith('fff') || hex.startsWith('494433')) return 'mp3';
    if (hex.startsWith('4f676753')) return 'ogg';
    if (hex.startsWith('664c6143')) return 'flac';
    if (hex.startsWith('25504446')) return 'pdf';
    if (hex.startsWith('504b0304')) return 'zip';

    return null;
}

function isAnimatedWebp(buffer) {
    return buffer.indexOf(Buffer.from('414e494d', 'hex')) !== -1;
}
