'use strict';

const AUDIO_EXTENSIONS = new Map([
    ['audio/ogg', 'ogg'],
    ['audio/ogg; codecs=opus', 'ogg'],
    ['audio/mpeg', 'mp3'],
    ['audio/mp3', 'mp3'],
    ['audio/mp4', 'm4a'],
    ['audio/aac', 'aac'],
    ['audio/wav', 'wav'],
    ['audio/x-wav', 'wav'],
    ['audio/webm', 'webm'],
]);

function mediaInfo(quoted) {
    const mime = String(quoted?.mimetype || quoted?.msg?.mimetype || '').toLowerCase();
    const isAudio = quoted?.mtype === 'audioMessage' || mime.startsWith('audio/');
    return { mime, isAudio, isVoice: quoted?.mtype === 'audioMessage' && quoted?.ptt === true || quoted?.msg?.ptt === true };
}

function extensionForMime(mime) {
    const normalized = String(mime || '').toLowerCase();
    return AUDIO_EXTENSIONS.get(normalized) || normalized.split(';')[0].split('/')[1] || 'audio';
}

function safeBaseName(value) {
    return String(value || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'audio';
}

async function audioToDocument(sock, m, quoted, { reply, prefix = '.', voiceOnly = false, audioOnly = false } = {}) {
    if (!quoted) return reply(`Reply to an ${voiceOnly ? 'audio voice note' : 'audio file'} with ${prefix}${voiceOnly ? 'voice2doc' : 'audio2doc'}.`);
    const info = mediaInfo(quoted);
    if (!info.isAudio || (voiceOnly && !info.isVoice) || (audioOnly && info.isVoice)) {
        return reply(voiceOnly ? 'Reply to a voice note to convert it to a document.' : audioOnly ? 'Reply to a regular audio file, not a voice note.' : 'Reply to an audio file to convert it to a document.');
    }
    try {
        await sock.sendMessage(m.chat, { react: { text: '📄', key: m.key } }).catch(() => {});
        const buffer = await quoted.download();
        if (!buffer?.length) return reply('Could not download the audio file.');
        const ext = extensionForMime(info.mime);
        const sourceName = quoted.fileName || quoted.msg?.fileName || '';
        const base = sourceName ? safeBaseName(sourceName.replace(/\.[^.]+$/, '')) : (info.isVoice ? 'voice_note' : 'audio');
        const fileName = `${base}.${ext}`;
        await sock.sendMessage(m.chat, {
            document: buffer,
            mimetype: info.mime || 'audio/mpeg',
            fileName,
            caption: `Audio document: ${fileName}`,
        }, { quoted: m });
        await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } }).catch(() => {});
    } catch (error) {
        console.error('[AUDIO2DOC]', error.message);
        return reply('Failed to send the audio as a document.');
    }
}

module.exports = { audioToDocument, mediaInfo, extensionForMime, safeBaseName };
