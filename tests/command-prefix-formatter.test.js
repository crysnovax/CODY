'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
    formatCommandPrefixes,
    formatCommandContent,
    hasRegisteredCommandPrefix
} = require('../src/Plugin/commandPrefixFormatter');

const help = '*AUTO COMMENT STATUS (ACS)*\n\n'
    + '`.acs text <text>` — set a text comment\n'
    + 'Reply to a sticker with `.acs sticker` — save it as the comment\n'
    + '`.acs on` / `.acs off` — enable or disable\n'
    + '`.acs status` — show current settings\n'
    + '`.acs clear` — clear the saved comment and turn ACS off';

test('all registered dot-command examples in help text use the configured prefix', () => {
    const rendered = formatCommandPrefixes(help, '/', ['acs', 'statusview', 'readstatus']);

    assert.equal(rendered,
        '*AUTO COMMENT STATUS (ACS)*\n\n'
        + '`/acs text <text>` — set a text comment\n'
        + 'Reply to a sticker with `/acs sticker` — save it as the comment\n'
        + '`/acs on` / `/acs off` — enable or disable\n'
        + '`/acs status` — show current settings\n'
        + '`/acs clear` — clear the saved comment and turn ACS off');
});

test('prefix formatter preserves unknown dotted tokens, URLs, file extensions, and object properties', () => {
    const text = 'Use .acs; keep unknown .notacommand, example.com, file.mp4, and obj.menu.';
    assert.equal(
        formatCommandPrefixes(text, '/', ['acs', 'menu']),
        'Use /acs; keep unknown .notacommand, example.com, file.mp4, and obj.menu.'
    );
});

test('empty prefix removes the dot and a dot prefix preserves existing help', () => {
    assert.equal(formatCommandPrefixes('Use `.acs on`', '', ['acs']), 'Use `acs on`');
    assert.equal(formatCommandPrefixes('Use `.acs on`', '.', ['acs']), 'Use `.acs on`');
});

test('registered command examples are recognized before translation, including with dot as PREFIX', () => {
    assert.equal(hasRegisteredCommandPrefix(help, ['acs', 'readstatus']), true);
    assert.equal(hasRegisteredCommandPrefix('example.com and file.mp4', ['acs']), false);
});

test('content formatter updates text and captions without mutating the original payload', () => {
    const original = { text: 'Use .acs', caption: 'Reply with .readstatus', image: Buffer.from('x') };
    const formatted = formatCommandContent(original, '/', ['acs', 'readstatus']);

    assert.deepEqual(formatted, { text: 'Use /acs', caption: 'Reply with /readstatus', image: original.image });
    assert.notEqual(formatted, original);
    assert.equal(original.text, 'Use .acs');
    assert.equal(original.caption, 'Reply with .readstatus');
});
