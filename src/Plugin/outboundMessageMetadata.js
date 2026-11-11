'use strict';

function isPrivateJid(jid) {
    return typeof jid === 'string'
        && (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'))
        && !jid.includes('@g.us');
}

function isEnabled(value) {
    return value === true || value === 1 || value === 'true' || value === '1';
}

/**
 * Add CODY's optional WhatsApp presentation metadata without changing callers'
 * content objects. Both features are intentionally opt-in: ordinary sends use
 * the standard message shape unless the owner enables the corresponding flag.
 */
function decorateOutboundContent(content, jid, {
    aiBadgeEnabled = false,
    secureMetaLabelEnabled = false
} = {}) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) return content;

    const decorated = { ...content };
    const target = Array.isArray(jid) ? jid[0] : jid;

    if (isEnabled(aiBadgeEnabled) && isPrivateJid(target)) decorated.ai = true;
    if (isEnabled(secureMetaLabelEnabled)) decorated.secureMetaServiceLabel = true;

    return decorated;
}

module.exports = { decorateOutboundContent, isPrivateJid, isEnabled };
