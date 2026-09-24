/**
 * Normalize WhatsApp/plogme edit notifications.
 *
 * plogme 2.0.5 processes a human edit into messages.update as:
 *   update.message.editedMessage.message
 * Older/raw events may still expose:
 *   message.protocolMessage.editedMessage
 * or the equivalent bot-forwarded wrapper.
 */

const EDITED_MESSAGE_PATHS = [
    ['protocolMessage', 'editedMessage'],
    ['editedMessage', 'message'],
    ['editedMessage'],
    ['message', 'protocolMessage', 'editedMessage'],
    ['message', 'editedMessage', 'message'],
    ['message', 'editedMessage'],
    ['botForwardedMessage', 'message', 'protocolMessage', 'editedMessage'],
    ['message', 'botForwardedMessage', 'message', 'protocolMessage', 'editedMessage'],
    ['message', 'botForwardedMessage', 'message', 'editedMessage', 'message']
];

const readPath = (value, path) => path.reduce((node, key) => node?.[key], value);

function extractEditedMessage(value) {
    for (const path of EDITED_MESSAGE_PATHS) {
        const candidate = readPath(value, path);
        if (candidate && typeof candidate === 'object') {
            return candidate;
        }
    }
    return null;
}

function normalizeEditUpdate(entry) {
    const update = entry?.update || {};
    const editedMessage = extractEditedMessage(update) || extractEditedMessage(entry?.message);
    if (!editedMessage) return entry;

    // Keep the target message key from the event. In plogme 2.0.5 this is
    // already entry.key; raw protocol events may carry it beside the edit.
    const protocol = update?.protocolMessage || update?.message?.protocolMessage || entry?.message?.protocolMessage;
    const targetKey = protocol?.key || entry?.key || {};
    return {
        ...entry,
        key: targetKey,
        // antiedit consumes the edited payload from entry.message.editedMessage.
        // Keep that compatibility envelope while also exposing the direct
        // message under update.message for newer consumers.
        message: { ...(entry?.message || {}), editedMessage },
        update: {
            ...update,
            ...targetKey,
            message: editedMessage
        }
    };
}

function normalizeEditUpdates(updates) {
    return (Array.isArray(updates) ? updates : []).map(normalizeEditUpdate);
}

module.exports = {
    EDITED_MESSAGE_PATHS,
    extractEditedMessage,
    normalizeEditUpdate,
    normalizeEditUpdates
};
