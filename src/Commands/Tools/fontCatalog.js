'use strict';

const styles = require("../Core/'.js");

function getFontNames() {
    return Object.keys(styles).filter(key => typeof styles[key] === 'function');
}

function getFontRows(sample = 'CRYSNOVA') {
    return getFontNames().map((name, index) => [
        String(index + 1),
        name,
        styles[name](sample),
    ]);
}

async function sendFontList(sock, chat, quoted, title = 'Available Fonts') {
    const rows = getFontRows();
    if (typeof sock.sendList === 'function') {
        await sock.sendList(chat, title, rows.map(([number, name, preview]) => `${number}. ${name}\n${preview}`), quoted);
        return true;
    }
    const text = `📚 *${title}*\n\n${rows.map(([number, name, preview]) => `${number}. ${name}\n  ${preview}`).join('\n\n')}`;
    await sock.sendMessage(chat, { text }, { quoted });
    return false;
}

function resolveFont(args = []) {
    const first = String(args[0] || '').toLowerCase();
    const names = getFontNames();
    if (first === 'group') {
        const index = Number.parseInt(args[1], 10);
        return Number.isInteger(index) ? names[index - 1] || null : null;
    }
    const index = Number.parseInt(first, 10);
    return Number.isInteger(index) ? names[index - 1] || null : null;
}

module.exports = { getFontNames, getFontRows, sendFontList, resolveFont, styles };
