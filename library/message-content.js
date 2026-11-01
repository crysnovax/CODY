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
    return Object.keys(content).find(key => key !== 'messageContextInfo' && key !== 'contextInfo' && content[key]) || null;
}

function getContextInfo(message) {
    const content = unwrapMessage(message);
    if (content.contextInfo) return content.contextInfo;
    for (const value of Object.values(content)) {
        if (value?.contextInfo) return value.contextInfo;
    }
    return null;
}

function getMessageText(message) {
    const content = unwrapMessage(message);
    if (typeof content.conversation === 'string') return content.conversation;
    const type = getMessageType(content);
    const value = type ? content[type] : {};
    return value?.text || value?.caption || value?.conversation || '';
}

module.exports = { unwrapMessage, messagePayload, getMessageType, getContextInfo, getMessageText };
