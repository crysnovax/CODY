const test = require('node:test');
const assert = require('node:assert/strict');
const command = require('../src/Commands/Media/metadata');

const parentKey = {
    remoteJid: '120363400000000000@g.us',
    fromMe: false,
    id: 'PARENT-STICKER-ID',
    participant: '15550001111@s.whatsapp.net'
};

const makeSticker = (overrides = {}) => ({
    url: 'https://mmg.whatsapp.net/example.enc',
    fileSha256: Buffer.from('file-sha'),
    fileEncSha256: Buffer.from('encrypted-sha'),
    mediaKey: Buffer.from('media-key'),
    mimetype: 'image/webp',
    fileLength: { low: 403244, high: 0, toString: () => '403244' },
    mediaKeyTimestamp: { low: 1792648028, high: 0, toString: () => '1792648028' },
    firstFrameLength: 403040,
    firstFrameSidecar: Buffer.from('sidecar'),
    isAnimated: true,
    contextInfo: { mediaDomainInfo: {} },
    stickerSentTs: { low: 1792683251, high: 0, toString: () => '1792683251' },
    isAvatar: false,
    isAiSticker: false,
    isLottie: false,
    premium: 0,
    ...overrides
});

async function runCommand(quoted) {
    const replies = [];
    await command.execute({}, { chat: '120363400000000000@g.us', quoted }, {
        reply: async text => replies.push(text)
    });
    return replies.join('\n');
}

function parseGeneratedPayload(replyText) {
    const match = replyText.match(/```js\nawait sock\.sendStickerAnnotation\(m\.chat, ([\s\S]+)\);\n```/);
    assert.ok(match, 'reply should include a ready-to-copy sendStickerAnnotation call');
    return JSON.parse(match[1]);
}

test('/metadata is registered as a Media command', () => {
    assert.equal(command.name, 'metadata');
    assert.equal(command.category, 'Media');
    assert.equal(typeof command.execute, 'function');
});

test('/metadata returns the parent key and required sticker annotation fields', async () => {
    const reply = await runCommand({
        mtype: 'stickerMessage',
        mimetype: 'image/webp',
        key: parentKey,
        msg: makeSticker()
    });
    const payload = parseGeneratedPayload(reply);

    assert.deepEqual(payload.parentMessageKey, parentKey);
    assert.equal(payload.count, 1);
    assert.equal(payload.intervalMs, 1000);
    assert.equal(payload.stickerMessage.url, 'https://mmg.whatsapp.net/example.enc');
    assert.equal(payload.stickerMessage.fileSha256, Buffer.from('file-sha').toString('base64'));
    assert.equal(payload.stickerMessage.fileEncSha256, Buffer.from('encrypted-sha').toString('base64'));
    assert.equal(payload.stickerMessage.mediaKey, Buffer.from('media-key').toString('base64'));
    assert.equal(payload.stickerMessage.fileLength, '403244');
    assert.equal(payload.stickerMessage.mediaKeyTimestamp, '1792648028');
    assert.equal(payload.stickerMessage.firstFrameLength, 403040);
    assert.equal(payload.stickerMessage.firstFrameSidecar, Buffer.from('sidecar').toString('base64'));
    assert.equal(payload.stickerMessage.stickerSentTs, '1792683251');
    assert.deepEqual(payload.stickerMessage.contextInfo, { mediaDomainInfo: {} });
    assert.equal(payload.stickerMessage.isAnimated, true);
});

test('/metadata preserves static, animated, AI, avatar, and Lottie sticker flags', async () => {
    const variants = [
        { isAnimated: false, isAvatar: false, isAiSticker: false, isLottie: false },
        { isAnimated: true, isAvatar: false, isAiSticker: false, isLottie: false },
        { isAnimated: true, isAvatar: false, isAiSticker: true, isLottie: false },
        { isAnimated: true, isAvatar: true, isAiSticker: false, isLottie: false },
        { isAnimated: true, isAvatar: false, isAiSticker: false, isLottie: true }
    ];

    for (const flags of variants) {
        const reply = await runCommand({
            mtype: 'stickerMessage',
            key: parentKey,
            msg: makeSticker(flags)
        });
        const { stickerMessage } = parseGeneratedPayload(reply);
        for (const [name, value] of Object.entries(flags)) {
            assert.equal(stickerMessage[name], value, `expected ${name}=${value}`);
        }
    }
});

test('/metadata finds a sticker nested in a message wrapper and falls back to fakeObj.key', async () => {
    const reply = await runCommand({
        mtype: 'viewOnceMessageV2',
        fakeObj: { key: parentKey },
        msg: { viewOnceMessageV2: { message: { stickerMessage: makeSticker({ isAnimated: false }) } } }
    });
    const payload = parseGeneratedPayload(reply);

    assert.deepEqual(payload.parentMessageKey, parentKey);
    assert.equal(payload.stickerMessage.isAnimated, false);
});

test('/metadata explains when no sticker is quoted or the quoted message is not a sticker', async () => {
    assert.match(await runCommand(undefined), /Reply to a sticker with \/metadata/);
    assert.match(await runCommand({ mtype: 'imageMessage', msg: { url: 'https://example.test/image' } }), /replied message is not a sticker/);
});

test('/metadata refuses sticker payloads without a usable URL or directPath', async () => {
    const reply = await runCommand({
        mtype: 'stickerMessage',
        key: parentKey,
        msg: { ...makeSticker(), url: '', directPath: '' }
    });
    assert.match(reply, /no usable media URL or directPath/);
});

const { parseCommandInput } = require('../src/Plugin/command-parser');

test('/metadata dispatch works independently of the configured command prefix', () => {
    assert.deepEqual(parseCommandInput('/metadata', '.'), {
        cmdName: 'metadata', args: [], text: '', prefix: '/'
    });
    assert.deepEqual(parseCommandInput('/metadata now', '.'), {
        cmdName: 'metadata', args: ['now'], text: 'now', prefix: '/'
    });
    assert.deepEqual(parseCommandInput('.ping', '.'), {
        cmdName: 'ping', args: [], text: '', prefix: '.'
    });
    assert.equal(parseCommandInput('/ping', '.'), null);
});
