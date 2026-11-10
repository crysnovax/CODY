function isRoutableMessage(message) {
    return Boolean(
        message?.message &&
        message?.key?.remoteJid !== 'status@broadcast' &&
        message?.key?.remoteJidAlt !== 'status@broadcast'
    );
}

function getMessageText(message) {
    return message?.message?.conversation
        || message?.message?.extendedTextMessage?.text
        || '';
}

function selectMessageForProcessing(messages, prefix = '.') {
    const routable = (Array.isArray(messages) ? messages : []).filter(isRoutableMessage);
    const command = routable.find(message => {
        if (message.key?.fromMe) return false;
        const text = getMessageText(message);
        return typeof text === 'string' && text.trimStart().startsWith(String(prefix ?? ''));
    });
    return command || routable[0] || null;
}

module.exports = { selectMessageForProcessing };
