'use strict';

const MESSAGE_WRAPPERS = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage',
    'groupStatusMessage',
    'groupStatusMessageV2',
];

function unwrapMessage(message) {
    let current = message || {};
    const seen = new Set();

    for (let depth = 0; depth < 12 && current && typeof current === 'object'; depth += 1) {
        if (seen.has(current)) break;
        seen.add(current);
        const wrapper = MESSAGE_WRAPPERS.find(key => current[key]?.message && typeof current[key].message === 'object');
        if (!wrapper) break;
        current = current[wrapper].message;
    }
    return current || {};
}

function messagePayload(value) {
    if (!value || typeof value !== 'object') return {};
    if (value.fakeObj?.message) return value.fakeObj.message;
    if (value.message?.key && value.message.message) return value.message.message;
    if (value.key && value.message) return value.message;
    if (value.message && typeof value.message === 'object') return value.message;
    return value;
}

function getMessageType(message) {
    const content = unwrapMessage(message);
    if (content.body && typeof content.body === 'object' &&
        ('nativeFlowMessage' in content || 'header' in content || 'footer' in content)) return 'interactiveMessage';
    return Object.keys(content).find(key => key !== 'messageContextInfo' && key !== 'contextInfo' && content[key]) || null;
}

function getContextInfo(message) {
    const queue = [message];
    const seen = new WeakSet();
    let fallback = null;
    while (queue.length) {
        const current = queue.shift();
        if (!current || typeof current !== 'object' || seen.has(current)) continue;
        seen.add(current);
        for (const [key, value] of Object.entries(current)) {
            if (!value || typeof value !== 'object') continue;
            if (key === 'contextInfo') {
                if (value.quotedMessage) return value;
                fallback ||= value;
                continue;
            }
            if (key === 'quotedMessage' || key === 'quoted') continue;
            queue.push(value);
        }
    }
    return fallback;
}

function getMessageText(message) {
    const content = unwrapMessage(message);
    if (typeof content.conversation === 'string') return content.conversation;
    const type = getMessageType(content);
    const value = type ? content[type] : {};
    if (type === 'interactiveMessage' || (content.body && typeof content.body === 'object' && 'nativeFlowMessage' in content)) {
        const interactive = type === 'interactiveMessage' && content.interactiveMessage ? content.interactiveMessage : content;
        const parts = [interactive.header?.title, interactive.body?.text, interactive.footer?.text];
        for (const button of interactive.nativeFlowMessage?.buttons || []) {
            parts.push(button?.url, button?.merchant_url);
            if (typeof button?.buttonParamsJson !== 'string') continue;
            try {
                const params = JSON.parse(button.buttonParamsJson);
                parts.push(params?.url, params?.merchant_url);
            } catch {}
        }
        return [...new Set(parts.filter(part => typeof part === 'string' && part.length > 0))].join('\n');
    }
    return value?.text || value?.caption || value?.conversation || '';
}

module.exports = { unwrapMessage, messagePayload, getMessageType, getContextInfo, getMessageText };
