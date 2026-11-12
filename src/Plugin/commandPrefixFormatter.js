'use strict';

function commandNamesFrom(source) {
    if (!source) return [];
    if (source instanceof Map) return [...source.keys()];
    if (typeof source === 'string') return [source];
    if (typeof source[Symbol.iterator] === 'function') return [...source];
    return [];
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function commandPattern(commandSource) {
    const names = [...new Set(commandNamesFrom(commandSource)
        .filter(name => typeof name === 'string')
        .map(name => name.toLowerCase())
        .filter(name => /^[a-z][a-z0-9_-]*$/.test(name)))].sort((a, b) => b.length - a.length);
    if (!names.length) return null;

    const alternatives = names.map(escapeRegExp).join('|');
    return new RegExp(`(^|[^A-Za-z0-9_.])\\.(${alternatives})(?=$|[^A-Za-z0-9_-])`, 'gi');
}

function hasRegisteredCommandPrefix(text, commandSource) {
    const pattern = commandPattern(commandSource);
    return typeof text === 'string' && Boolean(pattern?.test(text));
}

/**
 * Rewrite only registered dot-prefixed command tokens in displayed text.
 * This keeps prose punctuation, URLs, file extensions, dotted properties, and
 * unknown tokens untouched while allowing legacy help strings to follow PREFIX.
 */
function formatCommandPrefixes(text, prefix, commandSource) {
    if (typeof text !== 'string') return text;

    const pattern = commandPattern(commandSource);
    if (!pattern) return text;
    const activePrefix = prefix == null ? '' : String(prefix);
    return text.replace(pattern, (_match, boundary, command) => `${boundary}${activePrefix}${command}`);
}

function formatCommandContent(content, prefix, commandSource) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) return content;

    let formatted = content;
    for (const field of ['text', 'caption']) {
        if (typeof content[field] !== 'string') continue;
        const next = formatCommandPrefixes(content[field], prefix, commandSource);
        if (next !== content[field]) {
            if (formatted === content) formatted = { ...content };
            formatted[field] = next;
        }
    }
    return formatted;
}

module.exports = { formatCommandPrefixes, formatCommandContent, hasRegisteredCommandPrefix };
