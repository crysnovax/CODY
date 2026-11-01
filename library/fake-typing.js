'use strict';

function isCommandMessage(body, prefix = '.', getCommand = null) {
    const text = String(body || '').trim();
    if (!text) return false;

    let commandText = text;
    const commandPrefix = prefix === undefined || prefix === null || prefix === 'null' ? '.' : String(prefix);
    if (commandPrefix) {
        if (!text.startsWith(commandPrefix)) return false;
        commandText = text.slice(commandPrefix.length).trim();
    }

    const commandName = commandText.split(/\s+/)[0]?.toLowerCase();
    if (!commandName) return false;
    return typeof getCommand === 'function' ? Boolean(getCommand(commandName)) : true;
}

function shouldFakeTyping(mode, body, prefix = '.', getCommand = null) {
    if (mode === 'all' || mode === true) return true;
    if (mode !== 'cmd') return false;
    return isCommandMessage(body, prefix, getCommand);
}

async function sendFakeTyping(sock, chat) {
    if (typeof sock?.sendPresenceUpdate !== 'function' || !chat) return false;
    try {
        await sock.sendPresenceUpdate('composing', chat);
        return true;
    } catch {
        return false;
    }
}

module.exports = { isCommandMessage, shouldFakeTyping, sendFakeTyping };
