const DEFAULT_VIDEO_URL = 'https://cdn.crysnovax.link/files/1786874387710-9a4780ff-706c-4fb0-85d5-d2becb101696.mp4';

function option(args = [], name) {
    const prefix = `--${name}=`;
    const value = args.find(arg => String(arg).toLowerCase().startsWith(prefix));
    return value ? String(value).slice(prefix.length) : undefined;
}

function hasFlag(args = [], value) {
    return args.some(arg => String(arg).toLowerCase() === value);
}

function generationPayload(status, text, url, estimatedMs) {
    return {
        text,
        mediaType: 'video',
        status,
        ...(url ? { url, mimeType: 'video/mp4', duration: 10 } : {}),
        ...(estimatedMs ? { estimatedMs } : {})
    };
}

module.exports = {
    name: 'richgen',
    alias: ['test-richgen', 'generationtest'],
    category: 'Owner',
    ownerOnly: true,
    desc: 'Test native RichGen video generation progress and replacement',
    execute: async (sock, m, context = {}) => {
        const { args = [], reply, prefix = '.' } = context;
        if (typeof sock.sendRichGeneration !== 'function' || typeof sock.updateRichGeneration !== 'function') {
            return reply('This Baileys version does not expose RichGen. Update to plogme@2.7.16 or later.');
        }

        const state = String(option(args, 'state') || 'both').toLowerCase();
        const url = option(args, 'url') || DEFAULT_VIDEO_URL;
        const delayMs = Math.max(0, Math.min(Number(option(args, 'delay') || 3000), 30000));
        const quoted = m;

        if (!['both', 'generating', 'ready', 'failed'].includes(state)) {
            return reply(`Usage: ${prefix}richgen [--state=both|generating|ready|failed] [--delay=3000] [--url=https://...]`);
        }

        try {
            if (state === 'ready' || state === 'failed') {
                return reply(`Use ${prefix}richgen without --state=${state}; the command must send the GENERATING card first so it can replace it in place.`);
            }

            const generated = await sock.sendRichGeneration(
                m.chat,
                generationPayload('GENERATING', 'CRYSNOVA video generation in progress…', '', delayMs),
                quoted
            );
            const ids = {
                messageId: generated.messageId,
                responseId: generated.responseId,
                itemId: generated.itemId
            };

            if (state === 'generating') {
                return reply(`RichGen GENERATING card sent.\nMessage ID: ${ids.messageId}\nResponse ID: ${ids.responseId}\nItem ID: ${ids.itemId}`);
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
            const failed = hasFlag(args, '--failed');
            const finalState = failed ? 'FAILED' : 'READY';
            const updated = await sock.updateRichGeneration(
                m.chat,
                ids.messageId,
                generationPayload(
                    finalState,
                    failed ? 'CRYSNOVA video generation failed.' : 'CRYSNOVA video generation complete.',
                    failed ? '' : url
                ),
                { itemId: ids.itemId, responseId: ids.responseId }
            );

            return reply(`RichGen ${finalState} replacement sent in place.\nMessage ID: ${ids.messageId}\nResponse ID: ${updated.responseId || ids.responseId}\nItem ID: ${updated.itemId || ids.itemId}`);
        } catch (error) {
            return reply(`RichGen test failed: ${error?.message || error}`);
        }
    },
    option,
    generationPayload
};

// `--failed` is intentionally accepted as a standalone flag by hasFlag above.
// The command remains owner-only and never invokes an external generation provider.
