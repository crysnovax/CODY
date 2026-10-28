function parseCommandInput(body, prefix) {
    const message = typeof body === 'string' ? body : '';
    const trimmed = message.trim();

    // /metadata is an explicit utility command that remains available even when
    // the bot's normal prefix is configured to another value.
    if (/^\/metadata(?:\s|$)/i.test(trimmed)) {
        const parts = trimmed.split(/ +/);
        const args = parts.slice(1);
        return {
            cmdName: 'metadata',
            args,
            text: args.join(' '),
            prefix: '/'
        };
    }

    if (prefix === '') {
        const parts = trimmed.split(/ +/);
        const cmdName = parts[0]?.toLowerCase() || '';
        const args = parts.slice(1);
        return { cmdName, args, text: args.join(' '), prefix };
    }

    if (!message.startsWith(prefix)) return null;

    const cmdName = message.slice(prefix.length).trim().split(/ +/)[0]?.toLowerCase() || '';
    const args = trimmed.split(/ +/).slice(1);
    return { cmdName, args, text: args.join(' '), prefix };
}

module.exports = { parseCommandInput };
